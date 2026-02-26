package com.blink.chatservice.mcp.executor;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.mcp.registry.McpToolRegistry;
import com.blink.chatservice.mcp.tool.McpTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.*;

@Service
@Slf4j
public class McpToolExecutor {

    private final McpToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;
    private final Executor aiToolExecutor;

    public McpToolExecutor(McpToolRegistry toolRegistry, 
                           ObjectMapper objectMapper,
                           @Qualifier("aiToolExecutor") Executor aiToolExecutor) {
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
        this.aiToolExecutor = aiToolExecutor;
    }

    public ToolExecutionResult execute(String userId, String toolName, String argumentsJson) {
        if (userId == null || userId.isBlank()) {
            return ToolExecutionResult.error("User ID is required");
        }
        if (toolName == null || toolName.isBlank()) {
            return ToolExecutionResult.error("Tool name is required");
        }

        long startTime = System.currentTimeMillis();

        try {
            McpTool tool = toolRegistry.get(toolName);
            if (tool == null) {
                log.warn("Tool not found: {} (requested by user: {})", toolName, userId);
                return ToolExecutionResult.error(AiConstants.ERROR_TOOL_NOT_FOUND);
            }

            if (!tool.isAllowedForUser(userId)) {
                log.warn("Unauthorized tool access: {} by user: {}", toolName, userId);
                return ToolExecutionResult.error(AiConstants.ERROR_TOOL_UNAUTHORIZED);
            }

            Map<String, Object> args = parseArguments(argumentsJson);

            log.debug("Executing tool: {} for user: {}", toolName, userId);
            
            // Execute with timeout using the shared AI thread pool
            Object result = executeWithTimeout(tool, userId, args);

            long duration = System.currentTimeMillis() - startTime;
            log.debug("Tool {} completed in {}ms", toolName, duration);

            return ToolExecutionResult.success(result);

        } catch (TimeoutException e) {
            log.error("Tool {} timed out after {}s", toolName, AiConstants.TOOL_EXECUTION_TIMEOUT_SECONDS);
            return ToolExecutionResult.error("Operation timed out. Please try again.");

        } catch (IllegalArgumentException e) {
            log.warn("Invalid arguments for tool {}: {}", toolName, e.getMessage());
            return ToolExecutionResult.error("Invalid input: " + sanitizeErrorMessage(e.getMessage()));

        } catch (ExecutionException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            log.error("Tool {} execution failed: {}", toolName, cause.getMessage());
            return ToolExecutionResult.error(AiConstants.ERROR_TOOL_EXECUTION_FAILED);

        } catch (Exception e) {
            log.error("Tool {} execution failed", toolName, e);
            return ToolExecutionResult.error(AiConstants.ERROR_TOOL_EXECUTION_FAILED);
        }
    }

    private Object executeWithTimeout(McpTool tool, String userId, Map<String, Object> args)
            throws InterruptedException, ExecutionException, TimeoutException {

        CompletableFuture<Object> future = CompletableFuture.supplyAsync(() -> tool.execute(userId, args), aiToolExecutor);
        return future.get(AiConstants.TOOL_EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseArguments(String argumentsJson) {
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

        String sanitized = message
                .replaceAll("(?i)at .*?\\(.*?\\)", "")
                .replaceAll("(?i)sql.*?:", "")
                .replaceAll("[A-Za-z]:\\\\.*", "")
                .replaceAll("/[a-z/]+/.*", "")
                .trim();

        if (sanitized.length() > 200) {
            sanitized = sanitized.substring(0, 200) + "...";
        }

        return sanitized.isEmpty() ? "Operation failed" : sanitized;
    }

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
                    return mapper.writeValueAsString(Map.of("error", error != null ? error : "Unknown error"));
                }
            } catch (Exception e) {
                return "{\"error\": \"Result serialization failed\"}";
            }
        }
    }
}
