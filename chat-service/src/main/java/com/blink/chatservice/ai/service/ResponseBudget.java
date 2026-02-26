package com.blink.chatservice.ai.service;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class ResponseBudget {

    public enum Tier {
        // Greetings, acknowledgments, single-line answers
        CONCISE(200),
        // Normal chat, short Q&A, capability questions
        STANDARD(500),
        // Tool-calling responses, summaries, web search results
        DETAILED(1000),
        // User explicitly asked for long/detailed output
        EXTENDED(2000);

        private final int maxTokens;

        Tier(int maxTokens) {
            this.maxTokens = maxTokens;
        }

        public int maxTokens() {
            return maxTokens;
        }
    }

    // Patterns for detecting explicit "give me detail" requests
    private static final Pattern DETAIL_REQUEST = Pattern.compile(
        "\\b(detail(ed)?|in\\s+detail|explain|elaborate|comprehensive|thorough|" +
        "at\\s+least\\s+\\d+\\s+words?|\\d+\\s+words?|essay|paragraph|long\\s+(answer|response)|" +
        "write\\s+me\\s+a|full\\s+(explanation|answer|report))\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Patterns for simple/concise Q&A (yes/no questions, definitions, etc.)
    private static final Pattern SIMPLE_QUESTION = Pattern.compile(
        "^(what\\s+is|who\\s+is|when\\s+(is|was|did)|where\\s+is|is\\s+it|can\\s+you|do\\s+you|" +
        "tell\\s+me\\s+(the|a)\\s+\\w+|define|meaning\\s+of)\\b",
        Pattern.CASE_INSENSITIVE
    );

    public Tier determine(String message, boolean isConversational, boolean hasTools) {
        if (message == null || message.isBlank()) return Tier.STANDARD;

        // Conversational → tight budget (greetings don't need long answers)
        if (isConversational) {
            return Tier.CONCISE;
        }

        // User explicitly asked for detail / length → allow full budget
        if (DETAIL_REQUEST.matcher(message).find()) {
            return Tier.EXTENDED;
        }

        // Tool-calling scenarios (email compose, calendar, search) need more room
        if (hasTools) {
            return Tier.DETAILED;
        }

        // Simple factual questions
        if (SIMPLE_QUESTION.matcher(message.trim()).find()) {
            return Tier.STANDARD;
        }

        // Default: moderate budget
        return Tier.STANDARD;
    }

    public int maxTokens(String message, boolean isConversational, boolean hasTools) {
        return determine(message, isConversational, hasTools).maxTokens();
    }
}
