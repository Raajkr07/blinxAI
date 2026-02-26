package com.blink.chatservice.user.entity;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.time.ZoneId;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "users")
public class User implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    private String id;

    @Indexed(unique = true)
    private String phone;

    @Indexed(unique = true, sparse = true)
    private String email;
    private String username;
    private String avatarUrl;
    private String bio;
    private boolean avatarManual = false;
    private boolean usernameManual = false;
    private boolean online = false;
    private LocalDateTime lastSeen;
    private Set<String> devices = new HashSet<>();
    @Indexed
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.of("UTC"));
}
