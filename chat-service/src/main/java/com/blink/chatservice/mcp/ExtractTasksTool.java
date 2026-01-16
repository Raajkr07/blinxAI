package com.blink.chatservice.mcp;

import com.blink.chatservice.ai.AiAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class ExtractTasksTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;

    @Override
    public String name() {
        return "extract_tasks";
    }

    @Override
    public String description() {
        return "Extract actionable tasks or reminders from a text. Returns null if no task is found.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "text", Map.of("type", "string", "description", "The message text to analyze")
                ),
                "required", List.of("text")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String text = (String) args.get("text");
        return aiAnalysisService.extractTask(text);
    }
}
