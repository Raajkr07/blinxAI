package com.blink.chatservice.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
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
                .info(new Info()
                        .title("Blink API")
                        .version("1.0.0")
                        .description("Blink Real-Time Messaging and AI Gateway"))
                .addServersItem(new Server().url(serverUrl))
                .components(new Components()
                        .addSecuritySchemes("bearerToken", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerToken"));
    }
}