package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.service.AiIncognitoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/ai/incognito")
@Tag(name = "AI Incognito", description = "Incognito AI chat, configuration and data analysis")
public class AiIncognitoController {

    private final AiIncognitoService aiIncognitoService;

    public AiIncognitoController(AiIncognitoService aiIncognitoService) {
        this.aiIncognitoService = aiIncognitoService;
    }

    @Operation(summary = "Send incognito chat message", description = "Send a message to the incognito AI assistant (not saved to DB)")
    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chat(Authentication auth, @RequestBody ChatRequest request) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (request == null || request.message() == null || request.message().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String trimmed = request.message().trim();
        if (trimmed.length() > 4000) {
            return ResponseEntity.badRequest().build();
        }

        try {
            String response = aiIncognitoService.processIncognitoMessage(auth.getName(), trimmed);

            if (response == null || response.isBlank()) {
                response = "Sorry, I lost my connection. But since we are incognito, even my failure is a secret!";
            }

            return ResponseEntity.ok(Map.of("reply", response));
        } catch (Exception e) {
            log.error("Incognito chat failed for user {}: {}", auth.getName(), e.getMessage(), e);
            return ResponseEntity.ok(Map.of("reply",
                    "Sorry, I lost my connection. But since we are incognito, even my failure is a secret!"));
        }
    }

    public record ChatRequest(String message) {}
    public record ConfigurationRequest(String instructions, String chatType) {}

    @Operation(summary = "Update incognito chat config", description = "Set instructions and chat type for the incognito session")
    @PostMapping("/config")
    public ResponseEntity<Void> updateConfig(Authentication auth, @RequestBody ConfigurationRequest request) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        aiIncognitoService.updateConfig(auth.getName(), request.instructions(), request.chatType());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Crunch uploaded data", description = "Analyze an uploaded file and return chart data with AI summary")
    @PostMapping("/data-analysis/crunch")
    public ResponseEntity<Map<String, Object>> crunchData(Authentication auth, 
        @RequestParam(value = "file", required = false) org.springframework.web.multipart.MultipartFile file,
        @RequestParam(value = "chartType", defaultValue = "bar") String chartType) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(aiIncognitoService.processDataAnalysis(file, chartType));
    }
}
