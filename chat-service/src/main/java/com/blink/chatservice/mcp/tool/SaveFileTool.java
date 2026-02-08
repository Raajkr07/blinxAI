package com.blink.chatservice.mcp.tool;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
public class SaveFileTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public String name() {
        return "save_file";
    }

    @Override
    public String description() {
        return "Propose saving content to a text file on the user's device. Always ask user for permission. The actual save happens after user confirmation in the UI.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "filename", Map.of(
                                "type", "string",
                                "description", "The name of the file (e.g., 'trip-checklist.txt', 'notes.md')"
                        ),
                        "content", Map.of(
                                "type", "string",
                                "description", "The content to write to the file. Should be well-formatted and organized."
                        )
                ),
                "required", List.of("filename", "content")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        try {
            String filename = (String) args.get("filename");
            String content = (String) args.get("content");

            if (filename == null || filename.trim().isEmpty()) {
                return Map.of(
                        "error", true,
                        "message", "filename is required"
                );
            }
            if (content == null) {
                content = "";
            }

            // Sanitize filename
            filename = new File(filename).getName();
            
            // Ensure extension
            if (!filename.contains(".")) {
                filename = filename + ".txt";
            }
            
            // Prepare payload for frontend modal
            // We don't determine the path on the server anymore
            Map<String, Object> fileInfo = Map.of(
                    "fileName", filename,
                    "targetPath", "User Selected Location", // Placeholder for UI
                    "content", content,
                    "location", "Local Device"
            );

            // Notify frontend to show modal
            // Using a topic-based approach to avoid potential UserDestination resolution issues
            // Client will subscribe to /topic/user/{userId}/actions
            String destination = "/topic/user/" + userId + "/actions";
            messagingTemplate.convertAndSend(
                    destination,
                    Map.of(
                            "type", "SAVE_FILE_REQUEST",
                            "payload", fileInfo
                    )
            );

            log.info("Proposing save file for user {}: {}", userId, filename);

            return Map.of(
                    "success", true,
                    "fileName", filename,
                    "targetPath", "User Selected Location",
                    "content", content,
                    "location", "Local Device",
                    "message", "I've drafted the file '" + filename + "'. Please review and confirm the save action in the popup window.",
                    "pendingApproval", true,
                    "requiresAction", true
            );
        } catch (Exception e) {
            log.error("Error executing save_file tool", e);
            return Map.of(
                    "error", true,
                    "message", "Error preparing file save: " + e.getMessage()
            );
        }
    }
}
