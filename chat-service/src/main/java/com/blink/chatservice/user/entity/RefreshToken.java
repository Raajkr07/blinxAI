package com.blink.chatservice.user.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.ZoneId;
@Data
@Document(collection = "refresh_tokens")
public class RefreshToken {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed(unique = true)
    private String token;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.of("UTC"));
    private boolean revoked = false;
    private String deviceInfo;
    public boolean isExpired() {
        return expiresAt != null && expiresAt.isBefore(LocalDateTime.now(ZoneId.of("UTC")));
    }
    public boolean isValid() {
        return !revoked && !isExpired();
    }
}
