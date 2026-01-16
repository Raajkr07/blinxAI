package com.blink.chatservice.mcp.registry;

import com.blink.chatservice.mcp.tool.McpTool;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class McpToolRegistry {

    private final Map<String, McpTool> tools = new HashMap<>();

    public McpToolRegistry(List<McpTool> toolList) {
        toolList.forEach(tool -> tools.put(tool.name(), tool));
    }

    public void register(McpTool tool) {
        tools.put(tool.name(), tool);
    }

    public Collection<McpTool> all() {
        return tools.values();
    }

    public McpTool get(String name) {
        return tools.get(name);
    }
}
