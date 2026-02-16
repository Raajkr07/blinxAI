package com.blink.chatservice.notification.service;

public interface EmailService {
    void sendOtpEmail(String to, String otp, String appName, String verifyUrl);
    void sendNewMessageEmail(String to, String preview, String appName);
    void sendCustomEmail(String to, String subject, String body);
    void sendUserEmail(String userId, String to, String subject, String body);
}
