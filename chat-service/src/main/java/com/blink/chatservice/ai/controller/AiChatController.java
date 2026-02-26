package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.ai.service.AiService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.mcp.registry.McpToolRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.blink.chatservice.mcp.tool.McpTool;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiService aiService;
    private final McpToolRegistry mcpToolRegistry;

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

        // Rate limiting is now handled centrally by RateLimitFilter

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
        // Use AI to dynamically summarize and group capabilities
        List<Map<String, String>> capabilities = aiService.summarizeCapabilities();
        
        return ResponseEntity.ok(Map.of(
            "name", AiConstants.AI_USER_NAME,
            "capabilities", capabilities
        ));
    }

    public record ChatRequest(String message) {}
}
