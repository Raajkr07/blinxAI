package com.blink.chatservice.websocket;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.websocket.dto.PresenceEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Component
@RequiredArgsConstructor
public class WebSocketPresenceListener {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        if (principal == null) return;

        String userId = principal.getName();
        // Updating DB on connect. Note: Heavy write per connect, optimize with Redis setbit in future.
        userRepository.findById(userId).ifPresent(user -> {
            user.setOnline(true);
            userRepository.save(user);
            broadcastPresence(user);
        });
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        if (principal == null) return;

        String userId = principal.getName();
        userRepository.findById(userId).ifPresent(user -> {
            user.setOnline(false);
            user.setLastSeen(LocalDateTime.now(ZoneId.of("UTC")));
            userRepository.save(user);
            broadcastPresence(user);
        });
    }

    private void broadcastPresence(User user) {
        PresenceEvent event = new PresenceEvent(user.getId(), user.isOnline());
        messagingTemplate.convertAndSend("/topic/presence", event);
    }
}
