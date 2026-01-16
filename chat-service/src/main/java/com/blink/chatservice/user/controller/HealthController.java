package com.blink.chatservice.user.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/api/v1/auth/ping")
    public String ping() {
        return "Hey User Controller is Running Well, How about yours.";
    }
}
