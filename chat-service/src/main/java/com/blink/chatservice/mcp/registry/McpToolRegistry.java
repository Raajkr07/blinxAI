package com.blink.chatservice.mcp.registry;

import com.blink.chatservice.mcp.tool.McpTool;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.Map;

@Component
public class McpToolRegistry {

    // Switched to ConcurrentHashMap. 
    // Although mostly initialized at startup, the presence of a 'register' 
    // method implies potential dynamic modification which must be thread-safe.
    private final Map<String, McpTool> tools = new ConcurrentHashMap<>();

    public McpToolRegistry(List<McpTool> toolList) {
        if (toolList != null) {
            toolList.forEach(tool -> tools.put(tool.name(), tool));
        }
    }

    public void register(McpTool tool) {
        if (tool != null) {
            tools.put(tool.name(), tool);
        }
    }

    public Collection<McpTool> all() {
        return tools.values();
    }

    public McpTool get(String name) {
        if (name == null) return null;
        return tools.get(name);
    }
}
