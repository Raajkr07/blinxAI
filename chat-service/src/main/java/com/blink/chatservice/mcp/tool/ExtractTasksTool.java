package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.service.AiAnalysisService;
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
        return "Extract actionable tasks or reminders from text.";
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
    public Object execute(String userId, Map<Object, Object> args) {
        String text = (String) args.get("text");
        if (text == null || text.isBlank()) {
            return Map.of("error", true, "message", "text is required");
        }

        Object tasks = aiAnalysisService.extractTask(text);
        return Map.of(
            "success", true,
            "tasks", tasks != null ? tasks : Map.of(),
            "hasTask", tasks != null
        );
    }
}
