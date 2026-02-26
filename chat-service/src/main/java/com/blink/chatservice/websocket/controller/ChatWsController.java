package com.blink.chatservice.websocket.controller;

import com.blink.chatservice.ai.service.AiService;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.websocket.dto.RealtimeMessageRequest;
import com.blink.chatservice.websocket.dto.TypingRequest;
import com.blink.chatservice.websocket.dto.TypingResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

@Slf4j
@Controller
public class ChatWsController {

    private final ChatService chatService;
    private final AiService aiService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Executor aiToolExecutor;

    public ChatWsController(ChatService chatService,
                            AiService aiService,
                            SimpMessagingTemplate messagingTemplate,
                            @Qualifier("aiToolExecutor") Executor aiToolExecutor) {
        this.chatService = chatService;
        this.aiService = aiService;
        this.messagingTemplate = messagingTemplate;
        this.aiToolExecutor = aiToolExecutor;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload RealtimeMessageRequest request, Principal principal) {
        if (principal == null || request == null) return;
        chatService.sendMessage(request.conversationId(), principal.getName(), request.body());
    }

    @MessageMapping("/ai.chat")
    public void chatWithAi(@Payload RealtimeMessageRequest request, Principal principal) {
        if (principal == null || request == null || request.conversationId() == null) return;

        String userId = principal.getName();
        String conversationId = request.conversationId();

        chatService.sendMessage(conversationId, userId, request.body());

        try {
            messagingTemplate.convertAndSend("/topic/conversations/" + conversationId + "/typing", new TypingResponse(conversationId, "ai-assistant", true));

            // Offload to dedicated AI thread pool to keep the message broker responsive
            CompletableFuture.runAsync(() -> {
                try {
                    // processAiMessage now calls chatService.sendMessage internally, which handles broadcasting.
                    aiService.processAiMessage(userId, conversationId, request.body(), false);
                } catch (Exception e) {
                    log.error("AI chat processing failed", e);
                } finally {
                    messagingTemplate.convertAndSend("/topic/conversations/" + conversationId + "/typing", new TypingResponse(conversationId, "ai-assistant", false));
                }
            }, aiToolExecutor);
        } catch (Exception e) {
            log.error("Failed to start AI chat task", e);
        }
    }

    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload TypingRequest request, Principal principal) {
        if (principal == null || request == null || request.conversationId() == null) return;
        
        messagingTemplate.convertAndSend("/topic/conversations/" + request.conversationId() + "/typing", 
            new TypingResponse(request.conversationId(), principal.getName(), Boolean.TRUE.equals(request.typing())));
    }
}
