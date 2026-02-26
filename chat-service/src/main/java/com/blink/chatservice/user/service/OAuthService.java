package com.blink.chatservice.user.service;

import com.blink.chatservice.config.GoogleOAuthConfig;
import com.blink.chatservice.config.JwtConfig;
import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.user.entity.OAuth2Credential;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.OAuth2CredentialRepository;
import com.blink.chatservice.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.TimeUnit;

@Service
public class OAuthService {

    private static final Logger log = LoggerFactory.getLogger(OAuthService.class);

    private final GoogleOAuthConfig googleConfig;
    private final UserRepository userRepository;
    private final OAuth2CredentialRepository credentialRepository;
    private final StringRedisTemplate redisTemplate;
    private final JwtUtil jwtUtil;
    @SuppressWarnings("unused")
    private final JwtConfig jwtConfig;
    private final RestClient restClient = RestClient.create();
    @SuppressWarnings("unused")
    private final ObjectMapper objectMapper;

    private TextEncryptor encryptor;

    public OAuthService(
            GoogleOAuthConfig googleConfig,
            UserRepository userRepository,
            OAuth2CredentialRepository credentialRepository,
            StringRedisTemplate redisTemplate,
            JwtUtil jwtUtil,
            JwtConfig jwtConfig,
            ObjectMapper objectMapper
    ) {
        this.googleConfig = googleConfig;
        this.userRepository = userRepository;
        this.credentialRepository = credentialRepository;
        this.redisTemplate = redisTemplate;
        this.jwtUtil = jwtUtil;
        this.jwtConfig = jwtConfig;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        this.encryptor = Encryptors.text(googleConfig.getEncryptionPassword(), googleConfig.getEncryptionSalt());
    }

    private static final String STATE_PREFIX = "oauth:state:";
    private static final String PKCE_VERIFIER_PREFIX = "oauth:pkce:";

    public String generateAuthUrl(String frontendRedirectUri) {
        String state = UUID.randomUUID().toString();
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        String validRedirect = googleConfig.getDefaultRedirectUri();
        if (frontendRedirectUri != null && googleConfig.getAllowedFrontendOrigins() != null) {
            for (String allowed : googleConfig.getAllowedFrontendOrigins()) {
                 if (frontendRedirectUri.startsWith(allowed)) {
                     validRedirect = frontendRedirectUri;
                     break;
                 }
            }
        }

        redisTemplate.opsForValue().set(STATE_PREFIX + state, validRedirect, 5, TimeUnit.MINUTES);
        redisTemplate.opsForValue().set(PKCE_VERIFIER_PREFIX + state, codeVerifier, 5, TimeUnit.MINUTES);

        StringBuilder scopeBuilder = new StringBuilder();
        if (googleConfig.getScopes() != null) {
            for (String scope : googleConfig.getScopes()) {
                scopeBuilder.append(scope).append(" ");
            }
        }

        return googleConfig.getAuthorizationEndpoint() +
                "?client_id=" + googleConfig.getClientId() +
                "&redirect_uri=" + googleConfig.getRedirectUri() +
                "&response_type=code" +
                "&scope=" + scopeBuilder.toString().trim().replace(" ", "%20") +
                "&state=" + state +
                "&code_challenge=" + codeChallenge +
                "&code_challenge_method=S256" +
                "&access_type=offline" +
                "&prompt=consent";
    }

    public Map<String, String> processCallback(String code, String state) {
        String storedRedirectUri = redisTemplate.opsForValue().get(STATE_PREFIX + state);
        if (storedRedirectUri == null) {
            throw new IllegalArgumentException("Invalid or expired state parameter");
        }
        
        String codeVerifier = redisTemplate.opsForValue().get(PKCE_VERIFIER_PREFIX + state);
        if (codeVerifier == null) {
             throw new IllegalArgumentException("Invalid or expired PKCE verifier");
        }
        
        redisTemplate.delete(STATE_PREFIX + state);
        redisTemplate.delete(PKCE_VERIFIER_PREFIX + state);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("code", code);
        params.add("client_id", googleConfig.getClientId());
        params.add("client_secret", googleConfig.getClientSecret());
        params.add("redirect_uri", googleConfig.getRedirectUri());
        params.add("grant_type", "authorization_code");
        params.add("code_verifier", codeVerifier);

        JsonNode tokenResponse = restClient.post()
                .uri(googleConfig.getTokenEndpoint())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(params)
                .retrieve()
                .body(JsonNode.class);

        if (tokenResponse == null || !tokenResponse.has("access_token")) {
            throw new RuntimeException("Failed to retrieve access token from Google");
        }

        String accessToken = tokenResponse.get("access_token").asText();
        String refreshToken = tokenResponse.has("refresh_token") ? tokenResponse.get("refresh_token").asText() : null;
        int expiresIn = tokenResponse.has("expires_in") ? tokenResponse.get("expires_in").asInt() : 3600;

        JsonNode userInfo = restClient.get()
                .uri(googleConfig.getUserInfoEndpoint())
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(JsonNode.class);

        if (userInfo == null || !userInfo.has("email")) {
            throw new RuntimeException("Failed to retrieve user info from Google");
        }

        String email = userInfo.get("email").asText();
        String googleId = userInfo.get("sub").asText();
        String name = userInfo.has("name") ? userInfo.get("name").asText() : "";
        String picture = userInfo.has("picture") ? userInfo.get("picture").asText() : "";

        User user = userRepository.findByEmail(email).orElse(null);
        boolean isNewUser = false;
        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
            isNewUser = true;
        }
        
