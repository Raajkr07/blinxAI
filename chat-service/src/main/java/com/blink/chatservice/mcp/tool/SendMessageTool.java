package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SendMessageTool implements McpTool {

    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;
    private final UserService userService;

    @Override
    public String name() {
        return "send_message";
    }

    @Override
    public String description() {
        return "Send a message to a user or conversation.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "recipient", Map.of("type", "string", "description", "Recipient identifier"),
                "conversationId", Map.of("type", "string", "description", "Conversation ID"),
                "content", Map.of("type", "string", "description", "Message content")
            ),
            "required", List.of("content")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String content = (String) args.get("content");
        if (content == null || content.isBlank()) {
            return Map.of("error", true, "message", "Content required");
        }

        String convId = (String) args.get("conversationId");
        String recipient = (String) args.get("recipient");

        if (convId == null && recipient != null) {
            User user = resolveUser(recipient, userId);
            if (user != null) {
                Conversation conv = chatService.createDirectConversation(userId, user.getId());
                convId = conv.getId();
            } else {
                return Map.of("error", true, "message", "User not found: " + recipient);
            }
        }

        if (convId == null) {
            return Map.of("error", true, "message", "Recipient or conversationId required");
        }

        try {
            Message msg = chatService.sendMessage(convId, userId, content.trim());
            return Map.of("success", true, "messageId", msg.getId(), "conversationId", convId);
        } catch (Exception e) {
            return Map.of("error", true, "message", "Failed to send message: " + e.getMessage());
        }
    }

    private User resolveUser(String identifier, String currentUserId) {
        User u = userLookupHelper.findUserByIdentifier(identifier);
        if (u != null) return u;
        
        List<User> users = userService.searchUsersByContact(identifier, currentUserId);
        if (!users.isEmpty()) return users.get(0);
        
        return null;
    }
}
