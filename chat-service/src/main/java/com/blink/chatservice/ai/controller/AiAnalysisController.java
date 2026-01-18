package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.ai.model.AiAnalysisModels.*;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai/analysis")
@RequiredArgsConstructor
public class AiAnalysisController {

    private final AiAnalysisService aiAnalysisService;
    private final MessageRepository messageRepository;

    @PostMapping("/conversation/{conversationId}/summarize")
    @Operation(summary = "Summarize conversation and provide insights")
    public ResponseEntity<ConversationAnalysis> summarizeConversation(
            @PathVariable String conversationId
    ) {
        // Fetching last 50 messages to give enough context for a meaningful summary.
        List<Message> messages = messageRepository.findByConversationIdAndDeletedFalseOrderByCreatedAtDesc(
                conversationId, 
                PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();

        if (messages.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ConversationAnalysis analysis = aiAnalysisService.analyzeConversation(messages);
        return ResponseEntity.ok(analysis);
    }

    @PostMapping("/auto-replies")
    @Operation(summary = "Generate smart auto-replies based on the last message")
    public ResponseEntity<AutoReplySuggestions> generateAutoReplies(
            @RequestBody AutoReplyRequest request
    ) {
        // Flexible input: can take a message ID or raw text.
        Message message;
        if (request.messageId() != null) {
            message = messageRepository.findById(request.messageId()).orElse(null);
            if (message == null) return ResponseEntity.notFound().build();
        } else if (request.content() != null) {
            message = new Message();
            message.setSenderId(request.senderId() != null ? request.senderId() : "unknown");
            message.setBody(request.content());
        } else {
            return ResponseEntity.badRequest().build();
        }

        AutoReplySuggestions suggestions = aiAnalysisService.suggestReplies(message);
        return ResponseEntity.ok(suggestions);
    }

    @PostMapping("/search-query")
    @Operation(summary = "Parse natural language search to structured criteria")
    public ResponseEntity<SearchCriteria> parseSearchQuery(@RequestBody SearchRequest request) {
        if (request.query() == null || request.query().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        SearchCriteria criteria = aiAnalysisService.extractSearchQuery(request.query());
        return ResponseEntity.ok(criteria);
    }

    @PostMapping("/extract-task")
    @Operation(summary = "Extract task details from a message")
    public ResponseEntity<TaskExtraction> extractTask(@RequestBody TextRequest request) {
        if (request.text() == null || request.text().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        TaskExtraction task = aiAnalysisService.extractTask(request.text());
        return ResponseEntity.ok(task);
    }

    @PostMapping("/typing-indicator")
    @Operation(summary = "Simulate typing behavior for a response")
    public ResponseEntity<TypingSimulation> simulateTyping(@RequestBody TextRequest request) {
        if (request.text() == null || request.text().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        TypingSimulation simulation = aiAnalysisService.simulateTyping(request.text());
        return ResponseEntity.ok(simulation);
    }

    // Request Records
    public record AutoReplyRequest(String messageId, String content, String senderId) {}
    public record SearchRequest(String query) {}
    public record TextRequest(String text) {}
}
