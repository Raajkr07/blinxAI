package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class SearchUserTool implements McpTool {

    private final UserRepository userRepository;

    public SearchUserTool(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public String name() {
        return "search_user";
    }

    @Override
    public String description() {
        return "Search for users by username, email, or phone";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "query", Map.of("type", "string")
                ),
                "required", List.of("query")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String query = (String) args.get("query");
        List<User> users = userRepository.findAll().stream()
                .filter(u -> (u.getUsername() != null && u.getUsername().contains(query)) ||
                        (u.getEmail() != null && u.getEmail().contains(query)) ||
                        (u.getPhone() != null && u.getPhone().contains(query)))
                .collect(Collectors.toList());

        return users.stream()
                .map(u -> Map.of(
                        "id", u.getId(),
                        "username", u.getUsername(),
                        "email", u.getEmail()
                ))
                .collect(Collectors.toList());
    }
}
