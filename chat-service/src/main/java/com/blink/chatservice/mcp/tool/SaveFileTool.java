package com.blink.chatservice.mcp.tool;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SaveFileTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public String name() {
        return "save_file";
    }

    @Override
    public String description() {
        return "Propose saving content to a text file.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "filename", Map.of("type", "string", "description", "Filename (e.g., 'notes.md')"),
                "content", Map.of("type", "string", "description", "File content")
            ),
            "required", List.of("filename", "content")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String filename = (String) args.get("filename");
        String content = (String) args.get("content");

        if (filename == null || filename.isBlank()) {
            return Map.of("error", true, "message", "filename is required");
        }

        filename = new File(filename).getName();
        if (!filename.contains(".")) filename += ".txt";
        
        Map<String, Object> payload = Map.of(
            "fileName", filename,
            "content", content != null ? content : ""
        );

        messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
            "type", "SAVE_FILE_REQUEST",
            "payload", payload
        ));

        return Map.of(
            "success", true,
            "fileName", filename,
            "message", "I've drafted the file. Please check the popup to save."
        );
    }
}
