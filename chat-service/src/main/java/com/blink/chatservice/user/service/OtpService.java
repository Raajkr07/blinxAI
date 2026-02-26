package com.blink.chatservice.user.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Random;

@Service
public class OtpService {

    private final RedisTemplate<String, String> redisTemplate;

    public OtpService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 3;
    private static final Duration OTP_EXPIRY = Duration.ofMinutes(5);
    private static final Duration RATE_LIMIT = Duration.ofMinutes(1);
    private static final int MAX_OTPS_PER_MINUTE = 3;

    public String generateOtp(String identifier) {
        String otpKey = "otp:" + identifier;
        String attemptsKey = "otp:attempts:" + identifier;
        String rateKey = "otp:rate:" + identifier;

        Long rateCount = redisTemplate.opsForValue().increment(rateKey);
        if (rateCount == 1)
            redisTemplate.expire(rateKey, RATE_LIMIT);
        if (rateCount > MAX_OTPS_PER_MINUTE)
            throw new IllegalStateException("Too many OTP requests. Try again later.");

        String otp = String.format("%0" + OTP_LENGTH + "d", new Random().nextInt((int) Math.pow(10, OTP_LENGTH)));
        redisTemplate.opsForValue().set(otpKey, otp, OTP_EXPIRY);
        redisTemplate.opsForValue().set(attemptsKey, String.valueOf(0), OTP_EXPIRY);
        return otp;
    }

    public boolean validateOtp(String identifier, String otp) {
        String otpKey = "otp:" + identifier;
        String attemptsKey = "otp:attempts:" + identifier;

        String current = redisTemplate.opsForValue().get(attemptsKey);
        if (current == null) {
            redisTemplate.opsForValue().set(attemptsKey, "0");
        }

        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts > MAX_ATTEMPTS) {
            redisTemplate.delete(otpKey);
            throw new IllegalStateException("Max OTP attempts exceeded. Try again later.");
        }

        String storedOtp = redisTemplate.opsForValue().get(otpKey);
        if (storedOtp == null) {
            return false;
        }

        boolean valid = storedOtp.equals(otp);
        if (valid) {
            redisTemplate.delete(otpKey);
            redisTemplate.delete(attemptsKey);
        }
        return valid;
    }

    public void markOtpAsVerified(String identifier) {
        String verifiedKey = "otp:verified:" + identifier;
        redisTemplate.opsForValue().set(verifiedKey, "true", OTP_EXPIRY);
    }

    public boolean isOtpVerified(String identifier) {
        String verifiedKey = "otp:verified:" + identifier;
        String verified = redisTemplate.opsForValue().get(verifiedKey);
        return "true".equals(verified);
    }

    public void clearVerification(String identifier) {
        String verifiedKey = "otp:verified:" + identifier;
        redisTemplate.delete(verifiedKey);
    }

    public void deleteOtp(String identifier) {
        String otpKey = "otp:" + identifier;
        String attemptsKey = "otp:attempts:" + identifier;
        String verifiedKey = "otp:verified:" + identifier;
        redisTemplate.delete(otpKey);
        redisTemplate.delete(attemptsKey);
        redisTemplate.delete(verifiedKey);
    }
}
