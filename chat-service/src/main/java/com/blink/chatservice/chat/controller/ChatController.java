package com.blink.chatservice.chat.controller;

import java.util.HashSet;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.blink.chatservice.chat.dto.CreateGroupRequest;
import com.blink.chatservice.chat.dto.DirectChatRequest;
import com.blink.chatservice.chat.dto.PagedResponse;
import com.blink.chatservice.chat.dto.SaveFileRequest;
import com.blink.chatservice.chat.dto.SendEmailRequest;
import com.blink.chatservice.chat.dto.SendMessageRequest;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.notification.service.EmailService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

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
    public ResponseEntity<PagedResponse<Message>> getMessages(@PathVariable String conversationId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(PagedResponse.from(chatService.getMessages(conversationId, page, size)));
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
    public ResponseEntity<Object> saveFile(Authentication auth, @RequestBody SaveFileRequest request) {
        if (request.fileName() == null || request.fileName().isBlank()) {
            return ResponseEntity.badRequest().body("Filename is required");
        }

        String filename = request.fileName().trim();
        if (!filename.contains(".")) filename += ".txt";

        return ResponseEntity.ok(Map.of(
                "success", true,
                "fileName", filename,
                "content", request.content() != null ? request.content() : ""
        ));
    }

    @PostMapping("/send-email")
    public ResponseEntity<Object> sendEmail(Authentication auth, @RequestBody SendEmailRequest request) {
        if (request.to() == null || request.to().isBlank()) return ResponseEntity.badRequest().body("Recipient is required");
        
        emailService.sendUserEmail(auth.getName(), request.to().trim(), request.subject() != null ? request.subject() : "Message from BlinxAI", request.body() != null ? request.body() : "");
        
        if (request.conversationId() != null && !request.conversationId().isBlank()) {
            try {
                chatService.sendMessage(request.conversationId(), "ai-assistant", "✅ Email sent successfully to " + request.to());
            } catch (Exception e) {
                // Ignore if bot is not a participant or other chat error
            }
        }
        
        return ResponseEntity.ok(Map.of("success", true));
    }
}

