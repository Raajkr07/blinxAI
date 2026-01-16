package com.blink.chatservice.mcp.tool;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class SaveFileTool implements McpTool {

    @Override
    public String name() {
        return "save_file";
    }

    @Override
    public String description() {
        return "Save content to a text file in the user's home directory. Returns the absolute file path.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "filename", Map.of("type", "string", "description", "The name of the file (e.g. notes.txt)"),
                        "content", Map.of("type", "string", "description", "The content to write to the file")
                ),
                "required", List.of("filename", "content")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        try {
            String filename = (String) args.get("filename");
            String content = (String) args.get("content");

            if (filename == null || filename.trim().isEmpty()) {
                throw new IllegalArgumentException("filename is required");
            }
            if (content == null) {
                content = "";
            }

            // Sanitize filename to prevent directory traversal
            filename = new File(filename).getName();
            
            String userHome = System.getProperty("user.home");
            Path path = Paths.get(userHome, filename);
            File file = path.toFile();

            try (FileWriter writer = new FileWriter(file)) {
                writer.write(content);
            }

            log.info("Saved file for user {}: {}", userId, file.getAbsolutePath());

            return Map.of(
                    "success", true,
                    "filePath", file.getAbsolutePath(),
                    "message", "File saved successfully"
            );
        } catch (IOException e) {
            log.error("Failed to save file", e);
            throw new RuntimeException("Failed to save file: " + e.getMessage());
        } catch (Exception e) {
            log.error("Error executing save_file tool", e);
            throw new RuntimeException("Error executing tool: " + e.getMessage());
        }
    }
}
