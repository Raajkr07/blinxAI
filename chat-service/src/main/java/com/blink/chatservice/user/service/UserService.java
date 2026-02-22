package com.blink.chatservice.user.service;

import com.blink.chatservice.user.dto.AuthDto;
import com.blink.chatservice.user.entity.User;
import java.util.List;
import java.util.Map;

public interface UserService {

    String  requestOtp(String identifier);
    boolean verifyOtp(String identifier, String otp);
    Map<String, String> signup(String identifier, String username, String avatarUrl, String bio, String email, String phone);
    Map<String, String> login(AuthDto.LoginRequest loginRequest);
    Map<String, String> refreshAccessToken(String refreshToken);
    void revokeRefreshToken(String refreshToken);
    String generateAndSaveRefreshToken(String userId);
    
    User getProfile(String userId);
    User updateProfile(String userId, String username, String avatarUrl, String bio, String email, String phone);
    List<User> searchUsersByContact(String query, String currentUserId);
    List<String> getOnlineUserIds();
    boolean isUserOnline(String userId);
    boolean userExists(String identifier);
    String resolveUserIdFromContact(String contact);
}
