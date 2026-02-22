package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.ai.service.AiService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiService aiService;
    private final Map<String, TokenBucket> rateLimiters = new ConcurrentHashMap<>();

    @PostMapping("/chat")
    public ResponseEntity<Message> chat(Authentication auth, @RequestBody ChatRequest request) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String userId = auth.getName();

        if (request == null || request.message() == null || request.message().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String trimmed = request.message().trim();
        if (trimmed.length() > 4000) {
            return ResponseEntity.badRequest().build();
        }

        if (!isRateAllowed(userId)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }

        Conversation conversation = aiService.getOrCreateAiConversation(userId);
        Message response = aiService.processAiMessage(userId, conversation.getId(), trimmed, true);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/conversation")
    public ResponseEntity<Conversation> getConversation(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(aiService.getOrCreateAiConversation(auth.getName()));
    }

    @GetMapping("/capabilities")
    public ResponseEntity<Map<String, Object>> getCapabilities() {
        return ResponseEntity.ok(Map.of(
            "name", AiConstants.AI_USER_NAME,
            "features", java.util.List.of(
                "Natural conversation",
                "Tool execution",
                "Task extraction",
                "File generation",
                "Email drafting",
                "Search the web for current information"
            )
        ));
    }

    private boolean isRateAllowed(String userId) {
        // Evict stale entries to prevent unbounded growth
        if (rateLimiters.size() > 1000) {
            rateLimiters.clear();
        }
        return rateLimiters.computeIfAbsent(userId, k ->
            new TokenBucket(AiConstants.RATE_LIMIT_REQUESTS_PER_MINUTE, AiConstants.RATE_LIMIT_BURST_CAPACITY)
        ).tryConsume();
    }

    private static class TokenBucket {
        private final int capacity;
        private final int refillRate;
        private int tokens;
        private long lastRefill;

        public TokenBucket(int refillRate, int capacity) {
            this.refillRate = refillRate;
            this.capacity = capacity;
            this.tokens = capacity;
            this.lastRefill = System.currentTimeMillis();
        }

        public synchronized boolean tryConsume() {
            refill();
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefill;
            if (elapsed <= 0) return;
            int refill = (int) (elapsed / 60000.0 * refillRate);
            if (refill > 0) {
                tokens = Math.min(capacity, tokens + refill);
                lastRefill = now;
            }
        }
    }

    public record ChatRequest(String message) {}
}
