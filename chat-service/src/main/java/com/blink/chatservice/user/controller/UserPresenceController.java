package com.blink.chatservice.user.controller;

import com.blink.chatservice.user.service.UserServiceImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Presence", description = "Endpoints for user online status")
public class UserPresenceController {

    private final UserServiceImpl userServiceimpl;

    @GetMapping("/online")
    @Operation(
            summary = "List online users",
            description = "Returns a list of userIds currently online. " +
                    "Frontend can periodically poll this to refresh presence."
    )
    public ResponseEntity<List<String>> listOnlineUsers() {
        List<String> userIds = userServiceimpl.getOnlineUserIds();
        return ResponseEntity.ok(userIds);
    }

    @GetMapping("/{userId}/online")
    @Operation(
            summary = "Check if a user is online",
            description = "Useful for quickly checking presence of a single user."
    )
    public ResponseEntity<Boolean> isUserOnline(@PathVariable String userId) {
        boolean online = userServiceimpl.isUserOnline(userId);
        return ResponseEntity.ok(online);
    }

    @GetMapping("/me/online")
    @Operation(
            summary = "Check current user's online status",
            description = "Mostly diagnostic; presence is driven by authentication/session."
    )
    public ResponseEntity<Boolean> amIOnline(Authentication authentication) {
        String userId = authentication.getName();
        boolean online = userServiceimpl.isUserOnline(userId);
        return ResponseEntity.ok(online);
    }
}