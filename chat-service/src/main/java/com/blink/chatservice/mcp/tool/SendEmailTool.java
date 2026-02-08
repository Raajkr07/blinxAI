package com.blink.chatservice.mcp.tool;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SendEmailTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public String name() {
        return "send_email";
    }

    @Override
    public String description() {
        return "Draft and send an email.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "to", Map.of("type", "string", "description", "Recipient email"),
                "subject", Map.of("type", "string", "description", "Email subject"),
                "body", Map.of("type", "string", "description", "Email body")
            ),
            "required", List.of("to", "subject", "body")
        );
    }

    @Override
    public Map<String, Object> execute(String userId, Map<Object, Object> arguments) {
        String to = (String) arguments.get("to");
        if (to == null || to.isBlank()) throw new IllegalArgumentException("Recipient is required");

        messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
            "type", "SEND_EMAIL_REQUEST",
            "payload", Map.of(
                "to", to,
                "subject", arguments.getOrDefault("subject", "(No Subject)"),
                "body", arguments.getOrDefault("body", "")
            )
        ));

        return Map.of("status", "pending", "message", "Email drafted to " + to);
    }
}
