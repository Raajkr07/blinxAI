package com.blink.chatservice.mcp.tool;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SendEmailTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public String name() {
        return "send_email";
    }

    @Override
    public String description() {
        return "Draft an email and request user confirmation to send it. Use this tool when the user explicitly asks to send an email.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "to", Map.of("type", "string", "description", "Recipient email address"),
                        "subject", Map.of("type", "string", "description", "Email subject line"),
                        "body", Map.of("type", "string", "description", "Email body content (text/html)")
                ),
                "required", java.util.List.of("to", "subject", "body")
        );
    }

    @Override
    public Map<String, Object> execute(String userId, Map<Object, Object> arguments) {
        String to = (String) arguments.get("to");
        String subject = (String) arguments.get("subject");
        String body = (String) arguments.get("body");

        if (to == null || to.isEmpty()) {
            throw new IllegalArgumentException("Recipient email (to) is required");
        }
        
        log.info("Proposing email for user {}: To={}", userId, to);

        // Notify frontend to show modal
        // Using a topic-based approach to avoid potential UserDestination resolution issues
        // Client will subscribe to /topic/user/{userId}/actions
        String destination = "/topic/user/" + userId + "/actions";
        
        messagingTemplate.convertAndSend(
                destination,
                Map.of(
                        "type", "SEND_EMAIL_REQUEST",
                        "payload", Map.of(
                                "to", to,
                                "subject", subject != null ? subject : "(No Subject)",
                                "body", body != null ? body : ""
                        )
                )
        );

        return Map.of(
                "status", "pending_confirmation",
                "message", "I have drafted the email to " + to + ". Please review and confirm sending in the popup."
        );
    }

    @Override
    public boolean isAllowedForUser(String userId) {
        return true; 
    }
}
