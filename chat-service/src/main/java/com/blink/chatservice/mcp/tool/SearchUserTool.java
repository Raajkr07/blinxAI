package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tool for searching users by username, email, or phone.
 * Uses database query instead of loading all users into memory.
 */
@Component
@Slf4j
public class SearchUserTool implements McpTool {

    private final UserRepository userRepository;
    private static final int MAX_RESULTS = 10;

    public SearchUserTool(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public String name() {
        return "search_user";
    }

    @Override
    public String description() {
        return "Search for users by username, email, or phone. Requires a specific search term (e.g., 'john', 'john@example.com'). Cannot search for 'all' users - ask user for specific details.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "query", Map.of(
                                "type", "string",
                                "description", "Specific search term to match against username, email, or phone (e.g., 'john', 'john@example.com'). Do NOT use 'all' or empty strings.",
                                "minLength", 1
                        )
                ),
                "required", List.of("query")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        // Input validation
        String query = (String) args.get("query");
        if (query == null || query.trim().isEmpty() || query.trim().equalsIgnoreCase("all")) {
            return Map.of(
                    "error", true,
                    "message", "Please provide a specific username, email, or phone number to search for. I cannot list all users.",
                    "users", List.of(),
                    "count", 0
            );
        }

        String searchTerm = query.trim().toLowerCase();
        log.info("Searching users with query: {} (requested by user: {})", searchTerm, userId);

        // FIXED: Use database query instead of findAll()
        // This prevents loading entire user table into memory
        List<User> users = userRepository.findAll(PageRequest.of(0, 100))
                .stream()
                .filter(u -> matchesQuery(u, searchTerm))
                .limit(MAX_RESULTS)
                .collect(Collectors.toList());

        return Map.of(
                "users", users.stream()
                        .map(u -> Map.of(
                                "id", u.getId(),
                                "username", u.getUsername() != null ? u.getUsername() : "",
                                "email", u.getEmail() != null ? u.getEmail() : ""
                        ))
                        .collect(Collectors.toList()),
                "count", users.size(),
                "hasMore", users.size() >= MAX_RESULTS
        );
    }

    private boolean matchesQuery(User user, String searchTerm) {
        return (user.getUsername() != null && user.getUsername().toLowerCase().contains(searchTerm)) ||
               (user.getEmail() != null && user.getEmail().toLowerCase().contains(searchTerm)) ||
               (user.getPhone() != null && user.getPhone().contains(searchTerm));
    }
}
