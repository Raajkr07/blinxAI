package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.service.AiIncognitoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai/incognito")
public class AiIncognitoController {

    private final AiIncognitoService aiIncognitoService;

    public AiIncognitoController(AiIncognitoService aiIncognitoService) {
        this.aiIncognitoService = aiIncognitoService;
    }

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

        String response = aiIncognitoService.processIncognitoMessage(auth.getName(), trimmed);

        return ResponseEntity.ok(Map.of("reply", response));
    }

    public record ChatRequest(String message) {}
    public record ConfigurationRequest(String instructions, String chatType) {}

    @PostMapping("/config")
    public ResponseEntity<Void> updateConfig(Authentication auth, @RequestBody ConfigurationRequest request) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        aiIncognitoService.updateConfig(auth.getName(), request.instructions(), request.chatType());
        return ResponseEntity.ok().build();
    }

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
