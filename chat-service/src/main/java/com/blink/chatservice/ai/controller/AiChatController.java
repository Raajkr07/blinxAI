package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.ai.service.AiService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "AI Chat", description = "Endpoints for AI Assistant interactions with autonomous tool execution")
public class AiChatController {

    private final AiService aiService;
    
    // Simple in-memory rate limiter
    private final Map<String, RateLimitBucket> rateLimiters = new ConcurrentHashMap<>();

    @PostMapping("/chat")
    @Operation(
        summary = "Send Message to AI Assistant",
        description = "Sends a user message to the AI assistant. The AI can autonomously execute MCP tools to perform actions like sending messages, searching users, etc.",
        responses = {
            @ApiResponse(responseCode = "200", description = "AI Response", 
                         content = @Content(schema = @Schema(implementation = Message.class))),
            @ApiResponse(responseCode = "400", description = "Invalid Request"),
            @ApiResponse(responseCode = "429", description = "Rate Limit Exceeded"),
            @ApiResponse(responseCode = "503", description = "AI Service Unavailable"),
            @ApiResponse(responseCode = "500", description = "Internal Error")
        }
    )
    public ResponseEntity<Object> chatWithAi(
            Authentication auth,
            @RequestBody AiChatRequest request
    ) {
        String userId = auth.getName();
        
        if (request == null || request.message() == null || request.message().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ProblemDetail.forStatusAndDetail(
                            HttpStatus.BAD_REQUEST, 
                            "Message content cannot be empty"));
        }

        if (!checkRateLimit(userId)) {
            log.warn("[AI] Rate limit exceeded for user: {}", userId);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ProblemDetail.forStatusAndDetail(
                            HttpStatus.TOO_MANY_REQUESTS, 
                            AiConstants.ERROR_RATE_LIMIT));
        }

        try {
            Conversation aiConv = aiService.getOrCreateAiConversation(userId);
            
            Message aiResponse = aiService.processAiMessage(
                    userId,
                    aiConv.getId(),
                    request.message().trim(),
                    true
            );

            return ResponseEntity.ok(aiResponse);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage()));
            
        } catch (IllegalStateException e) {
            log.error("[AI] Service configuration error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ProblemDetail.forStatusAndDetail(
                            HttpStatus.SERVICE_UNAVAILABLE, 
                            "AI Service is currently unavailable. Please try again later."));
            
        } catch (Exception e) {
            log.error("[AI] Unexpected error for user {}", userId, e);
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                    HttpStatus.INTERNAL_SERVER_ERROR, 
                    "An unexpected error occurred. Please try again.");
            problem.setType(URI.create("about:blank"));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
        }
    }

    @GetMapping("/conversation")
    @Operation(
        summary = "Get AI Conversation", 
        description = "Retrieves or creates the dedicated AI conversation for the current user."
    )
    public ResponseEntity<Conversation> getAiConversation(Authentication auth) {
        try {
            return ResponseEntity.ok(aiService.getOrCreateAiConversation(auth.getName()));
        } catch (Exception e) {
            log.error("[AI] Failed to get conversation for user {}", auth.getName(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/capabilities")
    @Operation(
        summary = "Get AI Capabilities",
        description = "Returns information about what the AI assistant can do (available tools)."
    )
    public ResponseEntity<Map<String, Object>> getCapabilities() {
        return ResponseEntity.ok(Map.of(
                "name", AiConstants.AI_USER_NAME,
                "description", "AI assistant with autonomous tool execution",
                "features", java.util.List.of(
                        "Natural conversation",
                        "Send messages to users",
                        "Search users",
                        "List conversations",
                        "View conversation history",
                        "Summarize conversations",
                        "Extract tasks from messages",
                        "Save files to desktop",
                        "Draft and send emails"
                )
        ));
    }

    // Simple token bucket rate limiter.
    private boolean checkRateLimit(String userId) {
        RateLimitBucket bucket = rateLimiters.computeIfAbsent(
                userId, 
                k -> new RateLimitBucket(
                        AiConstants.RATE_LIMIT_REQUESTS_PER_MINUTE,
                        AiConstants.RATE_LIMIT_BURST_CAPACITY
                )
        );
        
        return bucket.tryConsume();
    }

    private static class RateLimitBucket {
        private final int capacity;
        private final int refillRate; // tokens per minute
        private int tokens;
        private long lastRefillTime;

        public RateLimitBucket(int refillRate, int capacity) {
            this.refillRate = refillRate;
            this.capacity = capacity;
            this.tokens = capacity;
            this.lastRefillTime = System.currentTimeMillis();
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
            long timePassed = now - lastRefillTime;
            
            if (timePassed > 0) {
                // Refill tokens based on time passed
                int tokensToAdd = (int) ((timePassed / 60000.0) * refillRate);
                tokens = Math.min(capacity, tokens + tokensToAdd);
                lastRefillTime = now;
            }
        }
    }

    public record AiChatRequest(String message) {}
}
