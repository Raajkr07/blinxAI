package com.blink.chatservice.mcp.executor;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.mcp.registry.McpToolRegistry;
import com.blink.chatservice.mcp.tool.McpTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.*;

// Executes MCP tools with proper error handling, timeouts, and security checks.
// Separates tool execution concerns from AI orchestration.
@Service
@Slf4j
public class McpToolExecutor {

    private final McpToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;
    private final ExecutorService executorService;

    public McpToolExecutor(McpToolRegistry toolRegistry, ObjectMapper objectMapper) {
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
        // Dedicated thread pool for tool execution to prevent blocking
        this.executorService = Executors.newFixedThreadPool(10, r -> {
            Thread t = new Thread(r, "mcp-tool-executor");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Execute a tool with timeout, validation, and error handling.
     *
     * @param userId User requesting the tool execution
     * @param toolName Name of the tool to execute
     * @param argumentsJson JSON string of tool arguments
     * @return ToolExecutionResult containing success/failure and result/error
     */
    public ToolExecutionResult execute(String userId, String toolName, String argumentsJson) {
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. Tool Discovery
            McpTool tool = toolRegistry.get(toolName);
            if (tool == null) {
                log.warn("Tool not found: {} (requested by user: {})", toolName, userId);
                return ToolExecutionResult.error(AiConstants.ERROR_TOOL_NOT_FOUND);
            }

            // 2. Permission Check
            if (!tool.isAllowedForUser(userId)) {
                log.warn("Unauthorized tool access: {} by user: {}", toolName, userId);
                return ToolExecutionResult.error(AiConstants.ERROR_TOOL_UNAUTHORIZED);
            }

            // 3. Parse Arguments
            Map<Object, Object> args = parseArguments(argumentsJson);

            // 4. Execute with Timeout
            log.info("Executing tool: {} for user: {}", toolName, userId);
            Object result = executeWithTimeout(tool, userId, args);

            long duration = System.currentTimeMillis() - startTime;
            log.info("Tool {} completed in {}ms", toolName, duration);

            return ToolExecutionResult.success(result);

        } catch (TimeoutException e) {
            log.error("Tool {} timed out after {}s", toolName, AiConstants.TOOL_EXECUTION_TIMEOUT_SECONDS);
            return ToolExecutionResult.error("Operation timed out. Please try again.");
            
        } catch (IllegalArgumentException e) {
            log.warn("Invalid arguments for tool {}: {}", toolName, e.getMessage());
            return ToolExecutionResult.error("Invalid input: " + sanitizeErrorMessage(e.getMessage()));
            
        } catch (Exception e) {
            log.error("Tool {} execution failed", toolName, e);
            return ToolExecutionResult.error(AiConstants.ERROR_TOOL_EXECUTION_FAILED);
        }
    }

    private Object executeWithTimeout(McpTool tool, String userId, Map<Object, Object> args) 
            throws InterruptedException, ExecutionException, TimeoutException {
        
        Future<Object> future = executorService.submit(() -> tool.execute(userId, args));
        return future.get(AiConstants.TOOL_EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    private Map<Object, Object> parseArguments(String argumentsJson) {
        if (argumentsJson == null || argumentsJson.isBlank()) {
            return new HashMap<>();
        }
        
        try {
            return objectMapper.readValue(argumentsJson, Map.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid JSON arguments: " + e.getMessage());
        }
    }

    private String sanitizeErrorMessage(String message) {
        if (message == null) {
            return "Unknown error";
        }
        
        // Remove stack traces, SQL, file paths, etc.
        String sanitized = message
                .replaceAll("(?i)at .*?\\(.*?\\)", "")  // Stack trace lines
                .replaceAll("(?i)sql.*?:", "")           // SQL errors
                .replaceAll("[A-Za-z]:\\\\.*", "")       // Windows paths
                .replaceAll("/[a-z/]+/.*", "")           // Unix paths
                .trim();
        
        // Limit length
        if (sanitized.length() > 200) {
            sanitized = sanitized.substring(0, 200) + "...";
        }
        
        return sanitized.isEmpty() ? "Operation failed" : sanitized;
    }

    // Result of tool execution.
    public record ToolExecutionResult(boolean success, Object result, String error) {
        
        public static ToolExecutionResult success(Object result) {
            return new ToolExecutionResult(true, result, null);
        }
        
        public static ToolExecutionResult error(String errorMessage) {
            return new ToolExecutionResult(false, null, errorMessage);
        }

        public String toJson(ObjectMapper mapper) {
            try {
                if (success) {
                    return mapper.writeValueAsString(result);
                } else {
                    return mapper.writeValueAsString(Map.of("error", error));
                }
            } catch (Exception e) {
                return "{\"error\": \"Result serialization failed\"}";
            }
        }
    }
}
