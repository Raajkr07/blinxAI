package com.blink.chatservice.notification.serviceImpl;
import com.blink.chatservice.notification.service.EmailService;
import com.blink.chatservice.user.service.OAuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    private final RestTemplate restTemplate;
    private final SpringTemplateEngine templateEngine;
    private final OAuthService oAuthService;

    @Value("${spring.mail.brevo.api-key}")
    private String brevoApiKey;

    @Value("${spring.mail.brevo.api-url}")
    private String brevoApiUrl;

    @Value("${spring.mail.sender.email}")
    private String senderEmail;

    @Value("${spring.mail.sender.name}")
    private String senderName;

    public EmailServiceImpl(RestTemplateBuilder restTemplateBuilder, SpringTemplateEngine templateEngine, OAuthService oAuthService) {
        this.restTemplate = restTemplateBuilder.build();
        this.templateEngine = templateEngine;
        this.oAuthService = oAuthService;
    }

    @Async
    @Override
    public void sendOtpEmail(String to, String otp, String appName, String verifyUrl) {
        if (to == null || to.trim().isEmpty()) {
            log.error("Email address is null or empty");
            return;
        }
        
        if (otp == null || otp.trim().isEmpty()) {
            log.error("OTP is null or empty");
            return;
        }
        
        try {
            Context context = new Context();
            context.setVariable("otp", otp);
            context.setVariable("appName", appName);
            context.setVariable("verifyUrl", verifyUrl);
            
            String htmlContent;
            try {
                htmlContent = templateEngine.process("otp-mail", context);
            } catch (Exception e) {
                log.error("Failed to process email template 'otp-mail'. Using fallback text. Error: {}", e.getMessage());
                htmlContent = "<html><body><h2>Your OTP Code</h2><p>Your OTP code is: <strong>" + otp + "</strong></p><p>This code will expire in 10 minutes.</p></body></html>";
            }
            sendBrevoEmail(to, "Verify Your " + appName + " Account - Your OTP Code", htmlContent);
        } catch (Exception e) {
            log.error("Unexpected error sending OTP email to {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    @Override
    public void sendNewMessageEmail(String to, String preview, String appName) {
        try {
            Context context = new Context();
            context.setVariable("preview", preview);
            context.setVariable("appName", appName);
            String htmlContent = templateEngine.process("message-email", context);

            sendBrevoEmail(to, "New Message on " + appName, htmlContent);
        } catch (Exception e) {
            log.error("Unexpected error sending new message email to {}: {}", to, e.getMessage(), e);
        }
    }

    @Override
    public void sendCustomEmail(String to, String subject, String body) {
        if (to == null || to.trim().isEmpty()) {
            log.error("Email address can't be empty");
            return;
        }

        try {
            Context context = new Context();
            context.setVariable("subject", subject);
            String formattedBody = body != null ? body.replace("\n", "<br/>") : "";
            context.setVariable("bodyContent", formattedBody);

            String htmlContent;
            try {
                htmlContent = templateEngine.process("send-mail", context);
            } catch (Exception e) {
                log.error("Failed to process email template 'send-mail'. Using fallback. Error: {}", e.getMessage());
                htmlContent = "<html><body>" + formattedBody + "</body></html>";
            }

            sendBrevoEmail(to, subject, htmlContent);
            log.info("Custom email sent to {}", to);
        } catch (Exception e) {
            log.error("Unexpected error sending custom email to {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    @Override
    public void sendUserEmail(String userId, String to, String subject, String body) {
        try {
            log.info("Attempting to send Gmail for user: {} to: {}", userId, to);
            String accessToken = oAuthService.getAccessToken(userId);

            // Construct RFC 2822 message
            String rawMessage = "To: " + to + "\r\n" +
                                "Subject: " + subject + "\r\n" +
                                "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
                                body;

            String encodedMessage = Base64.getUrlEncoder().withoutPadding().encodeToString(rawMessage.getBytes(StandardCharsets.UTF_8));

            Map<String, String> requestBody = Map.of("raw", encodedMessage);

            restTemplate.postForEntity(
                    "https://www.googleapis.com/gmail/v1/users/me/messages/send",
                    new HttpEntity<>(requestBody, createGmailHeaders(accessToken)),
                    String.class
            );

            log.info("Email successfully sent via Gmail API for user: {}", userId);
        } catch (Exception e) {
            log.warn("Gmail API failed for user: {}. Falling back to Brevo. Error: {}", userId, e.getMessage());
            sendCustomEmail(to, subject, body);
        }
    }

    private HttpHeaders createGmailHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private void sendBrevoEmail(String to, String subject, String htmlContent) {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            log.error("Brevo API key is not configured. Cannot send email to: {}", to);
            return;
        }

        try {
            var headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set("api-key", brevoApiKey);

            var request = new BrevoRequest(
                new Sender(senderEmail, senderName),
                List.of(new Recipient(to)),
                subject,
                htmlContent
            );

            var entity = new HttpEntity<>(request, headers);
            restTemplate.postForEntity(brevoApiUrl, entity, String.class);
            log.info("Email sent via Brevo to: {}", to);
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Brevo API error ({}): {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw e;
        } catch (Exception e) {
            log.error("Failed to send email via Brevo to {}: {}", to, e.getMessage());
            throw e; 
        }
    }

    private record BrevoRequest(Sender sender, List<Recipient> to, String subject, String htmlContent) {}
    private record Sender(String email, String name) {}
    private record Recipient(String email) {}
}
