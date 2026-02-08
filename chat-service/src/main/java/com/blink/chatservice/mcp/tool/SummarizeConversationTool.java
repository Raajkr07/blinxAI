package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class SummarizeConversationTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;
    private final MessageRepository messageRepository;

    @Override
    public String name() {
        return "summarize_conversation";
    }

    @Override
    public String description() {
        return "Summarize a conversation and extract key points, sentiment, and urgency. Analyzes up to 50 recent messages.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "conversationId", Map.of(
                                "type", "string",
                                "description", "The ID of the conversation to summarize"
                        )
                ),
                "required", List.of("conversationId")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        try {
            String conversationId = (String) args.get("conversationId");
            if (conversationId == null || conversationId.trim().isEmpty()) {
                return Map.of(
                        "error", true,
                        "message", "conversationId is required"
                );
            }

            List<Message> messages = messageRepository
                    .findByConversationIdAndDeletedFalseOrderByIdDesc(conversationId,
                            org.springframework.data.domain.PageRequest.of(0, 50))
                    .getContent()
                    .stream()
                    .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                    .collect(Collectors.toList());

            if (messages.isEmpty()) {
                return Map.of(
                        "error", false,
                        "message", "No messages found in this conversation.",
                        "summary", ""
                );
            }

            log.info("Summarizing conversation: {} with {} messages for user: {}", 
                    conversationId, messages.size(), userId);

            Object summary = aiAnalysisService.analyzeConversation(messages);
            return Map.of(
                    "success", true,
                    "conversationId", conversationId,
                    "messageCount", messages.size(),
                    "summary", summary
            );
        } catch (Exception e) {
            log.error("Error summarizing conversation", e);
            return Map.of(
                    "error", true,
                    "message", "Failed to summarize conversation: " + e.getMessage()
            );
        }
    }
}
