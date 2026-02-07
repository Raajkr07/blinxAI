package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.ai.service.AiAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExtractTasksTool implements McpTool {

    private final AiAnalysisService aiAnalysisService;

    @Override
    public String name() {
        return "extract_tasks";
    }

    @Override
    public String description() {
        return "Extract actionable tasks or reminders from text. Identifies tasks, deadlines, and action items.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "text", Map.of(
                                "type", "string",
                                "description", "The message text to analyze for tasks and action items"
                        )
                ),
                "required", List.of("text")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        try {
            String text = (String) args.get("text");
            if (text == null || text.trim().isEmpty()) {
                return Map.of(
                        "error", true,
                        "message", "text parameter is required and cannot be empty"
                );
            }

            log.info("Extracting tasks from text for user: {}", userId);
            Object tasks = aiAnalysisService.extractTask(text);
            
            return Map.of(
                    "success", true,
                    "tasks", tasks != null ? tasks : Map.of(),
                    "hasTask", tasks != null
            );
        } catch (Exception e) {
            log.error("Error extracting tasks", e);
            return Map.of(
                    "error", true,
                    "message", "Failed to extract tasks: " + e.getMessage()
            );
        }
    }
}
