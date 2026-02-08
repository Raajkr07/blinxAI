package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.service.AiAnalysisService;
import com.blink.chatservice.chat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

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
        return "Summarize a conversation.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "conversationId", Map.of("type", "string", "description", "Conversation ID")
            ),
            "required", List.of("conversationId")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String convId = (String) args.get("conversationId");
        if (convId == null || convId.isBlank()) return Map.of("error", true, "message", "conversationId required");

        var messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(convId, PageRequest.of(0, 50))
            .getContent().stream()
            .sorted(Comparator.comparing(m -> m.getCreatedAt()))
            .toList();

        if (messages.isEmpty()) return Map.of("success", true, "summary", "No messages found");

        return Map.of(
            "success", true,
            "summary", aiAnalysisService.analyzeConversation(messages)
        );
    }
}
