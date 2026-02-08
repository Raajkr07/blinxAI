package com.blink.chatservice.user.service;

import com.blink.chatservice.config.JwtConfig;
import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.RefreshTokenRepository;
import com.blink.chatservice.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private OtpService otpService;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private JwtConfig jwtConfig;
    @Mock
    private CacheManager cacheManager;

    @InjectMocks
    private UserServiceImpl userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("test-id");
        testUser.setPhone("9876543210");
        testUser.setUsername("testuser");
    }

    @Test
    void requestOtp_withValidPhone_shouldSaveUserAndGenerateOtp() {
        String phone = "9876543210";
        when(userRepository.findByPhone(phone)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(otpService.generateOtp(phone)).thenReturn("123456");

        String otp = userService.requestOtp(phone);

        assertEquals("123456", otp);
        verify(userRepository).save(any(User.class));
        verify(otpService).generateOtp(phone);
    }

    @Test
    void requestOtp_withInvalidIdentifier_shouldThrowException() {
        String invalid = "invalid";

        assertThrows(IllegalArgumentException.class, () -> userService.requestOtp(invalid));
    }

    @Test
    void getProfile_withExistingUser_shouldReturnUser() {
        when(userRepository.findById("test-id")).thenReturn(Optional.of(testUser));

        User result = userService.getProfile("test-id");

        assertNotNull(result);
        assertEquals("testuser", result.getUsername());
    }

    @Test
    void getProfile_withNonExistingUser_shouldThrowException() {
        when(userRepository.findById("non-existent")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> userService.getProfile("non-existent"));
    }
}
