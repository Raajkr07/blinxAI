package com.blink.chatservice.ai.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

// Lightweight token estimator using the ~4 chars/token heuristic.
// Not exact, but accurate enough for context window management.
@Component
public class TokenEstimator {

    // English text averages ~4 chars/token, JSON/code is ~3.5
    private static final double CHARS_PER_TOKEN = 3.8;

    // Every chat message has ~4 tokens of overhead (role, delimiters, etc.)
    private static final int MESSAGE_OVERHEAD = 4;

    // Estimate tokens for a raw string
    public int estimate(String text) {
        if (text == null || text.isEmpty()) return 0;
        return (int) Math.ceil(text.length() / CHARS_PER_TOKEN);
    }

    // Estimate tokens for a single chat message (role + content + overhead)
    public int estimateMessage(Map<String, Object> message) {
        int tokens = MESSAGE_OVERHEAD;
        Object content = message.get("content");
        if (content instanceof String s) {
            tokens += estimate(s);
        }
        // tool_calls add metadata overhead
        if (message.containsKey("tool_calls")) {
            tokens += 50;
        }
        return tokens;
    }

    // Estimate total tokens for a list of messages
    public int estimateMessages(List<Map<String, Object>> messages) {
        return messages.stream().mapToInt(this::estimateMessage).sum();
    }

    // Truncate text to fit within a token budget
    public String truncate(String text, int maxTokens) {
        if (text == null) return "";
        int maxChars = (int) (maxTokens * CHARS_PER_TOKEN);
        if (text.length() <= maxChars) return text;
        return text.substring(0, maxChars) + "...[truncated]";
    }
}
