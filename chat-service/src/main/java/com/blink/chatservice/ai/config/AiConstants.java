package com.blink.chatservice.ai.config;

public final class AiConstants {
    
    private AiConstants() {
        throw new UnsupportedOperationException("Utility class");
    }

    // AI User Identity
    public static final String AI_USER_ID = "ai-assistant";
    public static final String AI_USER_NAME = "Blinx";

    // Tool Execution Limits
    public static final int MAX_TOOL_ITERATIONS = 5;
    public static final int TOOL_EXECUTION_TIMEOUT_SECONDS = 30;

    // Conversation Context
    public static final int MAX_HISTORY_MESSAGES = 20;
    public static final int MAX_SYSTEM_PROMPT_LENGTH = 5000;

    // Context Window Optimization (sliding window approach)
    // Last N messages are sent in full, older ones get truncated to save tokens
    public static final int RECENT_MESSAGES_VERBATIM = 6;
    public static final int TRUNCATED_MESSAGE_MAX_TOKENS = 50;
    public static final int MAX_TOOL_RESULT_TOKENS = 3000;

    // AI API Configuration
    public static final int DEFAULT_MAX_TOKENS = 1500;
    public static final double DEFAULT_TEMPERATURE = 0.7;
    public static final int AI_API_TIMEOUT_SECONDS = 60;
    public static final int AI_API_RETRY_ATTEMPTS = 3;
    public static final long AI_API_RETRY_DELAY_MS = 1000;

    // Error Messages (User-Facing)
    public static final String ERROR_TOOL_NOT_FOUND = "The requested action is not available.";
    public static final String ERROR_TOOL_UNAUTHORIZED = "You don't have permission to perform this action.";
    public static final String ERROR_TOOL_EXECUTION_FAILED = "Unable to complete the action. Please try again.";
    public static final String ERROR_AI_API_FAILED = "AI service is temporarily unavailable. Please try again later.";
    public static final String ERROR_MAX_ITERATIONS = "Request too complex. Please simplify and try again.";
    public static final String ERROR_RATE_LIMIT = "Too many requests. Please wait a moment and try again.";
}
