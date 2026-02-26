package com.blink.chatservice.mcp.tool;

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

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SummarizeConversationTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;
    private final MessageRepository messageRepository;
    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "summarize_conversation";
    }

    @Override
    public String description() {
        return "Get a quick summary of a chat — key topics discussed, decisions made, and any pending items. Works with a user name or conversation ID.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "conversationId", Map.of("type", "string", "description", "Conversation ID to summarize"),
                "targetUser", Map.of("type", "string", "description", "Username/email/phone — summarize the chat with this person")
            )
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String convId = (String) args.get("conversationId");
        String targetUser = (String) args.get("targetUser");

        try {
            if (convId == null && targetUser != null && !targetUser.isBlank()) {
                User user = userLookupHelper.resolveUser(targetUser.trim(), userId);
                if (user == null) {
                    return Map.of("success", false,
                        "message", "Couldn't find '" + targetUser + "' on BlinX. Try their exact username or email.");
                }
                Conversation conversation = chatService.createDirectConversation(userId, user.getId());
                if (conversation == null) {
                    return Map.of("success", false, "message", "No conversation found with " + targetUser + ".");
                }
                convId = conversation.getId();
            }

            if (convId == null || convId.isBlank()) {
                return Map.of("success", false,
                    "message", "Tell me which chat to summarize — a person's name or a conversation ID.");
            }

            List<Message> messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
                    convId, PageRequest.of(0, 50))
                .getContent().stream()
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .toList();

            if (messages.isEmpty()) {
                return Map.of("success", true, "conversationId", convId,
                    "summary", "This conversation is empty — no messages to summarize.");
            }

            log.info("Summarizing conversation {} ({} messages) for user {}", convId, messages.size(), userId);
            Object summary = aiAnalysisService.analyzeConversation(messages);

            if (summary == null) {
                return Map.of("success", false,
                    "message", "Couldn't generate a summary right now. Please try again.");
            }

            return Map.of(
                "success", true,
                "conversationId", convId,
                "messageCount", messages.size(),
                "summary", summary,
                "hint", "Present this as a clean, concise summary. Highlight action items if any."
            );

        } catch (Exception e) {
            log.error("Summarization failed for user {} on conversation '{}': {}",
                    userId, convId != null ? convId : targetUser, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't summarize the conversation right now. Please try again.");
        }
    }
}
