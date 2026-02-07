package com.blink.chatservice.notification.serviceImpl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;


@RequiredArgsConstructor
@Slf4j
@Service
public class EmailServiceImpl {

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine templateEngine;

    @Async
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
            if (mailSender == null) {
                log.error("JavaMailSender is not configured. Cannot send email to: {}", to);
                return;
            }
            
            if (templateEngine == null) {
                log.error("SpringTemplateEngine is not configured. Cannot send email to: {}", to);
                return;
            }
            
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(to.trim().toLowerCase());
            helper.setSubject("Verify Your " + appName + " Account - Your OTP Code");

            Context context = new Context();
            context.setVariable("otp", otp);
            context.setVariable("appName", appName);
            context.setVariable("verifyUrl", verifyUrl);
            
            String htmlContent;
            try {
                htmlContent = templateEngine.process("otp-mail", context);
            } catch (Exception e) {
                // If template engine fails for some reason, we send a basic HTML fallback. 
                // Better than failing the whole user flow.
                log.error("Failed to process email template 'otp-mail'. Using fallback text. Error: {}", e.getMessage());
                htmlContent = "<html><body><h2>Your OTP Code</h2><p>Your OTP code is: <strong>" + otp + "</strong></p><p>This code will expire in 10 minutes.</p></body></html>";
            }

            helper.setText(htmlContent, true);
            mailSender.send(mimeMessage);
        } catch (MessagingException | MailException e) {
            log.error("Failed to send OTP email to {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error sending OTP email to {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    public void sendNewMessageEmail(String to, String preview, String appName) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject("New Message on " + appName);

            Context context = new Context();
            context.setVariable("preview", preview);
            context.setVariable("appName", appName);
            String htmlContent = templateEngine.process("message-email", context);

            helper.setText(htmlContent, true);
            mailSender.send(mimeMessage);
        } catch (MessagingException | MailException e) {
            log.error("Failed to send new message email to {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error sending new message email to {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    public void sendCustomEmail(String to, String subject, String body) {
        if (to == null || to.trim().isEmpty()) {
            log.error("Email address can't be empty");
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            
            Context context = new Context();
            context.setVariable("subject", subject);
            // Convert newlines to breaks for HTML display, if raw text
            String formattedBody = body != null ? body.replace("\n", "<br/>") : "";
            context.setVariable("bodyContent", formattedBody);

            String htmlContent;
            try {
                htmlContent = templateEngine.process("send-mail", context);
            } catch (Exception e) {
                log.error("Failed to process email template 'send-mail'. Using fallback. Error: {}", e.getMessage());
                htmlContent = "<html><body>" + formattedBody + "</body></html>";
            }

            helper.setText(htmlContent, true);
            mailSender.send(mimeMessage);
            log.info("Custom email sent to {}", to);
        } catch (MessagingException | MailException e) {
            log.error("Failed to send custom email to {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error sending custom email to {}: {}", to, e.getMessage(), e);
        }
    }
}
