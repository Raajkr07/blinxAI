package com.blink.chatservice.user.controller;

import com.blink.chatservice.user.dto.UpdateProfileRequest;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "Endpoints for user profile management")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ResponseEntity<User> me(Authentication authentication) {
        String userId = authentication.getName();
        User user = userService.getProfile(userId);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/me")
    @Operation(summary = "Update current user profile")
    public ResponseEntity<User> updateProfile(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request
    ) {
        String userId = authentication.getName();
        User updated = userService.updateProfile(
                userId,
                request.getUsername(),
                request.getAvatarUrl(),
                request.getBio(),
                request.getEmail(),
                request.getPhone()
        );
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/users/{userId}")
    @Operation(summary = "Get user profile by ID")
    public ResponseEntity<User> getUserProfile(@PathVariable String userId) {
        User user = userService.getProfile(userId);
        return ResponseEntity.ok(user);
    }
}

