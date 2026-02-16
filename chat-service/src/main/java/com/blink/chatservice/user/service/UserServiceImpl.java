package com.blink.chatservice.user.service;

import com.blink.chatservice.config.JwtConfig;
import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.user.dto.AuthDto;
import com.blink.chatservice.user.entity.RefreshToken;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.RefreshTokenRepository;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
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
        if (!isValidPhone(identifier) && !isValidEmail(identifier)) throw new IllegalArgumentException("Invalid format");

        if (isValidPhone(identifier)) {
            userRepository.findByPhone(identifier).orElseGet(() -> {
                User user = new User();
                user.setPhone(identifier);
                user.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                return userRepository.save(user);
            });
        } else {
            String email = identifier.trim().toLowerCase(Locale.ROOT);
            userRepository.findFirstByEmail(email).orElseGet(() -> {
                User user = new User();
                user.setEmail(email);
                user.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                return userRepository.save(user);
            });
        }
        return otpService.generateOtp(identifier);
    }

    @Override
    public boolean verifyOtp(String identifier, String otp) {
        boolean valid = otpService.validateOtp(identifier, otp);
        if (valid) otpService.markOtpAsVerified(identifier);
        return valid;
    }

    @Override
    @Transactional
    public Map<String, String> signup(String identifier, String username, String avatarUrl, String bio, String email, String phone) {
        validateSignup(email, phone);
        User user = getUserByIdentifier(identifier);
        
        if (user.getUsername() == null) {
            user.setUsername(username);
            user.setUsernameManual(true);
        }
        if (user.getAvatarUrl() == null) {
            user.setAvatarUrl(avatarUrl);
            user.setAvatarManual(true);
        }
        if (user.getBio() == null) user.setBio(bio);
        if (phone != null && user.getPhone() == null) user.setPhone(phone);
        if (email != null && user.getEmail() == null) user.setEmail(email.trim().toLowerCase(Locale.ROOT));

        user.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        userRepository.save(user);
        otpService.deleteOtp(identifier);
        
        if (cacheManager != null) {
            var cache = cacheManager.getCache("users_v2");
            if (cache != null) cache.evict(user.getId());
        }

        return Map.of("accessToken", jwtUtil.generateToken(user), "refreshToken", createRefreshToken(user.getId()));
    }

    @Override
    @Transactional
    public Map<String, String> login(AuthDto.LoginRequest request) {
        if (request == null || request.identifier() == null || request.identifier().isBlank()) throw new IllegalArgumentException("Identifier required");

        User user = getUserByIdentifier(request.identifier());
        if (user.getUsername() == null || user.getUsername().isBlank()) throw new IllegalStateException("Profile incomplete");

        if (request.otp() != null && !request.otp().isBlank()) {
            if (!otpService.validateOtp(request.identifier(), request.otp())) throw new IllegalStateException("Invalid OTP");
            otpService.deleteOtp(request.identifier());
        } else {
            if (!otpService.isOtpVerified(request.identifier())) throw new IllegalStateException("OTP verification required");
            otpService.clearVerification(request.identifier());
        }

        return Map.of("accessToken", jwtUtil.generateToken(user), "refreshToken", createRefreshToken(user.getId()));
    }

    @Override
    @Transactional
    public Map<String, String> refreshAccessToken(String refreshTokenValue) {
        if (!jwtUtil.validateToken(refreshTokenValue) || !jwtUtil.isRefreshToken(refreshTokenValue) || jwtUtil.isTokenExpired(refreshTokenValue))
            throw new IllegalStateException("Invalid refresh token");

        RefreshToken rt = refreshTokenRepository.findByToken(refreshTokenValue).orElseThrow(() -> new IllegalStateException("Not found"));
        if (!rt.isValid()) throw new IllegalStateException("Revoked or expired");

        String userId = jwtUtil.extractUserId(refreshTokenValue);
        User user = getProfile(userId);
        rt.setRevoked(true);
        refreshTokenRepository.save(rt);

        return Map.of("accessToken", jwtUtil.generateToken(user), "refreshToken", createRefreshToken(userId));
    }

    @Override
    @Transactional
    public void revokeRefreshToken(String token) {
        refreshTokenRepository.findByToken(token).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        });
    }

    @Override
    public boolean userExists(String identifier) {
        if (identifier == null) return false;
        return isValidPhone(identifier) ? userRepository.existsByPhone(identifier) : userRepository.existsByEmail(identifier.trim().toLowerCase(Locale.ROOT));
    }

    @Override
    @Cacheable(value = "users_v2", key = "#userId")
    public User getProfile(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getUsername() != null && user.getUsername().contains("java.util.")) user.setUsername("User");
        return user;
    }

    @Override
    @CachePut(value = "users_v2", key = "#userId")
    public User updateProfile(String userId, String username, String avatarUrl, String bio, String email, String phone) {
        User user = getProfile(userId);
        if (username != null && !username.isBlank()) {
            if (username.contains("java.util.")) throw new IllegalArgumentException("Invalid username");
            checkUsername(username, userId);
            user.setUsername(username.trim());
            user.setUsernameManual(true);
        }
        if (avatarUrl != null) {
            user.setAvatarUrl(avatarUrl.isBlank() ? null : avatarUrl.trim());
            user.setAvatarManual(true);
        }
        if (bio != null) user.setBio(bio.isBlank() ? null : bio.trim());
        if (email != null && !email.isBlank()) {
            checkEmail(email, userId);
            user.setEmail(email.trim().toLowerCase(Locale.ROOT));
        }
        if (phone != null && !phone.isBlank()) {
            checkPhone(phone, userId);
            user.setPhone(phone.trim());
        }
        return userRepository.save(user);
    }

    @Override
    public List<User> searchUsersByContact(String query, String currentUserId) {
        String q = query != null ? query.trim().toLowerCase(Locale.ROOT) : "";
        if (q.isEmpty()) return List.of();
        return userRepository.searchUsers(q).stream().filter(u -> !u.getId().equals(currentUserId)).collect(Collectors.toList());
    }

    @Override
    public List<String> getOnlineUserIds() {
        return userRepository.findByOnlineTrue().stream().map(User::getId).collect(Collectors.toList());
    }

    @Override
    public boolean isUserOnline(String userId) {
        return userRepository.findById(userId).map(User::isOnline).orElse(false);
    }

    @Override
    public String resolveUserIdFromContact(String contact) {
        if (contact == null || contact.isBlank()) return null;
        String trimmed = contact.trim();
        if (userRepository.existsById(trimmed)) return trimmed;
        
        Optional<User> u = userRepository.findByUsername(trimmed);
        if (u.isPresent()) return u.get().getId();

        String cleanPhone = trimmed.replaceAll("[\\s-()]", "");
        u = userRepository.findByPhone(cleanPhone);
        if (u.isPresent()) return u.get().getId();

        if (cleanPhone.length() == 10) {
            u = userRepository.findByPhone("+91" + cleanPhone);
            if (u.isPresent()) return u.get().getId();
        } else if (cleanPhone.startsWith("+91") && cleanPhone.length() == 13) {
            u = userRepository.findByPhone(cleanPhone.substring(3));
            if (u.isPresent()) return u.get().getId();
        }

        return userRepository.findFirstByEmail(trimmed.toLowerCase(Locale.ROOT)).map(User::getId).orElse(null);
    }

    private String createRefreshToken(String userId) {
        String token = jwtUtil.generateRefreshToken(userId);
        RefreshToken rt = new RefreshToken();
        rt.setUserId(userId);
        rt.setToken(token);
        rt.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        rt.setExpiresAt(LocalDateTime.ofInstant(Instant.ofEpochMilli(System.currentTimeMillis() + jwtConfig.getRefreshExpiration()), ZoneId.of("UTC")));
        refreshTokenRepository.save(rt);
        return token;
    }

    private void validateSignup(String email, String phone) {
        if (email != null && !EMAIL_PATTERN.matcher(email).matches()) throw new IllegalArgumentException("Invalid email");
        if (phone != null && !PHONE_PATTERN.matcher(phone).matches()) throw new IllegalArgumentException("Invalid phone");
    }

    private boolean isValidPhone(String s) { return PHONE_PATTERN.matcher(s).matches(); }
    private boolean isValidEmail(String s) { return EMAIL_PATTERN.matcher(s).matches(); }

    private User getUserByIdentifier(String id) {
        if (isValidPhone(id)) return userRepository.findByPhone(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        return userRepository.findFirstByEmail(id.trim().toLowerCase(Locale.ROOT)).orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private void checkUsername(String name, String id) {
        userRepository.findByUsername(name.trim()).filter(u -> !u.getId().equals(id)).ifPresent(u -> { throw new IllegalArgumentException("Taken"); });
    }

    private void checkEmail(String email, String id) {
        String em = email.trim().toLowerCase(Locale.ROOT);
        if (!isValidEmail(em)) throw new IllegalArgumentException("Invalid");
        userRepository.findAllByEmail(em).stream().filter(u -> !u.getId().equals(id)).findFirst().ifPresent(u -> { throw new IllegalArgumentException("Taken"); });
    }

    private void checkPhone(String p, String id) {
        if (!isValidPhone(p.trim())) throw new IllegalArgumentException("Invalid");
        userRepository.findByPhone(p.trim()).filter(u -> !u.getId().equals(id)).ifPresent(u -> { throw new IllegalArgumentException("Taken"); });
    }
}
