package com.blink.chatservice.user.controller;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Search", description = "Endpoints for searching users / contacts")
public class UserSearchController {

    private final UserService userService; // use interface

    @GetMapping("/search")
    @Operation(
            summary = "Search users by contact",
            description = "Search by username, bio or phone. " +
                    "Returns lightweight user summaries for starting direct chats."
    )
    public ResponseEntity<List<UserSummaryDto>> searchUsers(
            Authentication auth,
            @RequestParam("query") @NotBlank String query
    ) {
        try {
            String currentUserId = auth.getName();

            List<UserSummaryDto> results = userService
                    .searchUsersByContact(query, currentUserId)
                    .stream()
                    .map(user -> mapToSummary(user, currentUserId))
                    .toList();

            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    private UserSummaryDto mapToSummary(User user, String currentUserId) {
        String username = user.getUsername();
        String displayName = username;
        String maskedPhone = maskPhone(user.getPhone());

        // contact/self flags: you don't have a contacts table yet,
        // so treat all others as non-contacts and self=false (service already excludes self)
        boolean isSelf = user.getId().equals(currentUserId);
        boolean isContact = false;

        return new UserSummaryDto(
                user.getId(),
                username,
                displayName,
                maskedPhone,
                user.getAvatarUrl(),
                user.isOnline(),
                isContact,
                isSelf
        );
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return null;
        }
        String last4 = phone.substring(phone.length() - 4);
        return "****" + last4;
    }

    public record UserSummaryDto(
            String id,
            String username,
            String displayName,
            String maskedPhone,
            String avatarUrl,
            boolean online,
            boolean contact,
            boolean self
    ) {}
}
