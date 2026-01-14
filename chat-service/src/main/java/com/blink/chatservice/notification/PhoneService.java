package com.blink.chatservice.notification;

public interface PhoneService {
    boolean sendOtpSms(String phoneNumber, String otp, String appName);
    boolean isEnabled();
}
