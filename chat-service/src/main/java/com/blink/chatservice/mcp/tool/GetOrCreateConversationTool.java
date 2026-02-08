package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GetOrCreateConversationTool implements McpTool {

    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "get_or_create_conversation";
    }

    @Override
    public String description() {
        return "Get or create a direct conversation with another user.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "recipient", Map.of("type", "string", "description", "Recipient's identifier")
            ),
            "required", List.of("recipient")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String recipient = (String) args.get("recipient");
        if (recipient == null || recipient.isBlank()) {
            return Map.of("error", true, "message", "recipient is required");
        }

        var recipientUser = userLookupHelper.findUserByIdentifier(recipient);
        if (recipientUser == null) {
            return Map.of("error", true, "message", "Recipient not found");
        }

        if (recipientUser.getId().equals(userId)) {
            return Map.of("error", true, "message", "Cannot chat with yourself");
        }

        Conversation conversation = chatService.createDirectConversation(userId, recipientUser.getId());
        return Map.of(
            "success", true,
            "conversationId", conversation.getId(),
            "type", conversation.getType().toString(),
            "recipient", userLookupHelper.getUserInfoMap(recipientUser)
        );
    }
}
