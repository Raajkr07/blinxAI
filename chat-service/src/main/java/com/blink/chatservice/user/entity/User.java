package com.blink.chatservice.user.entity;

import lombok.Data;
import lombok.Getter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
@Document(collection = "users")
@Getter
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
    private boolean online = false;
    private LocalDateTime lastSeen;
    private Set<String> devices = new HashSet<>();
    private LocalDateTime createdAt = LocalDateTime.now();
}
