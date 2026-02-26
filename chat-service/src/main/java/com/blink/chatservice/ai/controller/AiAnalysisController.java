package com.blink.chatservice.ai.controller;

import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.ai.model.AiAnalysisModels.*;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
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
    public ResponseEntity<ConversationAnalysis> summarizeConversation(@PathVariable String conversationId) {
        List<Message> messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
                conversationId, PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();

        if (messages.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(aiAnalysisService.analyzeConversation(messages));
    }

    @PostMapping("/auto-replies")
    public ResponseEntity<AutoReplySuggestions> generateAutoReplies(@RequestBody AutoReplyRequest request) {
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
        return ResponseEntity.ok(aiAnalysisService.suggestReplies(message));
    }

    @PostMapping("/search-query")
    public ResponseEntity<SearchCriteria> parseSearchQuery(@RequestBody SearchRequest request) {
        if (request.query() == null || request.query().isBlank()) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(aiAnalysisService.extractSearchQuery(request.query()));
    }

    @PostMapping("/extract-task")
    public ResponseEntity<TaskListExtraction> extractTask(@RequestBody TextRequest request) {
        if (request.text() == null || request.text().isBlank()) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(aiAnalysisService.extractTasks(request.text()));
    }

    @PostMapping("/extract-tasks/{conversationId}")
    public ResponseEntity<TaskListExtraction> extractTasksFromConversation(@PathVariable String conversationId) {
        var messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
                conversationId, PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();
        if (messages.isEmpty()) return ResponseEntity.notFound().build();

        String context = messages.stream()
                .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                .map(m -> String.format("[%s] %s: %s",
                        m.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("dd-MM HH:mm")),
                        m.getSenderId(), m.getBody()))
                .collect(java.util.stream.Collectors.joining("\n"));

        // Limit to last 8000 chars to prevent token overflow
        if (context.length() > 8000) {
            context = context.substring(context.length() - 8000);
        }

        return ResponseEntity.ok(aiAnalysisService.extractTasks(context));
    }

    @PostMapping("/typing-indicator")
    public ResponseEntity<TypingSimulation> simulateTyping(@RequestBody TextRequest request) {
        if (request.text() == null || request.text().isBlank()) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(aiAnalysisService.simulateTyping(request.text()));
    }

    public record AutoReplyRequest(String messageId, String content, String senderId) {}
    public record SearchRequest(String query) {}
    public record TextRequest(String text) {}
}
