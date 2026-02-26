package com.blink.chatservice.mcp.tool.helper;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UserLookupHelper {

    private final UserRepository userRepository;
    private final UserService userService;

    // Find user by email, username, phone, or ID
    public User findUserByIdentifier(String identifier) {
        if (identifier == null || identifier.trim().isEmpty()) {
            return null;
        }

        String cleaned = identifier.trim();

        // Try ID first (most common)
        Optional<User> byId = userRepository.findById(cleaned);
        if (byId.isPresent()) {
            return byId.get();
        }

        // Try email if it looks like one
        if (cleaned.contains("@")) {
            Optional<User> byEmail = userRepository.findByEmail(cleaned.toLowerCase(Locale.ROOT));
            if (byEmail.isPresent()) {
                return byEmail.get();
            }
        }

        // Try phone
        Optional<User> byPhone = userRepository.findByPhone(cleaned);
        if (byPhone.isPresent()) {
            return byPhone.get();
        }

        // Try username (findFirst to handle duplicate usernames safely)
        Optional<User> byUsername = userRepository.findFirstByUsername(cleaned);
        return byUsername.orElse(null);
    }

    // Resolve user by identifier with fallback to contact search
    public User resolveUser(String identifier, String currentUserId) {
        User u = findUserByIdentifier(identifier);
        if (u != null) return u;
        List<User> users = userService.searchUsersByContact(identifier, currentUserId);
        return users.isEmpty() ? null : users.get(0);
    }

    // Replace common name placeholders in email templates
    public String resolveNamePlaceholders(String text, String senderId, String recipientEmail) {
        if (text == null || text.isBlank()) return text;
        String result = text;

        User sender = userRepository.findById(senderId).orElse(null);
        if (sender != null && sender.getUsername() != null) {
            result = result.replace("[Your Name]", sender.getUsername())
                    .replace("[Your Name Member]", sender.getUsername())
                    .replace("{{Your Name}}", sender.getUsername());
        }

        if (recipientEmail != null && !recipientEmail.isBlank()) {
            // Added toLowerCase() for email lookup consistent with system normalization.
            User recipient = userRepository.findByEmail(recipientEmail.trim().toLowerCase(Locale.ROOT)).orElse(null);
            if (recipient != null && recipient.getUsername() != null) {
                result = result.replace("[Recipient's Name]", recipient.getUsername())
                        .replace("[Recipient Name]", recipient.getUsername())
                        .replace("{{Recipient Name}}", recipient.getUsername());
            }
        }

        return result;
    }

    public Map<String, Object> getUserInfo(String userId) {
        if (userId == null) {
            return Map.of("id", "unknown", "username", "Unknown User");
        }

        Optional<User> user = userRepository.findById(userId);
        if (user.isEmpty()) {
            return Map.of("id", userId, "username", "Unknown User");
        }

        return getUserInfoMap(user.get());
    }

    public Map<String, Map<String, Object>> getUserInfoBatch(Collection<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyMap();
        }

        List<User> users = userRepository.findAllById(userIds);
        
        return users.stream()
                .collect(Collectors.toMap(
                        User::getId,
                        this::getUserInfoMap
                ));
    }

    public Map<String, Object> getUserInfoMap(User user) {
        Map<String, Object> info = new HashMap<>();
        info.put("id", user.getId());
        info.put("username", user.getUsername() != null ? user.getUsername() : "");
        info.put("email", user.getEmail() != null ? user.getEmail() : "");
        info.put("phone", user.getPhone() != null ? user.getPhone() : "");
        info.put("online", user.isOnline());
        
        // Display name priority: username > email > phone > id
        String displayName = user.getUsername();
        if (displayName == null || displayName.isEmpty()) {
            displayName = user.getEmail();
        }
        if (displayName == null || displayName.isEmpty()) {
            displayName = user.getPhone();
        }
        if (displayName == null || displayName.isEmpty()) {
            displayName = user.getId();
        }
        
        info.put("displayName", displayName);
        
        return info;
    }
}
