package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.model.ConversationType;
import com.blink.chatservice.chat.repository.ConversationRepository;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.websocket.dto.RealtimeMessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Component
@RequiredArgsConstructor
public class SendMessageTool implements McpTool {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserLookupHelper userLookupHelper;

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
        if (content == null || content.isBlank()) return Map.of("error", true, "message", "Content required");

        String convId = (String) args.get("conversationId");
        String recipient = (String) args.get("recipient");

        if (convId == null && recipient != null) {
            var user = userLookupHelper.findUserByIdentifier(recipient);
            if (user == null) return Map.of("error", true, "message", "User not found");
            convId = getConvId(userId, user.getId());
        }

        if (convId == null) return Map.of("error", true, "message", "Recipient or conversationId required");

        return send(userId, convId, content.trim());
    }

    private String getConvId(String userId, String otherId) {
        return conversationRepository.findByParticipantsContaining(userId).stream()
            .filter(c -> c.getParticipants().size() == 2 && c.getParticipants().contains(otherId))
            .map(Conversation::getId)
            .findFirst()
            .orElseGet(() -> {
                Conversation c = new Conversation();
                c.setParticipants(new HashSet<>(List.of(userId, otherId)));
                c.setType(ConversationType.DIRECT);
                return conversationRepository.save(c).getId();
            });
    }

    private Map<String, Object> send(String userId, String convId, String content) {
        Conversation conv = conversationRepository.findById(convId).orElseThrow(() -> new IllegalArgumentException("Not found"));
        if (!conv.getParticipants().contains(userId)) throw new IllegalStateException("Not authorized");

        String recipientId = conv.getParticipants().stream().filter(p -> !p.equals(userId)).findFirst().orElse(null);

        Message msg = new Message();
        msg.setConversationId(convId);
        msg.setSenderId(userId);
        msg.setRecipientId(recipientId);
        msg.setBody(content);
        msg.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        messageRepository.save(msg);

        conv.setLastMessageAt(LocalDateTime.now(ZoneId.of("UTC")));
        conv.setLastMessagePreview(content.length() > 50 ? content.substring(0, 50) + "..." : content);
        conversationRepository.save(conv);

        var wsResp = new RealtimeMessageResponse(msg.getId(), convId, userId, recipientId, content, msg.getCreatedAt());
        messagingTemplate.convertAndSend("/topic/conversations/" + convId, wsResp);
        
        return Map.of("success", true, "messageId", msg.getId());
    }
}
