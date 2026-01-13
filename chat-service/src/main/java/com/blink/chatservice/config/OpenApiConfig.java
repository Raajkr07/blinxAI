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
@OpenAPIDefinition(
        info = @Info(
                title = "Blink Chat Service API",
                version = "v1",
                description = "Real-time chat backend for users, conversations, messages, and WebSocket.",
                contact = @Contact(
                        name = "Blink Backend Team",
                        email = "support@blink.com",
                        url = "https://blink.com"
                ),
                license = @License(name = "MIT", url = "https://opensource.org/licenses/MIT")
        ),
        servers = {
                @Server(url = "${api.server.url}", description = "API Server")
        },
        security = @SecurityRequirement(name = "bearerToken")
)
@SecurityScheme(
        name = "bearerToken",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        description = "Enter your JWT Bearer token in format **Bearer <token>**"
)
public class OpenApiConfig {

    @Value("${api.server.url:http://localhost:8080}")
    private String serverUrl;

    @Bean
    public OpenAPI blinkOpenAPI() {
        return new OpenAPI()
                .info(new io.swagger.v3.oas.models.info.Info()
                        .title("Blink Chat Service API")
                        .version("v1")
                        .description("API documentation for Blink chat backend. Includes authentication, messaging, and real-time features.")
                        .contact(new io.swagger.v3.oas.models.info.Contact()
                                .name("Blink Backend Team")
                                .email("support@blink.com")
                                .url("https://blink.com"))
                        .license(new io.swagger.v3.oas.models.info.License()
                                .name("MIT")
                                .url("https://opensource.org/licenses/MIT"))
                )
                .addServersItem(new io.swagger.v3.oas.models.servers.Server()
                        .url(serverUrl)
                        .description("API Server"))
                .components(new Components()
                        .addSecuritySchemes("bearerToken", new io.swagger.v3.oas.models.security.SecurityScheme()
                                .type(io.swagger.v3.oas.models.security.SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT Bearer token for authentication")))
                .addSecurityItem(new io.swagger.v3.oas.models.security.SecurityRequirement()
                        .addList("bearerToken"));
    }
}