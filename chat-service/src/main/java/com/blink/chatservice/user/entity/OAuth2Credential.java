package com.blink.chatservice.user.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Document(collection = "oauth2_credentials")
@CompoundIndex(name = "user_provider_idx", def = "{'userId': 1, 'provider': 1}", unique = true)
public class OAuth2Credential {
    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private String provider; // "google"

    @Indexed
    private String providerUserId; // Google sub

    private String accessToken; // Encrypted
    private String refreshToken; // Encrypted

    private LocalDateTime expiresAt;
    private String scope;
    
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
}
