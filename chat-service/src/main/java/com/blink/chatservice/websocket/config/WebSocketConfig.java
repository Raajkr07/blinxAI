package com.blink.chatservice.websocket.config;

import com.blink.chatservice.websocket.WebSocketAuthChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthChannelInterceptor webSocketAuthChannelInterceptor;

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
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.enableSimpleBroker("/topic", "/queue", "/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Injecting auth interceptor to validate JWT on CONNECT frame.
        registration.interceptors(webSocketAuthChannelInterceptor);
    }
}