        // 1. Username protection
        if (!user.isUsernameManual()) {
            boolean currentUsernameBlank = user.getUsername() == null || user.getUsername().isBlank();
            if (currentUsernameBlank && name != null && !name.isBlank()) {
                user.setUsername(name.trim());
            } else if (isNewUser && currentUsernameBlank) {
                // Generate a unique fallback if Google provides no name
                user.setUsername("user_" + UUID.randomUUID().toString().substring(0, 8));
            }
        }

        // 2. Avatar protection
        if (!user.isAvatarManual()) {
            boolean currentAvatarBlank = user.getAvatarUrl() == null || user.getAvatarUrl().isBlank();
            if (currentAvatarBlank && picture != null && !picture.isBlank()) {
                user.setAvatarUrl(picture.trim());
            }
        }

        user.setOnline(true);
        user.setLastSeen(LocalDateTime.now(ZoneId.of("UTC")));
        user = userRepository.save(user);

        OAuth2Credential credential = credentialRepository.findByUserIdAndProvider(user.getId(), "google")
                .orElse(new OAuth2Credential());

        credential.setUserId(user.getId());
        credential.setProvider("google");
        credential.setProviderUserId(googleId);
        credential.setAccessToken(encryptor.encrypt(accessToken));
        if (refreshToken != null) {
            credential.setRefreshToken(encryptor.encrypt(refreshToken));
        }
        credential.setExpiresAt(LocalDateTime.now(ZoneId.of("UTC")).plusSeconds(expiresIn));
        credential.setScope(tokenResponse.has("scope") ? tokenResponse.get("scope").asText() : "email profile");
        credential.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        credentialRepository.save(credential);

        String appToken = jwtUtil.generateToken(user);
        
        Map<String, String> result = new HashMap<>();
        result.put("token", appToken);
        result.put("redirectUri", storedRedirectUri);
        return result;
    }
    
    public void refreshCredential(String userId) {
        OAuth2Credential credential = credentialRepository.findByUserIdAndProvider(userId, "google")
                .orElseThrow(() -> new IllegalArgumentException("No Google credential found for user"));

        String refreshToken = encryptor.decrypt(credential.getRefreshToken());
        if (refreshToken == null) {
             throw new IllegalArgumentException("No refresh token available");
        }

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id", googleConfig.getClientId());
        params.add("client_secret", googleConfig.getClientSecret());
        params.add("refresh_token", refreshToken);
        params.add("grant_type", "refresh_token");

        try {
            JsonNode tokenResponse = restClient.post()
                    .uri(googleConfig.getTokenEndpoint())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(params)
                    .retrieve()
                    .body(JsonNode.class);

            if (tokenResponse != null && tokenResponse.has("access_token")) {
                String newAccessToken = tokenResponse.get("access_token").asText();
                String newRefreshToken = tokenResponse.has("refresh_token") ? tokenResponse.get("refresh_token").asText() : null;
                int expiresIn = tokenResponse.has("expires_in") ? tokenResponse.get("expires_in").asInt() : 3600;

                credential.setAccessToken(encryptor.encrypt(newAccessToken));
                if (newRefreshToken != null) {
                    credential.setRefreshToken(encryptor.encrypt(newRefreshToken));
                }
                credential.setExpiresAt(LocalDateTime.now(ZoneId.of("UTC")).plusSeconds(expiresIn));
                credential.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                credentialRepository.save(credential);
            }
        } catch (Exception e) {
            log.error("Failed to refresh Google token", e);
            throw new RuntimeException("Failed to refresh Google token");
        }
    }
    
    public String getAccessToken(String userId) {
        OAuth2Credential credential = credentialRepository.findByUserIdAndProvider(userId, "google")
                .orElseThrow(() -> new IllegalArgumentException("No Google credentials found. Please login with Google first."));

        if (credential.getExpiresAt().isBefore(LocalDateTime.now(ZoneId.of("UTC")).plusMinutes(1))) {
            log.info("Google token expired for user {}, refreshing...", userId);
            refreshCredential(userId);
            credential = credentialRepository.findByUserIdAndProvider(userId, "google")
                    .orElseThrow(() -> new IllegalStateException("Failed to retrieve credentials after refresh"));
        }

        return encryptor.decrypt(credential.getAccessToken());
    }

    public void revokeCredential(String userId) {
        OAuth2Credential credential = credentialRepository.findByUserIdAndProvider(userId, "google")
                .orElseThrow(() -> new IllegalArgumentException("No Google credential found for user"));

        String accessToken = encryptor.decrypt(credential.getAccessToken());

        try {
            restClient.post()
                    .uri(googleConfig.getRevocationEndpoint() + "?token=" + accessToken)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .retrieve()
                    .toBodilessEntity();
            
            credentialRepository.delete(credential);
        } catch (Exception e) {
            log.error("Failed to revoke Google token", e);
            credentialRepository.delete(credential);
        }
    }

    private String generateCodeVerifier() {
        SecureRandom secureRandom = new SecureRandom();
        byte[] codeVerifier = new byte[32];
        secureRandom.nextBytes(codeVerifier);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(codeVerifier);
    }

    private String generateCodeChallenge(String codeVerifier) {
        try {
            byte[] bytes = codeVerifier.getBytes(StandardCharsets.US_ASCII);
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            messageDigest.update(bytes, 0, bytes.length);
            byte[] digest = messageDigest.digest();
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
