package com.blink.chatservice.websocket.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import com.blink.chatservice.websocket.WebSocketAuthChannelInterceptor;

import lombok.RequiredArgsConstructor;

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

        // Configure the simple broker with memory-safe limits.
        // Without these, the in-memory broker can accumulate unbounded send buffers
        // per WebSocket session, leading to steady memory growth under load.
        registry.enableSimpleBroker("/topic", "/queue", "/user")
                // Heartbeat: server sends ping every 10s, expects pong every 10s.
                // Dead connections are detected and cleaned up within ~20s,
                // preventing stale sessions from accumulating send buffers.
                .setHeartbeatValue(new long[]{10000, 10000})
                .setTaskScheduler(heartTaskScheduler);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Injecting auth interceptor to validate JWT on CONNECT frame.
        registration.interceptors(webSocketAuthChannelInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        // Cap per-message and per-session buffer sizes to prevent
        // a single misbehaving client from consuming excessive memory.
        registry.setMessageSizeLimit(128 * 1024);      // 128KB max per STOMP message
        registry.setSendBufferSizeLimit(512 * 1024);    // 512KB max send buffer per session
        registry.setSendTimeLimit(15 * 1000);            // 15s to flush send buffer before disconnect
    }
}
