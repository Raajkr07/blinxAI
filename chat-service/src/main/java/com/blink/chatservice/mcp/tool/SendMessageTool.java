package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SendMessageTool implements McpTool {

    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "send_message";
    }

    @Override
    public String description() {
        return "Send a chat message to someone on BlinX. Write naturally — match the user's tone and intent exactly.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "recipient", Map.of("type", "string", "description", "Who to message — username, email, phone, or user ID. Not needed if conversationId is provided."),
                "conversationId", Map.of("type", "string", "description", "Existing conversation ID (skip recipient if you have this)"),
                "content", Map.of("type", "string", "description", "The message to send. Write it exactly how the user wants — casual, direct, no boilerplate.")
            ),
            "required", List.of("content")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String content = (String) args.get("content");
        if (content == null || content.isBlank()) {
            return Map.of("success", false, "message", "Can't send an empty message. What should I say?");
        }

        // Cap message length to prevent abuse
        if (content.length() > 5000) {
            content = content.substring(0, 5000);
        }

        String convId = (String) args.get("conversationId");
        String recipient = (String) args.get("recipient");

        try {
            if (convId == null && recipient != null && !recipient.isBlank()) {
                User user = userLookupHelper.resolveUser(recipient.trim(), userId);
                if (user == null) {
                    return Map.of("success", false,
                        "message", "Couldn't find '" + recipient + "' on BlinX. Try their exact username or email.");
                }
                if (user.getId().equals(userId)) {
                    return Map.of("success", false, "message", "You can't send a message to yourself!");
                }
                Conversation conv = chatService.createDirectConversation(userId, user.getId());
                convId = conv.getId();
            }

            if (convId == null || convId.isBlank()) {
                return Map.of("success", false,
                    "message", "Tell me who to send this to — a name, email, or phone number.");
            }

            Message msg = chatService.sendMessage(convId, userId, content.trim());
            log.info("Message sent by user {} in conversation {}: messageId={}", userId, convId, msg.getId());

            return Map.of("success", true,
                "messageId", msg.getId(),
                "conversationId", convId,
                "message", "Message sent!");

        } catch (Exception e) {
            log.error("Failed to send message for user {} to conv/recipient '{}': {}",
                    userId, convId != null ? convId : recipient, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't send the message right now. Please try again.");
        }
    }
}
