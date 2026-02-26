package com.blink.chatservice.mcp.tool;

import java.util.Map;

public interface McpTool {
    String name();
    String description();
    Map<String, Object> inputSchema();
    Object execute(String userId, Map<String, Object> arguments);
    default boolean isAllowedForUser(String userId) {
        return true;
    }
}

