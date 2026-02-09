package com.blink.chatservice.notification.serviceImpl;

import com.blink.chatservice.notification.service.EmailService;
import com.blink.chatservice.notification.service.NotificationService;
import com.blink.chatservice.notification.service.PhoneService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Slf4j
@Service
public class NotificationServiceImpl implements NotificationService {

    private final EmailService emailService;
    private final PhoneService phoneService;
    
    public NotificationServiceImpl(@Autowired(required = false) EmailService emailService,
                                   @Autowired(required = false) PhoneService phoneService) {
        this.emailService = emailService;
        this.phoneService = phoneService;
    }

    private static final Pattern PHONE_PATTERN = Pattern.compile("^(\\+?[0-9]{10,15}|[6-9]\\d{9})$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$");

    public boolean sendOtp(String identifier, String otp, String appName, String verifyUrl) {
        if (identifier == null || identifier.trim().isEmpty()) {
            log.error("Identifier is null or empty");
            return false;
        }

        String trimmedIdentifier = identifier.trim();

        if (isValidPhone(trimmedIdentifier)) {
            return sendOtpToPhone(trimmedIdentifier, otp, appName);
        }
        else if (isValidEmail(trimmedIdentifier)) {
            return sendOtpToEmail(trimmedIdentifier, otp, appName, verifyUrl);
        }
        else {
            log.error("Invalid identifier format: {}", maskIdentifier(trimmedIdentifier));
            return false;
        }
    }

    public boolean sendOtpToPhone(String phoneNumber, String otp, String appName) {
        if (phoneService == null || !phoneService.isEnabled()) {
            log.warn("Phone service is not available or disabled. OTP for phone {} not sent.", maskPhone(phoneNumber));
            return false;
        }

        try {
            boolean success = phoneService.sendOtpSms(phoneNumber, otp, appName);
            if (success) {
                log.info("OTP sent to phone: {}", maskPhone(phoneNumber));
            } else {
                log.error("Failed to send OTP to phone: {}", maskPhone(phoneNumber));
            }
            return success;
        } catch (Exception e) {
            log.error("Error sending OTP to phone {}: {}", maskPhone(phoneNumber), e.getMessage(), e);
            return false;
        }
    }

    public boolean sendOtpToEmail(String email, String otp, String appName, String verifyUrl) {
        if (emailService == null) {
            log.warn("Email service is not available or not configured. OTP for email {} not sent.", maskEmail(email));
            return false;
        }
        
        try {
            // Since sendOtpEmail is @Async, we can't catch exceptions directly
            // But we can validate inputs and let it run
            if (email == null || email.trim().isEmpty()) {
                log.error("Email address is null or empty");
                return false;
            }
            
            if (otp == null || otp.trim().isEmpty()) {
                log.error("OTP is null or empty");
                return false;
            }
            
            emailService.sendOtpEmail(email.trim().toLowerCase(), otp, appName, verifyUrl);
            return true;
        } catch (Exception e) {
            log.error("Error queuing OTP email to {}: {}", maskEmail(email), e.getMessage(), e);
            return false;
        }
    }

    public boolean isValidPhone(String identifier) {
        if (identifier == null || identifier.trim().isEmpty()) {
            return false;
        }
        String cleaned = identifier.replaceAll("[\\s-()]", "");
        return PHONE_PATTERN.matcher(cleaned).matches();
    }

    public boolean isValidEmail(String identifier) {
        if (identifier == null || identifier.trim().isEmpty()) {
            return false;
        }
        return EMAIL_PATTERN.matcher(identifier.trim().toLowerCase()).matches();
    }

    public String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return "****";
        }
        if (phone.length() <= 6) {
            return "****" + phone.substring(phone.length() - 2);
        }
        return phone.substring(0, 2) + "****" + phone.substring(phone.length() - 2);
    }

    public String maskEmail(String email) {
        if (email == null || email.length() < 5) {
            return "****";
        }
        int atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return "****";
        }
        String localPart = email.substring(0, atIndex);
        String domain = email.substring(atIndex);
        
        if (localPart.length() <= 2) {
            return "**" + domain;
        }
        return localPart.substring(0, 2) + "****" + domain;
    }

    public String maskIdentifier(String identifier) {
        if (identifier == null || identifier.length() < 4) {
            return "****";
        }
        if (isValidEmail(identifier)) {
            return maskEmail(identifier);
        } else {
            return maskPhone(identifier);
        }
    }
}
