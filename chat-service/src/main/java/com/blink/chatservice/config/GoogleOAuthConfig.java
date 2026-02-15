package com.blink.chatservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.oauth2.google")
public class GoogleOAuthConfig {
    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private List<String> scopes;
    private String authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    private String tokenEndpoint = "https://oauth2.googleapis.com/token";
    private String userInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";
    private String revocationEndpoint = "https://oauth2.googleapis.com/revoke";
    private String encryptionPassword;
    private String encryptionSalt;
    private String defaultRedirectUri;
    private String errorRedirectUri;
    
    private List<String> allowedFrontendOrigins;
}
