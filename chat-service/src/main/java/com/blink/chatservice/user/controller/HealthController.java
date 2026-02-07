package com.blink.chatservice.user.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Health Check", description = "User Authentication health check")
public class HealthController {

    @GetMapping("/ping")
    public String ping() {
        return "Auth Service is up and running";
    }
}
