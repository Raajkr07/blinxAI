package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SearchUserTool implements McpTool {

    private final UserRepository userRepository;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "search_user";
    }

    @Override
    public String description() {
        return "Search for users by username, email, or phone.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "query", Map.of("type", "string", "description", "Term to search")
            ),
            "required", List.of("query")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String query = (String) args.get("query");
        if (query == null || query.isBlank() || query.equalsIgnoreCase("all")) {
            return Map.of("error", true, "message", "Provide a search term", "users", List.of());
        }

        List<User> users = userRepository.searchUsers(query.trim().toLowerCase());
        List<Map<String, Object>> list = users.stream().limit(10).map(userLookupHelper::getUserInfoMap).toList();

        return Map.of("users", list, "count", list.size());
    }
}
