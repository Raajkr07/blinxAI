package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.model.AiAnalysisModels;
import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExtractTasksTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;
    private final ChatService chatService;
    private final MessageRepository messageRepository;
    private final UserLookupHelper userLookupHelper;
    private static final DateTimeFormatter DD_MM_YYYY = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    @Override
    public String name() {
        return "extract_tasks";
    }

    @Override
    public String description() {
        return "Pull out action items, to-dos, and follow-ups from a conversation or text. Great for 'What tasks came out of my chat with [Name]?'";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "text", Map.of("type", "string", "description", "Raw text to extract tasks from (skip if using targetUser/conversationId)"),
                "targetUser", Map.of("type", "string", "description", "Username/email/phone of the person whose chat to scan for tasks"),
                "conversationId", Map.of("type", "string", "description", "Specific conversation ID to scan"),
                "startDate", Map.of("type", "string", "description", "Only scan messages from this date onwards (DD-MM-YYYY)"),
                "endDate", Map.of("type", "string", "description", "Only scan messages up to this date (DD-MM-YYYY)")
            )
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String text = (String) args.get("text");
        String targetUser = (String) args.get("targetUser");
        String conversationId = (String) args.get("conversationId");
        String startDateStr = (String) args.get("startDate");
        String endDateStr = (String) args.get("endDate");

        try {
            LocalDate start = null;
            LocalDate end = null;

            if (startDateStr != null && !startDateStr.isBlank()) {
                try {
                    start = LocalDate.parse(startDateStr, DD_MM_YYYY);
                } catch (Exception e) {
                    log.warn("Could not parse startDate '{}', ignoring filter", startDateStr);
                }
            }
            if (endDateStr != null && !endDateStr.isBlank()) {
                try {
                    end = LocalDate.parse(endDateStr, DD_MM_YYYY);
                } catch (Exception e) {
                    log.warn("Could not parse endDate '{}', ignoring filter", endDateStr);
                }
            }

            if (conversationId != null && !conversationId.isBlank()) {
                text = fetchMessages(conversationId, start, end);
            } else if (targetUser != null && !targetUser.isBlank()) {
                User user = userLookupHelper.resolveUser(targetUser, userId);
                if (user == null) {
                    return Map.of("success", false, "message", "Couldn't find user '" + targetUser + "'. Try searching by exact username or email.");
                }
                Conversation conv = chatService.createDirectConversation(userId, user.getId());
                if (conv == null) {
                    return Map.of("success", false, "message", "No conversation found with " + targetUser + ".");
                }
                text = fetchMessages(conv.getId(), start, end);
            }

            if (text == null || text.isBlank()) {
                return Map.of("success", false,
                    "message", "Nothing to analyze. Provide some text, a username, or a conversation ID.");
            }

            // Cap input text to prevent token overflow in AI analysis
            if (text.length() > 8000) {
                text = text.substring(text.length() - 8000);
            }

            log.info("Extracting tasks for user {} from {} chars of text", userId, text.length());
            AiAnalysisModels.TaskListExtraction result = aiAnalysisService.extractTasks(text);

            if (result == null || result.tasks() == null || result.tasks().isEmpty()) {
                return Map.of("success", true, "total_count", 0,
                    "done", List.of(), "upcoming", List.of(),
                    "message", "No actionable tasks found in the conversation.");
            }

            List<AiAnalysisModels.TaskExtraction> allTasks = result.tasks();

            Map<String, List<AiAnalysisModels.TaskExtraction>> grouped = allTasks.stream()
                .collect(Collectors.groupingBy(t -> t.status() != null ? t.status().toLowerCase() : "pending"));

            return Map.of(
                "success", true,
                "total_count", allTasks.size(),
                "done", grouped.getOrDefault("done", List.of()).stream().map(this::formatTaskDate).toList(),
                "upcoming", grouped.getOrDefault("pending", List.of()).stream().map(this::formatTaskDate).toList(),
                "hint", "Present these as a clean checklist. Group by priority if there are many."
            );

        } catch (Exception e) {
            log.error("Task extraction failed for user {}: {}", userId, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't extract tasks right now. Please try again.");
        }
    }

    private AiAnalysisModels.TaskExtraction formatTaskDate(AiAnalysisModels.TaskExtraction t) {
        String formattedDate = t.date();
        if (formattedDate != null && !formattedDate.isBlank()) {
            try {
                if (formattedDate.contains("T")) {
                    LocalDateTime dt = LocalDateTime.parse(formattedDate, DateTimeFormatter.ISO_DATE_TIME);
                    formattedDate = dt.format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
                } else if (!formattedDate.matches("\\d{2}-\\d{2}-\\d{4}")) {
                    LocalDate d = parseDatePart(formattedDate);
                    formattedDate = d.format(DD_MM_YYYY);
                }
            } catch (Exception e) {
                // Keep original date string on parse failure
            }
        }
        return new AiAnalysisModels.TaskExtraction(t.taskTitle(), t.description(), formattedDate, t.priority(), t.status());
    }

    private LocalDate parseDatePart(String datePart) {
        try {
            if (datePart.contains("-")) {
                String[] parts = datePart.split("-");
                if (parts[0].length() == 4) return LocalDate.parse(datePart);
                return LocalDate.parse(datePart, DD_MM_YYYY);
            }
            return LocalDate.parse(datePart);
        } catch (Exception e) {
            return LocalDate.now();
        }
    }

    private String fetchMessages(String conversationId, LocalDate start, LocalDate end) {
        return messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
            conversationId, PageRequest.of(0, 100)
        ).getContent().stream()
         .filter(m -> {
             if (start != null && m.getCreatedAt().toLocalDate().isBefore(start)) return false;
             if (end != null && m.getCreatedAt().toLocalDate().isAfter(end)) return false;
             return true;
         })
         .sorted(Comparator.comparing(Message::getCreatedAt))
         .map(m -> String.format("[%s] %s: %s",
             m.getCreatedAt().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")),
             m.getSenderId(), m.getBody()))
         .collect(Collectors.joining("\n"));
    }
}
