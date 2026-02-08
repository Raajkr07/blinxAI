package com.blink.chatservice.user.service;

import com.blink.chatservice.config.JwtConfig;
import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.user.dto.AuthDto;
import com.blink.chatservice.user.entity.RefreshToken;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.RefreshTokenRepository;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);
    private static final Pattern PHONE_PATTERN = Pattern.compile("^(\\[\\s]?)?[6-9]\\d{9}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$");

    private final UserRepository userRepository;
    private final OtpService otpService;
    private final JwtUtil jwtUtil;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtConfig jwtConfig;
    private final CacheManager cacheManager;

    @Override
    public String requestOtp(String identifier) {
        validateIdentifier(identifier);

        if (isValidPhone(identifier)) {
            userRepository.findByPhone(identifier).orElseGet(() -> {
                // Creating a stub user so the phone number is 'reserved' immediately. 
                // Prevents race conditions if two people try to sign up with same number simultaneously.
                User stub = new User();
                stub.setPhone(identifier);
                stub.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                log.info("Created stub user for phone: {}", identifier);
                return userRepository.save(stub);
            });
        } else if (isValidEmail(identifier)) {
            String trimmed = identifier.trim().toLowerCase(Locale.ROOT);
            userRepository.findFirstByEmail(trimmed).orElseGet(() -> {
                User stub = new User();
                stub.setEmail(trimmed);
                stub.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                log.info("Created stub user for email: {}", trimmed);
                return userRepository.save(stub);
            });
        }

        return otpService.generateOtp(identifier);
    }

    @Override
    public boolean verifyOtp(String identifier, String otp) {
        boolean valid = otpService.validateOtp(identifier, otp);
        if (valid) {
            // Mark as verified for the login step
            otpService.markOtpAsVerified(identifier);
        }
        return valid;
    }

    @Override
    @Transactional
    public Map<String, String> signup(String identifier, String username, String avatarUrl, String bio, String email, String phone) {
        validateSignupDetails(identifier, email, phone);

        User user = getUserByIdentifier(identifier);
        updateUserFields(user, username, avatarUrl, bio, email, phone);

        user.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        user = userRepository.save(user);

        otpService.deleteOtp(identifier);

        if (cacheManager != null) {
            var cache = cacheManager.getCache("users_v2");
            if (cache != null) {
                cache.evict(user.getId());
            }
        }

        log.info("User signup completed for: {}", user.getId());
        String accessToken = jwtUtil.generateToken(user);
        String refreshToken = createRefreshToken(user.getId());
        return Map.of("accessToken", accessToken, "refreshToken", refreshToken);
    }

    @Override
    @Transactional
    public Map<String, String> login(AuthDto.LoginRequest loginRequest) {
        if (loginRequest == null || loginRequest.identifier() == null || loginRequest.identifier().trim().isEmpty()) {
            throw new IllegalArgumentException("Identifier is required");
        }

        User user = getUserByIdentifier(loginRequest.identifier());

        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            throw new IllegalStateException("Profile incomplete. Please complete signup first.");
        }

        // Handling two login flows: 
        // 1. One-step: OTP provided directly in login request (common mobile flow).
        // 2. Two-step: OTP verified separately, then login called (web flow).
        if (loginRequest.otp() != null && !loginRequest.otp().trim().isEmpty()) {
            boolean valid = otpService.validateOtp(loginRequest.identifier(), loginRequest.otp());
            if (!valid) throw new IllegalStateException("Invalid or expired OTP");
            
            otpService.deleteOtp(loginRequest.identifier());
        } else {
            if (!otpService.isOtpVerified(loginRequest.identifier())) {
                throw new IllegalStateException("OTP verification required. Please verify OTP first.");
            }
            
            otpService.clearVerification(loginRequest.identifier());
        }

        log.info("User login completed for: {}", user.getId());

        String accessToken = jwtUtil.generateToken(user);
        String refreshToken = createRefreshToken(user.getId());
        return Map.of("accessToken", accessToken, "refreshToken", refreshToken);
    }

    @Override
    @Transactional
    public Map<String, String> refreshAccessToken(String refreshTokenValue) {
        if (!jwtUtil.validateToken(refreshTokenValue) || !jwtUtil.isRefreshToken(refreshTokenValue))
            throw new IllegalStateException("Invalid refresh token");

        if (jwtUtil.isTokenExpired(refreshTokenValue)) throw new IllegalStateException("Refresh token expired");

        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new IllegalStateException("Refresh token not found"));

        if (!refreshToken.isValid()) throw new IllegalStateException("Refresh token is revoked or expired");

        String userId = jwtUtil.extractUserId(refreshTokenValue);
        User user = getProfile(userId);
        String newAccessToken = jwtUtil.generateToken(user);

        String newRefreshTokenValue = createRefreshToken(userId);

        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
        return Map.of("accessToken", newAccessToken, "refreshToken", newRefreshTokenValue);
    }

    @Override
    @Transactional
    public void revokeRefreshToken(String refreshTokenValue) {
        refreshTokenRepository.findByToken(refreshTokenValue).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    @Override
    public boolean userExists(String identifier) {
        if (identifier == null) return false;
        if (isValidPhone(identifier)) return userRepository.existsByPhone(identifier);
        return userRepository.existsByEmail(identifier.trim().toLowerCase(Locale.ROOT));
    }

    @Override
    @Cacheable(value = "users_v2", key = "#userId")
    public User getProfile(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Weird edge case: sometimes internal class names leak into username if registration goes wrong.
        // Sanitizing it here just in case.
        if (user.getUsername() != null && user.getUsername().contains("java.util."))
            user.setUsername("User");
        return user;
    }

    @Override
    @CachePut(value = "users_v2", key = "#userId")
    public User updateProfile(String userId, String username, String avatarUrl, String bio, String email, String phone) {
        User user = getProfile(userId);
        
        if (username != null && !username.trim().isEmpty()) {
            if (username.contains("java.util.") || username.contains("@") && !username.contains(".")) {
                 log.warn("Attempt to set invalid username: {}", username);
                 throw new IllegalArgumentException("Invalid username format");
            }
            checkUsernameUniqueness(username, userId);
            user.setUsername(username.trim());
        }
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl.trim().isEmpty() ? null : avatarUrl.trim());
        if (bio != null) user.setBio(bio.trim().isEmpty() ? null : bio.trim());
        if (email != null && !email.trim().isEmpty()) {
            checkEmailUniqueness(email, userId);
            user.setEmail(email.trim().toLowerCase(Locale.ROOT));
        }
        if (phone != null && !phone.trim().isEmpty()) {
            checkPhoneUniqueness(phone, userId);
            user.setPhone(phone.trim());
        }

        return userRepository.save(user);
    }

    @Override
    public List<User> searchUsersByContact(String query, String currentUserId) {
        String q = Optional.ofNullable(query).map(String::trim).orElse("").toLowerCase(Locale.ROOT);
        if (q.isEmpty()) return List.of();

        // Optimized DB search
        return userRepository.searchUsers(q).stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .collect(Collectors.toList());
    }

    @Override
    public List<String> getOnlineUserIds() {
        return userRepository.findByOnlineTrue().stream()
                .map(User::getId)
                .collect(Collectors.toList());
    }

    @Override
    public boolean isUserOnline(String userId) {
        return userRepository.findById(userId)
                .map(User::isOnline)
                .orElse(false);
    }

    @Override
    public String resolveUserIdFromContact(String contact) {
        if (contact == null || contact.trim().isEmpty()) {
            return null;
        }

        String trimmed = contact.trim();

        // Heuristic resolution: ID -> Username -> Phone (fuzzy) -> Email.
        // Critical for 'add by contact' feature where input format is unknown.

        if (userRepository.existsById(trimmed)) {
            return trimmed;
        }

        Optional<User> byUsername = userRepository.findByUsername(trimmed);
        if (byUsername.isPresent()) {
            return byUsername.get().getId();
        }

        String phoneCleaned = trimmed.replaceAll("[\\s-()]", "");
        Optional<User> byPhone = userRepository.findByPhone(phoneCleaned);
        if (byPhone.isPresent()) return byPhone.get().getId();

        // 3b. Fuzzy phone match: handle missing or extra +91 prefix
        if (!phoneCleaned.startsWith("+91") && phoneCleaned.length() == 10) {
            String withCountry = "+91" + phoneCleaned;
            if (userRepository.existsByPhone(withCountry)) {
                 return userRepository.findByPhone(withCountry).map(User::getId).orElse(null);
            }
        } else if (phoneCleaned.startsWith("+91") && phoneCleaned.length() == 13) {
            String withoutCountry = phoneCleaned.substring(3);
            if (userRepository.existsByPhone(withoutCountry)) {
                return userRepository.findByPhone(withoutCountry).map(User::getId).orElse(null);
            }
        }

        String emailLower = trimmed.toLowerCase(Locale.ROOT);
        return userRepository.findFirstByEmail(emailLower).map(User::getId).orElse(null);
    }

    // Helper methods

    private String createRefreshToken(String userId) {
        String token = jwtUtil.generateRefreshToken(userId);
        RefreshToken rt = new RefreshToken();
        rt.setUserId(userId);
        rt.setToken(token);
        rt.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        
        long expirationMs = jwtConfig.getRefreshExpiration();
        rt.setExpiresAt(LocalDateTime.ofInstant(
                Instant.ofEpochMilli(System.currentTimeMillis() + expirationMs),
                ZoneId.of("UTC")
        ));
        
        refreshTokenRepository.save(rt);
        return token;
    }

    private void validateIdentifier(String identifier) {
        if (!isValidPhone(identifier) && !isValidEmail(identifier))
            throw new IllegalArgumentException("Invalid phone or email format");
    }

    private void validateSignupDetails(String identifier, String email, String phone) {
        if (email != null && !EMAIL_PATTERN.matcher(email).matches())
            throw new IllegalArgumentException("Invalid email format");
        if (phone != null && !PHONE_PATTERN.matcher(phone).matches())
            throw new IllegalArgumentException("Invalid Indian phone number");
    }
    
    private void updateUserFields(User user, String username, String avatarUrl, String bio, String email, String phone) {
        if (user.getUsername() == null) user.setUsername(username);
        if (user.getAvatarUrl() == null) user.setAvatarUrl(avatarUrl);
        if (user.getBio() == null) user.setBio(bio);
        if (phone != null && user.getPhone() == null) user.setPhone(phone);
        if (email != null && user.getEmail() == null) {
            user.setEmail(email.trim().toLowerCase(Locale.ROOT));
        }
    }

    private boolean isValidPhone(String str) {
        return PHONE_PATTERN.matcher(str).matches();
    }

    private boolean isValidEmail(String str) {
        return EMAIL_PATTERN.matcher(str).matches();
    }

    private User getUserByIdentifier(String identifier) {
        if (isValidPhone(identifier)) {
            return userRepository.findByPhone(identifier)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
        } else {
            String trimmed = identifier.trim().toLowerCase(Locale.ROOT);
            return userRepository.findFirstByEmail(trimmed)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
        }
    }

    private void checkUsernameUniqueness(String username, String userId) {
        userRepository.findByUsername(username.trim())
                .filter(u -> !u.getId().equals(userId))
                .ifPresent(u -> { throw new IllegalArgumentException("Username already taken"); });
    }

    private void checkEmailUniqueness(String email, String userId) {
        String emailLower = email.trim().toLowerCase(Locale.ROOT);
        if (!isValidEmail(emailLower)) throw new IllegalArgumentException("Invalid email format");
        userRepository.findAllByEmail(emailLower).stream()
                .filter(u -> !u.getId().equals(userId))
                .findFirst()
                .ifPresent(u -> { throw new IllegalArgumentException("Email already taken"); });
    }

    private void checkPhoneUniqueness(String phone, String userId) {
        if (!isValidPhone(phone.trim())) throw new IllegalArgumentException("Invalid phone format");
        userRepository.findByPhone(phone.trim())
                .filter(u -> !u.getId().equals(userId))
                .ifPresent(u -> { throw new IllegalArgumentException("Phone already taken"); });
    }
}
