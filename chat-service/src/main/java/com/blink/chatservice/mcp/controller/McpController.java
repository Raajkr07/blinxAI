package com.blink.chatservice.mcp.controller;

import com.blink.chatservice.mcp.registry.McpToolRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/mcp")
public class McpController {

    private final McpToolRegistry registry;

    public McpController(McpToolRegistry registry) {
        this.registry = registry;
    }

    @GetMapping("/tools")
    public List<Map<String, Object>> tools() {
        return registry.all().stream()
                .map(tool -> Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", tool.name(),
                                "description", tool.description(),
                                "parameters", tool.inputSchema()
                        )
                ))
                .toList();
    }
}

