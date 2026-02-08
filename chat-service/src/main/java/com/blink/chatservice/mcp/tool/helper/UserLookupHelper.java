package com.blink.chatservice.mcp.tool.helper;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UserLookupHelper {

    private final UserRepository userRepository;

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
            Optional<User> byEmail = userRepository.findByEmail(cleaned);
            if (byEmail.isPresent()) {
                return byEmail.get();
            }
        }

        // Try phone
        Optional<User> byPhone = userRepository.findByPhone(cleaned);
        if (byPhone.isPresent()) {
            return byPhone.get();
        }

        // Try username
        Optional<User> byUsername = userRepository.findByUsername(cleaned);
        return byUsername.orElse(null);
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
