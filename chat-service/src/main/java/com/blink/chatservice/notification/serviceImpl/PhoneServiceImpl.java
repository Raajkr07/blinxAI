package com.blink.chatservice.notification.serviceImpl;

import com.blink.chatservice.notification.service.PhoneService;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Implementation of PhoneService using HTTP-based SMS providers
 * Supports Twilio, AWS SNS, or any HTTP-based SMS gateway
 */
@Slf4j
@Service
public class PhoneServiceImpl implements PhoneService {

    @Value("${app.sms.enabled:false}")
    private boolean smsEnabled;

    @Value("${app.sms.provider:twilio}")
    private String smsProvider;

    // Twilio Configuration
    @Value("${app.sms.twilio.account-sid:}")
    private String twilioAccountSid;

    @Value("${app.sms.twilio.auth-token:}")
    private String twilioAuthToken;

    @Value("${app.sms.twilio.from-number:}")
    private String twilioFromNumber;

    // AWS SNS Configuration
    @Value("${app.sms.aws.access-key:}")
    private String awsAccessKey;

    @Value("${app.sms.aws.secret-key:}")
    private String awsSecretKey;

    @Value("${app.sms.aws.region:us-east-1}")
    private String awsRegion;

    // Generic HTTP SMS Gateway Configuration
    @Value("${app.sms.generic.url:}")
    private String genericSmsUrl;

    @Value("${app.sms.generic.api-key:}")
    private String genericApiKey;

    @Value("${app.sms.generic.sender-id:}")
    private String genericSenderId;

    private final ExecutorService httpExecutor;
    private final HttpClient httpClient;

    public PhoneServiceImpl() {
        // Fixed-size pool prevents unbounded thread creation from HttpClient's default cached pool
        this.httpExecutor = Executors.newFixedThreadPool(2, r -> {
            Thread t = new Thread(r, "sms-http");
            t.setDaemon(true);
            return t;
        });
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .executor(httpExecutor)
                .build();
    }

    @PreDestroy
    public void shutdown() {
        httpExecutor.shutdownNow();
    }

    @Override
    public boolean isEnabled() {
        return smsEnabled;
    }

    @Override
    public boolean sendOtpSms(String phoneNumber, String otp, String appName) {
        if (!smsEnabled) {
            log.warn("SMS service is disabled. OTP for phone {} not sent.", maskPhone(phoneNumber));
            return false;
        }

        try {
            // Format phone number (ensure it starts with +)
            String formattedPhone = formatPhoneNumber(phoneNumber);
            // Create SMS message
            String message = String.format("Your %s verification code is: %s. Valid for 5 minutes.", appName, otp);

            boolean success = false;
            switch (smsProvider.toLowerCase()) {
                case "twilio" -> success = sendViaTwilio(formattedPhone, message);
                case "aws", "sns" -> success = sendViaAwsSns(formattedPhone, message);
                case "generic", "http" -> success = sendViaGenericHttp(formattedPhone, message);
                default -> {
                    log.error("Unknown SMS provider: {}", smsProvider);
                    return false;
                }
            }

            if (success) log.info("OTP SMS sent successfully to: {}", maskPhone(formattedPhone));
              else log.error("Failed to send OTP SMS to: {}", maskPhone(formattedPhone));
            return success;

        } catch (Exception e) {
            log.error("Error sending OTP SMS to {}: {}", maskPhone(phoneNumber), e.getMessage(), e);
            return false;
        }
    }

    private boolean sendViaTwilio(String phoneNumber, String message) {
        if (twilioAccountSid == null || twilioAccountSid.isEmpty() ||
            twilioAuthToken == null || twilioAuthToken.isEmpty() ||
            twilioFromNumber == null || twilioFromNumber.isEmpty()) {
            log.error("Twilio configuration is incomplete");
            return false;
        }

        String normalizedFrom = normalizePhoneNumber(twilioFromNumber);
        String normalizedTo = normalizePhoneNumber(phoneNumber);

        if (normalizedFrom.equals(normalizedTo)) {
            log.error("Twilio 'From' number ({}) cannot be the same as recipient 'To' number ({}). " +
                    "Please configure a different Twilio phone number as the 'From' number.",
                    maskPhone(twilioFromNumber), maskPhone(phoneNumber));
            return false;
        }

        try {
            String url = String.format("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
                    twilioAccountSid);

            String body = String.format(
                    "From=%s&To=%s&Body=%s",
                    encode(twilioFromNumber),
                    encode(phoneNumber),
                    encode(message)
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("Authorization", "Basic " + Base64.getEncoder()
                            .encodeToString((twilioAccountSid + ":" + twilioAuthToken).getBytes(StandardCharsets.UTF_8)))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.debug("Twilio SMS sent successfully. Response: {}", response.body());
                return true;
            } else {
                log.error("Twilio SMS failed. Status: {}, Response: {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Error sending SMS via Twilio: {}", e.getMessage(), e);
            return false;
        }
    }

    private boolean sendViaAwsSns(String phoneNumber, String message) {
        if (awsAccessKey == null || awsAccessKey.isEmpty() ||
            awsSecretKey == null || awsSecretKey.isEmpty()) {
            log.error("AWS SNS configuration is incomplete");
            return false;
        }

        try {
            // TODO: Implement AWS SNS using AWS SDK
            log.info("Would send SMS via AWS SNS to: {} with message: {}", maskPhone(phoneNumber), message);
            return true;
        } catch (Exception e) {
            log.error("Error sending SMS via AWS SNS: {}", e.getMessage(), e);
            return false;
        }
    }

    private boolean sendViaGenericHttp(String phoneNumber, String message) {
        if (genericSmsUrl == null || genericSmsUrl.isEmpty()) {
            log.error("Generic SMS gateway URL is not configured");
            return false;
        }

        try {
            Map<String, String> params = new HashMap<>();
            params.put("phone", phoneNumber);
            params.put("message", message);
            if (genericApiKey != null && !genericApiKey.isEmpty()) {
                params.put("api_key", genericApiKey);
            }
            if (genericSenderId != null && !genericSenderId.isEmpty()) {
                params.put("sender_id", genericSenderId);
            }

            StringBuilder bodyBuilder = new StringBuilder();
            params.forEach((key, value) -> {
                if (!bodyBuilder.isEmpty()) {
                    bodyBuilder.append("&");
                }
                bodyBuilder.append(encode(key)).append("=").append(encode(value));
            });

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(genericSmsUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(bodyBuilder.toString()))
                    .timeout(Duration.ofSeconds(30));

            if (genericApiKey != null && !genericApiKey.isEmpty()) {
                requestBuilder.header("X-API-Key", genericApiKey);
            }

            HttpRequest request = requestBuilder.build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.debug("Generic SMS sent successfully. Response: {}", response.body());
                return true;
            } else {
                log.error("Generic SMS failed. Status: {}, Response: {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Error sending SMS via generic HTTP gateway: {}", e.getMessage(), e);
            return false;
        }
    }

    private String formatPhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) return phoneNumber;

        String cleaned = phoneNumber.trim().replaceAll("[\\s-()]", "");

        if (!cleaned.startsWith("+")) cleaned = "+91" + cleaned;
        return cleaned;
    }

    private String normalizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null) return "";
        String normalized = phoneNumber.replaceAll("[^+\\d]", "");
        if (!normalized.startsWith("+")) normalized = "+" + normalized.replaceAll("\\D", "");
        return normalized;
    }

    private String encode(String value) {
        if (value == null) return "";
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(0, 2) + "****" + phone.substring(phone.length() - 2);
    }
}
