package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
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
public class GetOrCreateConversationTool implements McpTool {

    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "get_or_create_conversation";
    }

    @Override
    public String description() {
        return "Open or start a direct chat with another BlinX user. Use before sending a message to someone new.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "recipient", Map.of("type", "string", "description", "Who to chat with — username, email, phone, or user ID")
            ),
            "required", List.of("recipient")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String recipient = (String) args.get("recipient");
        if (recipient == null || recipient.isBlank()) {
            return Map.of("success", false, "message", "Tell me who you want to chat with — name, email, or phone number.");
        }

        try {
            User recipientUser = userLookupHelper.resolveUser(recipient.trim(), userId);
            if (recipientUser == null) {
                return Map.of("success", false,
                    "message", "Couldn't find '" + recipient + "' on BlinX. Try their exact username or email.");
            }

            if (recipientUser.getId().equals(userId)) {
                return Map.of("success", false, "message", "You can't start a conversation with yourself!");
            }

            log.info("Creating/getting conversation between {} and {}", userId, recipientUser.getId());
            Conversation conversation = chatService.createDirectConversation(userId, recipientUser.getId());

            return Map.of(
                "success", true,
                "conversationId", conversation.getId(),
                "type", conversation.getType().toString(),
                "recipient", userLookupHelper.getUserInfoMap(recipientUser),
                "message", "Chat with " + recipientUser.getUsername() + " is ready."
            );

        } catch (Exception e) {
            log.error("Failed to create conversation for user {} with recipient '{}': {}",
                    userId, recipient, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't open the chat right now. Please try again.");
        }
    }
}
