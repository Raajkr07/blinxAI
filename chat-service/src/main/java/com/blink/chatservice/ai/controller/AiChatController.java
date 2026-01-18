package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.service.AiService;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiService aiService;

    @PostMapping("/chat")
    @Operation(summary = "Send a message to AI assistant and get response")
    public ResponseEntity<Message> chatWithAi(
            Authentication auth,
            @RequestBody AiChatRequest request
    ) {
        try {
            if (request == null || request.message() == null || request.message().trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            String userId = auth.getName();
            if (userId == null || userId.trim().isEmpty()) {
                return ResponseEntity.status(401).build();
            }

            Conversation aiConv = aiService.getOrCreateAiConversation(userId);

            // Triggering AI processing. This involves a loop of tool calls if needed.
            Message aiResponse = aiService.processAiMessage(
                    userId,
                    aiConv.getId(),
                    request.message().trim()
            );

            return ResponseEntity.ok(aiResponse);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (IllegalStateException e) {
            // Service unavailable (e.g., API key not configured)
            return ResponseEntity.status(503).build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/conversation")
    @Operation(summary = "Get or create AI assistant conversation")
    public ResponseEntity<Conversation> getAiConversation(Authentication auth) {
        try {
            String userId = auth.getName();
            Conversation conv = aiService.getOrCreateAiConversation(userId);
            return ResponseEntity.ok(conv);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    public record AiChatRequest(String message) {}
}
