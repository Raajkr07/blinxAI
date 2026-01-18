package com.blink.chatservice.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import io.swagger.v3.oas.annotations.servers.Server;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Value("${api.server.url:http://localhost:8080}")
    private String serverUrl;

    @Bean
    public OpenAPI blinkOpenAPI() {
        return new OpenAPI()
                .info(new io.swagger.v3.oas.models.info.Info()
                        .title("Blink Professional Chat Service API")
                        .version("v1.0.0")
                        .description("<h2>High-Performance Real-Time Messaging Gateway</h2>" +
                                "<p>Welcome to the <b>Blink</b> Backend API. This service handles the core orchestration for messaging, AI assistant interactions, and WebRTC signaling.</p>" +
                                "<h3>🚀 Key Features</h3>" +
                                "<ul>" +
                                "  <li><b>Secure Auth:</b> Standardized JWT-based stateless authentication flow.</li>" +
                                "  <li><b>Real-time:</b> WebSocket-driven message broadcasting and presence tracking.</li>" +
                                "  <li><b>AI Integrated:</b> Native support for LLM-orchestrated tasks and AI-driven and MCP chat analysis and more.</li>" +
                                "  <li><b>Media-Ready:</b> Robust signaling infrastructure for peer-to-peer Video/Audio calls.</li>" +
                                "</ul>" +
                                "<p><i>For support or enterprise licensing, contact the platform team at <a href='mailto:dev-support@blink.com'>dev-support@blink.com</a></i></p>")
                        .termsOfService("https://blink.com/terms")
                        .contact(new io.swagger.v3.oas.models.info.Contact()
                                .name("Blink Engineering")
                                .email("dev-support@blink.com")
                                .url("https://blink.com"))
                        .license(new io.swagger.v3.oas.models.info.License()
                                .name("COMMERCIAL")
                                .url("https://blink.com/license"))
                )
                .addServersItem(new io.swagger.v3.oas.models.servers.Server()
                        .url(serverUrl)
                        .description("Cloud Gateway - Production"))
                .components(new Components()
                        .addSecuritySchemes("bearerToken", new io.swagger.v3.oas.models.security.SecurityScheme()
                                .type(io.swagger.v3.oas.models.security.SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("<b>Standard JWT Authorization.</b><br/>Provide token in format: <code>Bearer {token}</code>")))
                .addSecurityItem(new io.swagger.v3.oas.models.security.SecurityRequirement()
                        .addList("bearerToken"));
    }
}