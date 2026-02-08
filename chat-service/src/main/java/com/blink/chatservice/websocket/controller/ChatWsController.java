package com.blink.chatservice.websocket.controller;

import com.blink.chatservice.ai.service.AiService;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.websocket.dto.RealtimeMessageRequest;
import com.blink.chatservice.websocket.dto.TypingRequest;
import com.blink.chatservice.websocket.dto.TypingResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWsController {

    private final ChatService chatService;
    private final AiService aiService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload RealtimeMessageRequest request,
                            Principal principal) {
        handleSendMessage(request, principal);
    }

    @MessageMapping("/chat.sendMessageSimple")
    public void sendMessageSimple(@Payload RealtimeMessageRequest request,
                                  Principal principal) {
        handleSendMessage(request, principal);
    }

    @MessageMapping("/ai.chat")
    public void chatWithAi(@Payload RealtimeMessageRequest request, Principal principal) {
        if (principal == null || request == null) return;

        String userId = principal.getName();
        String conversationId = request.conversationId();

        chatService.sendMessage(conversationId, userId, request.body());

        // 2. Trigger AI Processing asynchronously (optional, but good for performance)
        // For now, we'll keep it simple/synchronous as per your previous HTTP controller logic
        try {
            // Broadcast AI Typing: TRUE
            TypingResponse typingStart = new TypingResponse(conversationId, "ai-assistant", true);
            messagingTemplate.convertAndSend("/topic/conversations/" + conversationId + "/typing", typingStart);

            Message aiResponse = aiService.processAiMessage(userId, conversationId, request.body(), false);

            // Broadcast AI Typing: FALSE (implicit by sending message, but good to be explicit or if error occurs)
            TypingResponse typingStop = new TypingResponse(conversationId, "ai-assistant", false);
            messagingTemplate.convertAndSend("/topic/conversations/" + conversationId + "/typing", typingStop);

            // 3. Broadcast AI Response
            // Note: processAiMessage likely saves it DB-side. We need to push it to WS.
            // If aiService doesn't allow broadcasting, typically you'd just call chatService.sendMessage
            // with the AI's response content, pretending to be the AI user.
            // But assuming aiResponse is the saved message entity:
            messagingTemplate.convertAndSend(
                    "/topic/conversations/" + conversationId,
                    aiResponse
            );

        } catch (Exception e) {
            log.error("Error in AI chat", e);
        }
    }

    private void handleSendMessage(RealtimeMessageRequest request, Principal principal) {
        if (principal == null) {
            log.warn("WS Message received without principal");
            return;
        }

        if (request == null || request.conversationId() == null || request.body() == null) {
            log.warn("Invalid WS message request from {}", principal.getName());
            return;
        }

        try {
            String senderId = principal.getName();
            // This will save AND broadcast via ChatServiceImpl
            chatService.sendMessage(request.conversationId(), senderId, request.body());
        } catch (Exception e) {
            log.error("Error processing WebSocket message from {}: {}", principal.getName(), e.getMessage());
        }
    }

    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload TypingRequest request, Principal principal) {
        if (principal == null || request == null || request.conversationId() == null) {
            return;
        }

        try {
            String userId = principal.getName();
            TypingResponse response = new TypingResponse(
                    request.conversationId(),
                    userId,
                    request.typing() != null ? request.typing() : false
            );

            // Broadcast typing indicator to all participants in the conversation
            messagingTemplate.convertAndSend(
                    "/topic/conversations/" + request.conversationId() + "/typing",
                    response
            );
        } catch (Exception e) {
            log.error("Error handling typing indicator: {}", e.getMessage(), e);
        }
    }
}
