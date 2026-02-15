package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SummarizeConversationTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;
    private final MessageRepository messageRepository;
    private final ChatService chatService;
    private final UserService userService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "summarize_conversation";
    }

    @Override
    public String description() {
        return "Summarize a conversation with a specific user or by conversation ID.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "conversationId", Map.of("type", "string", "description", "Conversation ID"),
                "targetUser", Map.of("type", "string", "description", "The user to summarize chat with")
            )
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String convId = (String) args.get("conversationId");
        String targetUser = (String) args.get("targetUser");

        if (convId == null && targetUser != null) {
            User user = resolveUser(targetUser, userId);
            if (user != null) {
                Conversation conversation = chatService.createDirectConversation(userId, user.getId());
                convId = conversation.getId();
            } else {
                return Map.of("error", true, "message", "User not found: " + targetUser);
            }
        }

        if (convId == null || convId.isBlank()) {
            return Map.of("error", true, "message", "conversationId or targetUser required");
        }

        List<Message> messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(convId, PageRequest.of(0, 50))
            .getContent().stream()
            .sorted(Comparator.comparing(Message::getCreatedAt))
            .toList();

        if (messages.isEmpty()) {
            return Map.of("success", true, "summary", "No messages found");
        }

        return Map.of(
            "success", true,
            "conversationId", convId,
            "summary", aiAnalysisService.analyzeConversation(messages)
        );
    }

    private User resolveUser(String identifier, String currentUserId) {
        User u = userLookupHelper.findUserByIdentifier(identifier);
        if (u != null) return u;
        
        List<User> users = userService.searchUsersByContact(identifier, currentUserId);
        if (!users.isEmpty()) return users.get(0);
        
        return null;
    }
}
