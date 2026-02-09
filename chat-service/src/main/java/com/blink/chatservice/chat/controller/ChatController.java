package com.blink.chatservice.chat.controller;

import com.blink.chatservice.chat.dto.*;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.notification.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final EmailService emailService;

    @PostMapping("/direct")
    public ResponseEntity<Conversation> createDirect(Authentication auth, @RequestBody DirectChatRequest request) {
        if (request == null || request.otherUserContact() == null || request.otherUserContact().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(chatService.createDirectConversation(auth.getName(), request.otherUserContact().trim()));
    }

    @PostMapping("/group")
    public ResponseEntity<Conversation> createGroup(Authentication auth, @Valid @RequestBody CreateGroupRequest request) {
        return ResponseEntity.ok(chatService.createGroupConversation(auth.getName(), request.getTitle().trim(), new HashSet<>(request.getParticipantIds())));
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<Conversation>> listMyConversations(Authentication auth) {
        return ResponseEntity.ok(chatService.listConversationsForUser(auth.getName()));
    }

    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<Message> sendMessage(Authentication auth, @PathVariable String conversationId, @RequestBody SendMessageRequest request) {
        if (request == null || request.body() == null || request.body().isBlank()) return ResponseEntity.badRequest().build();
        if (request.body().length() > 2000) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(chatService.sendMessage(conversationId, auth.getName(), request.body().trim()));
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<Page<Message>> getMessages(@PathVariable String conversationId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(chatService.getMessages(conversationId, page, size));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<Conversation> getConversation(@PathVariable String conversationId) {
        return ResponseEntity.ok(chatService.getConversation(conversationId));
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> deleteConversation(Authentication auth, @PathVariable String conversationId) {
        chatService.deleteConversation(conversationId, auth.getName());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(Authentication auth, @PathVariable String messageId) {
        chatService.deleteMessage(messageId, auth.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/save-file")
    public ResponseEntity<Object> saveFile(Authentication auth, @RequestBody SaveFileRequest request) throws Exception {
        if (request.fileName() == null || request.fileName().isBlank()) return ResponseEntity.badRequest().body("Filename is required");

        String filename = new File(request.fileName()).getName();
        if (!filename.contains(".")) filename += ".txt";

        String userHome = System.getProperty("user.home");
        Path desktopPath = Paths.get(userHome, "Desktop");
        Path oneDriveDesktop = Paths.get(userHome, "OneDrive", "Desktop");
        if (oneDriveDesktop.toFile().exists()) desktopPath = oneDriveDesktop;

        File file = desktopPath.resolve(filename).toFile();
        file.getParentFile().mkdirs();
        try (FileWriter writer = new FileWriter(file)) {
            writer.write(request.content() != null ? request.content() : "");
        }

        return ResponseEntity.ok(Map.of("success", true, "filePath", file.getAbsolutePath()));
    }

    @PostMapping("/send-email")
    public ResponseEntity<Object> sendEmail(Authentication auth, @RequestBody SendEmailRequest request) {
        if (request.to() == null || request.to().isBlank()) return ResponseEntity.badRequest().body("Recipient is required");
        emailService.sendCustomEmail(request.to().trim(), request.subject() != null ? request.subject() : "Message from Blink", request.body() != null ? request.body() : "");
        return ResponseEntity.ok(Map.of("success", true));
    }
}

