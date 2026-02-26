package com.blink.chatservice.controller;

import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/actuator/health/details")
@RequiredArgsConstructor
public class HealthCheckController {

    private final MongoTemplate mongoTemplate;
    private final RedisConnectionFactory redisConnectionFactory;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealthDetails() {
        Map<String, Object> health = new HashMap<>();

        try {
            // Ping MongoDB
            mongoTemplate.executeCommand(new Document("ping", 1));
            health.put("mongodb", "UP");
        } catch (Exception e) {
            health.put("mongodb", "DOWN: " + e.getMessage());
        }

        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            String pong = connection.ping();
            health.put("redis", "UP: " + pong);
        } catch (Exception e) {
            health.put("redis", "DOWN: " + e.getMessage());
        }

        return ResponseEntity.ok(health);
    }
}
