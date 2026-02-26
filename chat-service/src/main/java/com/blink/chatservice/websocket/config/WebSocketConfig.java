package com.blink.chatservice.websocket.config;

import com.blink.chatservice.websocket.WebSocketAuthChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.*;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthChannelInterceptor webSocketAuthChannelInterceptor;
    private final TaskScheduler heartTaskScheduler;

    @Value("${app.cors.allowed-origins}")
    private String allowedOriginsRaw;

    private String[] parseOrigins() {
        if (allowedOriginsRaw == null || allowedOriginsRaw.isBlank()) return new String[]{"*"};
        return Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toArray(String[]::new);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = parseOrigins();
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins)
                .withSockJS();
        // Also register without SockJS for native WebSocket clients
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins);

        // Some platforms route only versioned API paths to the backend.
        // Expose a versioned websocket endpoint as an alias to reduce routing brittleness.
        registry.addEndpoint("/api/v1/ws")
            .setAllowedOriginPatterns(origins)
            .withSockJS();
        registry.addEndpoint("/api/v1/ws")
            .setAllowedOriginPatterns(origins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");

        // BUG FIX: Configure the simple broker with memory-safe limits.
        // Without these, the in-memory broker can accumulate unbounded send buffers
        // per WebSocket session, leading to steady memory growth under load.
        registry.enableSimpleBroker("/topic", "/queue", "/user")
                // Heartbeat: server sends ping every 25s, expects pong every 25s.
                // Dead connections are detected and cleaned up within ~50s.
                .setHeartbeatValue(new long[]{25000, 25000})
                .setTaskScheduler(heartTaskScheduler);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Injecting auth interceptor to validate JWT on CONNECT frame.
        registration.interceptors(webSocketAuthChannelInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        // BUG FIX: Cap per-message and per-session buffer sizes to prevent
        // a single misbehaving client from consuming excessive memory.
        registry.setMessageSizeLimit(64 * 1024);       // 64KB max per STOMP message
        registry.setSendBufferSizeLimit(512 * 1024);    // 512KB max send buffer per session
        registry.setSendTimeLimit(20 * 1000);            // 20s to flush send buffer before disconnect
    }
}
