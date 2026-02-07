package com.blink.chatservice.chat.controller;

import com.blink.chatservice.chat.dto.*;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.notification.service.EmailService;
import com.blink.chatservice.notification.serviceImpl.EmailServiceImpl;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileWriter;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final EmailServiceImpl emailService;

    @PostMapping("/direct")
    @Operation(summary = "Create or get direct conversation")
    public ResponseEntity<Conversation> createDirect(
            Authentication auth,
            @RequestBody DirectChatRequest request
    ) {
        try {
            if (request == null || request.otherUserContact() == null || request.otherUserContact().trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            String me = auth.getName();
            Conversation conv = chatService.createDirectConversation(me, request.otherUserContact().trim());
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error creating direct conversation", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/group")
    @Operation(summary = "Create group conversation")
    public ResponseEntity<Conversation> createGroup(
            Authentication auth,
            @Valid @RequestBody CreateGroupRequest request
    ) {
        try {
            String me = auth.getName();
            Set<String> participants = new HashSet<>(request.getParticipantIds());
            
            Conversation conv = chatService.createGroupConversation(me, request.getTitle().trim(), participants);
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error creating group conversation", e);
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<Conversation>> listMyConversations(Authentication auth) {
        try {
            String me = auth.getName();
            return ResponseEntity.ok(chatService.listConversationsForUser(me));
        } catch (Exception e) {
            log.error("Error listing conversations", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/{conversationId}/messages")
    @Operation(summary = "Send message to conversation")
    public ResponseEntity<Message> sendMessage(
            Authentication auth,
            @PathVariable String conversationId,
            @RequestBody SendMessageRequest request
    ) {
        try {
            if (request == null || request.body() == null || request.body().trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            if (request.body().length() > 2000) {
                return ResponseEntity.badRequest().build();
            }
            
            String me = auth.getName();
            Message msg = chatService.sendMessage(conversationId, me, request.body().trim());
            return ResponseEntity.ok(msg);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error sending message", e);
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<Page<Message>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        try {
            Page<Message> msg = chatService.getMessages(conversationId, page, size);
            return ResponseEntity.ok(msg);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error fetching messages", e);
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/{conversationId}")
    @Operation(summary = "Get conversation details")
    public ResponseEntity<Conversation> getConversation(
            @PathVariable String conversationId
    ) {
        try {
            Conversation conv = chatService.getConversation(conversationId);
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error getting conversation", e);
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/{conversationId}")
    @Operation(summary = "Delete or leave conversation")
    public ResponseEntity<Void> deleteConversation(
            Authentication auth,
            @PathVariable String conversationId
    ) {
        try {
            String userId = auth.getName();
            chatService.deleteConversation(conversationId, userId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error deleting conversation", e);
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/messages/{messageId}")
    @Operation(summary = "Delete a message")
    public ResponseEntity<Void> deleteMessage(
            Authentication auth,
            @PathVariable String messageId
    ) {
        try {
            String userId = auth.getName();
            chatService.deleteMessage(messageId, userId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error deleting message", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/save-file")
    @Operation(summary = "Save file to user desktop")
    public ResponseEntity<Object> saveFile(
            Authentication auth,
            @RequestBody SaveFileRequest request
    ) {
        try {
            if (request.fileName() == null || request.fileName().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Filename is required");
            }

            String filename = new File(request.fileName()).getName();
            if (!filename.contains(".")) {
                filename = filename + ".txt";
            }

            String userHome = System.getProperty("user.home");
            Path desktopPath = Paths.get(userHome, "Desktop");
            Path oneDriveDesktop = Paths.get(userHome, "OneDrive", "Desktop");
            
            if (oneDriveDesktop.toFile().exists() && oneDriveDesktop.toFile().isDirectory()) {
                desktopPath = oneDriveDesktop;
            }

            File file = desktopPath.resolve(filename).toFile();
            file.getParentFile().mkdirs();

            try (FileWriter writer = new FileWriter(file)) {
                writer.write(request.content() != null ? request.content() : "");
            }

            log.info("User {} saved file manually: {}", auth.getName(), file.getAbsolutePath());

            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "filePath", file.getAbsolutePath(),
                    "message", "File saved successfully"
            ));
        } catch (Exception e) {
            log.error("Error saving file", e);
            return ResponseEntity.internalServerError().body("Failed to save file: " + e.getMessage());
        }
    }

    @PostMapping("/send-email")
    @Operation(summary = "Send custom email")
    public ResponseEntity<Object> sendEmail(
            Authentication auth,
            @RequestBody SendEmailRequest request
    ) {
        try {
            if (request.to() == null || request.to().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Recipient (to) is required");
            }
            
            emailService.sendCustomEmail(
                request.to().trim(),
                request.subject() != null ? request.subject() : "Message from Blink",
                request.body() != null ? request.body() : ""
            );
            
            return ResponseEntity.ok(Map.of("success", true, "message", "Email sent successfully"));
        } catch (Exception e) {
             return ResponseEntity.internalServerError().body("Failed to send email: " + e.getMessage());
        }
    }
}

