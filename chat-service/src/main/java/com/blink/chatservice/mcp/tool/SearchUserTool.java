package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SearchUserTool implements McpTool {

    private final UserRepository userRepository;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "search_user";
    }

    @Override
    public String description() {
        return "Find a BlinX user by name, email, or phone. Use this before sending messages or starting conversations.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "query", Map.of("type", "string", "description", "Name, email, or phone to search for")
            ),
            "required", List.of("query")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String query = (String) args.get("query");
        if (query == null || query.isBlank()) {
            return Map.of("success", false, "message", "What should I search for? Give me a name, email, or phone number.");
        }

        // Prevent overly broad searches
        String trimmed = query.trim().toLowerCase();
        if (trimmed.equalsIgnoreCase("all") || trimmed.length() < 2) {
            return Map.of("success", false,
                "message", "Search query too short. Please provide at least 2 characters.",
                "users", List.of());
        }

        try {
            List<User> users = userRepository.searchUsers(trimmed);
            List<Map<String, Object>> list = users.stream()
                .limit(10)
                .map(userLookupHelper::getUserInfoMap)
                .toList();

            if (list.isEmpty()) {
                return Map.of("success", true, "users", List.of(), "count", 0,
                    "message", "No users found for '" + query.trim() + "'. Try a different spelling or their email.");
            }

            return Map.of("success", true, "users", list, "count", list.size());

        } catch (Exception e) {
            log.error("User search failed for query '{}' by user {}: {}", query, userId, e.getMessage(), e);
            return Map.of("success", false, "message", "Search failed. Please try again.");
        }
    }
}
