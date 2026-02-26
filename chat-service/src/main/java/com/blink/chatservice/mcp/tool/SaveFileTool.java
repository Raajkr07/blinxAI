package com.blink.chatservice.mcp.tool;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SaveFileTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;

    // Allowed file extensions to prevent dangerous file types
    private static final List<String> ALLOWED_EXTENSIONS = List.of(
        ".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js",
        ".py", ".java", ".ts", ".tsx", ".jsx", ".yaml", ".yml", ".log",
        ".sql", ".sh", ".bat", ".env", ".conf", ".cfg", ".ini", ".toml"
    );

    @Override
    public String name() {
        return "save_file";
    }

    @Override
    public String description() {
        return "Save content as a downloadable text file. Use for notes, summaries, code snippets, CSV exports, etc.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "filename", Map.of("type", "string", "description", "Filename with extension, e.g. 'meeting-notes.md', 'tasks.csv', 'summary.txt'"),
                "content", Map.of("type", "string", "description", "The file content to save")
            ),
            "required", List.of("filename", "content")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String filename = (String) args.get("filename");
        String content = (String) args.get("content");

        if (filename == null || filename.isBlank()) {
            return Map.of("success", false, "message", "Filename is required. Example: 'notes.md'");
        }
        if (content == null || content.isBlank()) {
            return Map.of("success", false, "message", "File content is empty. Nothing to save.");
        }

        try {
            // Strip path components — prevent directory traversal
            int lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
            if (lastSlash >= 0) filename = filename.substring(lastSlash + 1);

            // Sanitize: remove any characters that aren't alphanumeric, dash, underscore, or dot
            filename = filename.replaceAll("[^a-zA-Z0-9._-]", "_");

            // Add default extension if missing
            if (!filename.contains(".")) filename += ".txt";

            // Validate extension
            String lowerFilename = filename.toLowerCase();
            boolean validExtension = ALLOWED_EXTENSIONS.stream().anyMatch(lowerFilename::endsWith);
            if (!validExtension) {
                return Map.of("success", false,
                    "message", "File type not supported. Use one of: .txt, .md, .csv, .json, .html, .py, .java, etc.");
            }

            // Cap file size to 1MB
            if (content.length() > 1_000_000) {
                return Map.of("success", false,
                    "message", "File too large (max 1MB). Try splitting the content.");
            }

            log.info("Saving file '{}' ({} chars) for user {}", filename, content.length(), userId);

            Map<String, Object> payload = Map.of(
                "fileName", filename,
                "content", content
            );

            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "SAVE_FILE_REQUEST",
                "payload", payload
            ));

            return Map.of(
                "success", true,
                "fileName", filename,
                "message", "File '" + filename + "' is ready — check the popup to download it."
            );

        } catch (Exception e) {
            log.error("Failed to save file '{}' for user {}: {}", filename, userId, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't save the file right now. Please try again.");
        }
    }
}
