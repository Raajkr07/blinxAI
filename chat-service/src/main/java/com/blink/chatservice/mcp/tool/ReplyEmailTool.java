package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.OAuthService;
import com.blink.chatservice.user.service.UserService;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import java.util.*;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReplyEmailTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;
    private final OAuthService oAuthService;
    private final UserService userService;
    private final UserRepository userRepository;
    private final RestClient restClient = RestClient.create();

    @Override
    public String name() {
        return "reply_email";
    }

    @Override
    public String description() {
        return "Reply to a specific Gmail email thread. Requires threadId from read_emails.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "threadId", Map.of("type", "string", "description", "Gmail thread ID from read_emails"),
                "messageId", Map.of("type", "string", "description", "Gmail message ID to reply to"),
                "to", Map.of("type", "string", "description", "Recipient email address"),
                "subject", Map.of("type", "string", "description", "Subject line (usually 'Re: original subject')"),
                "body", Map.of("type", "string", "description",
                    "Reply content. Use [Recipient Name] and [Your Name] as placeholders."),
                "inReplyTo", Map.of("type", "string", "description", "Original Message-ID header for threading")
            ),
            "required", List.of("threadId", "to", "subject", "body")
        );
    }

    @Override
    public Map<String, Object> execute(String userId, Map<Object, Object> arguments) {
        String threadId = (String) arguments.get("threadId");
        String messageId = (String) arguments.get("messageId");
        String to = (String) arguments.get("to");
        String subject = (String) arguments.getOrDefault("subject", "(No Subject)");
        String body = (String) arguments.getOrDefault("body", "");
        String inReplyTo = (String) arguments.get("inReplyTo");

        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("Recipient (to) is required");
        }
        if (threadId == null || threadId.isBlank()) {
            throw new IllegalArgumentException("Thread ID is required for replying");
        }

        // Resolve name placeholders
        User sender = userService.getProfile(userId);
        Optional<User> recipient = userRepository.findFirstByEmail(to.trim().toLowerCase());

        String finalBody = body;
        if (sender != null && sender.getUsername() != null) {
            String name = sender.getUsername();
            finalBody = finalBody.replace("[Your Name]", name);
            finalBody = finalBody.replace("{{Your Name}}", name);
        }
        if (recipient.isPresent() && recipient.get().getUsername() != null) {
            String name = recipient.get().getUsername();
            finalBody = finalBody.replace("[Recipient's Name]", name);
            finalBody = finalBody.replace("[Recipient Name]", name);
            finalBody = finalBody.replace("{{Recipient Name}}", name);
        }

        try {
            log.info("Replying to email thread {} for user: {} to: {}", threadId, userId, to);
            String accessToken = oAuthService.getAccessToken(userId);

            // Build RFC 2822 message with threading headers
            StringBuilder rawMessage = new StringBuilder();
            rawMessage.append("To: ").append(to).append("\r\n");
            rawMessage.append("Subject: ").append(subject).append("\r\n");
            if (inReplyTo != null && !inReplyTo.isBlank()) {
                rawMessage.append("In-Reply-To: ").append(inReplyTo).append("\r\n");
                rawMessage.append("References: ").append(inReplyTo).append("\r\n");
            }
            rawMessage.append("Content-Type: text/plain; charset=utf-8\r\n\r\n");
            rawMessage.append(finalBody);

            String encodedMessage = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(rawMessage.toString().getBytes(StandardCharsets.UTF_8));

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("raw", encodedMessage);
            requestBody.put("threadId", threadId);

            restClient.post()
                    .uri("https://www.googleapis.com/gmail/v1/users/me/messages/send")
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Reply sent successfully to thread {} for user: {}", threadId, userId);

            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "REPLY_EMAIL_REQUEST",
                "payload", Map.of(
                    "to", to,
                    "subject", subject,
                    "body", finalBody,
                    "threadId", threadId,
                    "success", true
                )
            ));

            return Map.of("success", true, "message", "Reply successfully sent to " + to + " in thread " + threadId);

        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Gmail reply failed for user: {}. Thread: {}. Error: {}", userId, threadId, errMsg, e);
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "REPLY_EMAIL_REQUEST",
                "payload", Map.of(
                    "to", to,
                    "subject", subject,
                    "body", finalBody,
                    "threadId", threadId,
                    "error", errMsg
                )
            ));
            return Map.of("success", false, "message", "Failed to send reply: " + errMsg);
        }
    }
}
