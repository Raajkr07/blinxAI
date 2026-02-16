package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.model.AiAnalysisModels;
import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExtractTasksTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;
    private final ChatService chatService;
    private final MessageRepository messageRepository;
    private final UserLookupHelper userLookupHelper;
    private final UserService userService;
    private static final DateTimeFormatter DD_MM_YYYY = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    @Override
    public String name() {
        return "extract_tasks";
    }

    @Override
    public String description() {
        return "Extract actionable tasks or reminders from text or conversation history. Supports filtering by date.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "text", Map.of("type", "string", "description", "Text to analyze (optional if targetUser/conversationId set)"),
                "targetUser", Map.of("type", "string", "description", "User to extract tasks from"),
                "conversationId", Map.of("type", "string", "description", "Conversation ID to extract tasks from"),
                "startDate", Map.of("type", "string", "description", "Filter from date (DD-MM-YYYY"),
                "endDate", Map.of("type", "string", "description", "Filter to date (DD-MM-YYYY)")
            )
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String text = (String) args.get("text");
        String targetUser = (String) args.get("targetUser");
        String conversationId = (String) args.get("conversationId");
        String startDateStr = (String) args.get("startDate");
        String endDateStr = (String) args.get("endDate");

        try {
            LocalDate start = startDateStr != null ? LocalDate.parse(startDateStr, DD_MM_YYYY) : null;
            LocalDate end = endDateStr != null ? LocalDate.parse(endDateStr, DD_MM_YYYY) : null;

            if (conversationId != null && !conversationId.isBlank()) {
                text = fetchMessages(conversationId, start, end);
            } else if (targetUser != null && !targetUser.isBlank()) {
                User user = resolveUser(targetUser, userId);
                if (user != null) {
                    Conversation conv = chatService.createDirectConversation(userId, user.getId());
                    if (conv != null) {
                        text = fetchMessages(conv.getId(), start, end);
                    } else {
                         return Map.of("error", true, "message", "No conversation found with " + targetUser);
                    }
                } else {
                    return Map.of("error", true, "message", "User not found: " + targetUser);
                }
            }
            
            if (text == null || text.isBlank()) {
                 return Map.of("error", true, "message", "No content found to analyze or text/user/conversationId is missing");
            }

            AiAnalysisModels.TaskListExtraction result = aiAnalysisService.extractTasks(text);
            List<AiAnalysisModels.TaskExtraction> allTasks = result != null && result.tasks() != null ? result.tasks() : List.of();
            
            Map<String, List<AiAnalysisModels.TaskExtraction>> grouped = allTasks.stream()
                .collect(Collectors.groupingBy(t -> t.status() != null ? t.status().toLowerCase() : "pending"));
            
            return Map.of(
                "success", true,
                "total_count", allTasks.size(),
                "done", grouped.getOrDefault("done", List.of()).stream().map(this::formatTaskDate).toList(),
                "upcoming", grouped.getOrDefault("pending", List.of()).stream().map(this::formatTaskDate).toList()
            );

        } catch (Exception e) {
            log.error("Task extraction error for user {}: {}", userId, e.getMessage());
            return Map.of("error", true, "message", "Error extracting tasks: " + e.getMessage());
        }
    }
    
    private AiAnalysisModels.TaskExtraction formatTaskDate(AiAnalysisModels.TaskExtraction t) {
        String formattedDate = t.date();
        if (formattedDate != null && !formattedDate.isBlank()) {
            try {
                if (formattedDate.contains("T")) {
                    LocalDateTime dt = LocalDateTime.parse(formattedDate, DateTimeFormatter.ISO_DATE_TIME);
                    formattedDate = dt.format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
                } else if (formattedDate.matches("\\d{2}-\\d{2}-\\d{4}")) {
                    // Already in dd-MM-yyyy, keep it or re-format if needed
                } else {
                    LocalDate d = parseDatePart(formattedDate);
                    formattedDate = d.format(DD_MM_YYYY);
                }
            } catch (Exception e) {
                // Fallback to original
            }
        }
        return new AiAnalysisModels.TaskExtraction(t.taskTitle(), t.description(), formattedDate, t.priority(), t.status());
    }

    private LocalDate parseDatePart(String datePart) {
        try {
            if (datePart.contains("-")) {
                String[] parts = datePart.split("-");
                if (parts[0].length() == 4) return LocalDate.parse(datePart); // yyyy-MM-dd
                return LocalDate.parse(datePart, DD_MM_YYYY);
            }
            return LocalDate.parse(datePart);
        } catch (Exception e) {
            return LocalDate.now();
        }
    }

    private User resolveUser(String identifier, String currentUserId) {
        User u = userLookupHelper.findUserByIdentifier(identifier);
        if (u != null) return u;
        
        List<User> users = userService.searchUsersByContact(identifier, currentUserId);
        if (!users.isEmpty()) return users.get(0);
        
        return null;
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
