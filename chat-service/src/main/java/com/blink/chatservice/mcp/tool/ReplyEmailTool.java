package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.service.OAuthService;
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
    private final UserLookupHelper userLookupHelper;
    private final RestClient restClient = RestClient.create();

    @Override
    public String name() {
        return "reply_email";
    }

    @Override
    public String description() {
        return "Reply to a Gmail email thread. Match the tone of the original email. Write naturally in Indian English, not like a robot.";
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
                    "Reply content in natural Indian English. Match the sender's tone — casual reply to casual email, formal to formal. Keep it brief (2-5 lines). No boilerplate. Use [Recipient Name] and [Your Name] as placeholders."),
                "inReplyTo", Map.of("type", "string", "description", "Original Message-ID header for threading")
            ),
            "required", List.of("threadId", "to", "subject", "body")
        );
    }

    @Override
    public Map<String, Object> execute(String userId, Map<String, Object> arguments) {
        String threadId = (String) arguments.get("threadId");
        String to = (String) arguments.get("to");
        String subject = (String) arguments.getOrDefault("subject", "(No Subject)");
        String body = (String) arguments.getOrDefault("body", "");
        String inReplyTo = (String) arguments.get("inReplyTo");

        if (to == null || to.isBlank()) {
            return Map.of("success", false, "message", "Recipient (to) is required.");
        }
        if (threadId == null || threadId.isBlank()) {
            return Map.of("success", false, "message", "Thread ID is required for replying.");
        }

        // Resolve name placeholders using helper
        String finalBody = userLookupHelper.resolveNamePlaceholders(body, userId, to);

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

        } catch (IllegalArgumentException e) {
            // No Google credentials linked
            log.warn("No Google credentials for user {}: {}", userId, e.getMessage());
            return Map.of("success", false,
                "message", "You don't have permission to send emails. Please link your Google account in Settings to grant email access.",
                "error_type", "PERMISSION_DENIED");
        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Gmail reply failed for user: {}. Thread: {}. Error: {}", userId, threadId, errMsg, e);

            // Check for permission/auth errors from Google API
            if (isPermissionError(errMsg)) {
                messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                    "type", "REPLY_EMAIL_REQUEST",
                    "payload", Map.of(
                        "to", to,
                        "subject", subject,
                        "error", "Permission denied"
                    )
                ));
                return Map.of("success", false,
                    "message", "You don't have permission to send emails. Please re-link your Google account in Settings to grant email access.",
                    "error_type", "PERMISSION_DENIED");
            }

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

    private boolean isPermissionError(String errMsg) {
        return errMsg.contains("403") || errMsg.contains("401")
                || errMsg.contains("Forbidden") || errMsg.contains("insufficient")
                || errMsg.contains("Unauthorized") || errMsg.contains("No Google credentials")
                || errMsg.contains("PERMISSION_DENIED") || errMsg.contains("access_denied");
    }
}
