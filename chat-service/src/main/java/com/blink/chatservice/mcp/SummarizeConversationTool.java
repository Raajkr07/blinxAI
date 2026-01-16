package com.blink.chatservice.mcp;

import com.blink.chatservice.ai.AiAnalysisService;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class SummarizeConversationTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;
    private final MessageRepository messageRepository;

    @Override
    public String name() {
        return "summarize_conversation";
    }

    @Override
    public String description() {
        return "Summarize a conversation and extract key points, sentiment, and urgency.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "conversationId", Map.of("type", "string", "description", "The ID of the conversation to summarize")
                ),
                "required", List.of("conversationId")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String conversationId = (String) args.get("conversationId");

        List<Message> messages = messageRepository
                .findByConversationIdAndDeletedFalseOrderByCreatedAtDesc(conversationId,
                        org.springframework.data.domain.PageRequest.of(0, 50))
                .getContent()
                .stream()
                .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                .collect(Collectors.toList());

        if (messages.isEmpty()) {
            return "No messages found in this conversation.";
        }

        return aiAnalysisService.analyzeConversation(messages);
    }
}
