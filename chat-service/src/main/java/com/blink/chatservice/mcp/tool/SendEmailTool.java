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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
@Slf4j
public class SendEmailTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;
    private final OAuthService oAuthService;
    private final UserService userService;
    private final UserRepository userRepository;
    private final RestClient restClient = RestClient.create();

    @Override
    public String name() {
        return "send_email";
    }

    @Override
    public String description() {
        return "Send a professional, human-like email using Gmail. " +
               "When generating content, use 'Indian English' nuances, avoid generic boilerplate, " +
               "and write interesting, connecting content that resonates with the receiver. " +
               "If the user says 'write as you like', be creative, warm, and professional.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "to", Map.of("type", "string", "description", "Recipient email"),
                "subject", Map.of("type", "string", "description", "A catchy, relevant subject line in professional Indian English"),
                "body", Map.of("type", "string", "description", "The email content. Should be human-like, engaging, and professional. Use [Recipient Name] and [Your Name] for placeholders. Avoid robotic phrasing.")
            ),
            "required", List.of("to", "subject", "body")
        );
    }

    @Override
    public Map<String, Object> execute(String userId, Map<Object, Object> arguments) {
        String to = (String) arguments.get("to");
        String subject = (String) arguments.getOrDefault("subject", "(No Subject)");
        String body = (String) arguments.getOrDefault("body", "");

        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("Recipient is required");
        }

        // Resolve names for placeholders
        User sender = userService.getProfile(userId);
        Optional<User> recipient = userRepository.findFirstByEmail(to.trim().toLowerCase());
        
        String finalBody = body;
        if (sender != null && sender.getUsername() != null) {
            String name = sender.getUsername();
            finalBody = finalBody.replace("[Your Name]", name);
            finalBody = finalBody.replace("[Your Name Member]", name);
            finalBody = finalBody.replace("{{Your Name}}", name);
        }
        
        if (recipient.isPresent() && recipient.get().getUsername() != null) {
            String name = recipient.get().getUsername();
            finalBody = finalBody.replace("[Recipient's Name]", name);
            finalBody = finalBody.replace("[Recipient Name]", name);
            finalBody = finalBody.replace("{{Recipient Name}}", name);
        }

        try {
            log.info("Attempting to send Gmail for user: {} to: {}", userId, to);
            String accessToken = oAuthService.getAccessToken(userId);

            // Construct RFC 2822 message
            String rawMessage = "To: " + to + "\r\n" +
                              "Subject: " + subject + "\r\n" +
                              "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
                              finalBody;

            String encodedMessage = Base64.getUrlEncoder().withoutPadding().encodeToString(rawMessage.getBytes(StandardCharsets.UTF_8));

            Map<String, String> requestBody = Map.of("raw", encodedMessage);

            restClient.post()
                    .uri("https://www.googleapis.com/gmail/v1/users/me/messages/send")
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Email successfully sent via Gmail API for user: {}", userId);
            
            // Always notify frontend for preview/history
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "SEND_EMAIL_REQUEST",
                "payload", Map.of(
                    "to", to,
                    "subject", subject,
                    "body", finalBody,
                    "success", true
                )
            ));

            return Map.of("success", true, "message", "Email successfully sent to " + to);
        } catch (Exception e) {
            log.error("Gmail API send failed for user: {}. Error: {}", userId, e.getMessage(), e);
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "SEND_EMAIL_REQUEST",
                "payload", Map.of(
                    "to", to,
                    "subject", subject,
                    "body", finalBody,
                    "error", e.getMessage()
                )
            ));
            return Map.of("success", false, "message", "Failed to send email: " + e.getMessage());
        }
    }
}
