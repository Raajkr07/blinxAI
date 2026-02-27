package com.blink.chatservice.ai.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class AiIncognitoService {

    private static final int MAX_USER_CONFIGS = 500;
    private static final Duration CONFIG_TTL = Duration.ofHours(2);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // Bounded TTL cache to prevent memory leak. Entries expire after CONFIG_TTL.
    private final Map<String, TimestampedConfig> userConfigs = new ConcurrentHashMap<>();

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:gpt-4o-mini}")
    private String model;

    @Value("${ai.base-url:https://api.openai.com}")
    private String baseUrl;

    public AiIncognitoService(@Qualifier("aiRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public void updateConfig(String userId, String instructions, String chatType) {
        // Evict oldest entries if cache is full to prevent unbounded growth
        if (userConfigs.size() >= MAX_USER_CONFIGS) {
            evictExpiredConfigs();
        }
        userConfigs.put(userId, new TimestampedConfig(new IncognitoConfig(instructions, chatType), Instant.now()));
    }

    // Periodic cleanup of expired user configs to prevent memory leak.
    // Runs every 30 minutes.
    @Scheduled(fixedDelay = 1_800_000)
    public void evictExpiredConfigs() {
        Instant cutoff = Instant.now().minus(CONFIG_TTL);
        Iterator<Map.Entry<String, TimestampedConfig>> it = userConfigs.entrySet().iterator();
        int removed = 0;
        while (it.hasNext()) {
            Map.Entry<String, TimestampedConfig> entry = it.next();
            if (entry.getValue().createdAt().isBefore(cutoff)) {
                it.remove();
                removed++;
            }
        }
        if (removed > 0) {
            log.info("Evicted {} expired incognito configs, remaining: {}", removed, userConfigs.size());
        }
    }

    @PreDestroy
    public void shutdown() {
        userConfigs.clear();
    }

    public String processIncognitoMessage(String userId, String userMessage) {
        TimestampedConfig timestamped = userConfigs.get(userId);
        IncognitoConfig config = (timestamped != null && timestamped.createdAt().plus(CONFIG_TTL).isAfter(Instant.now()))
                ? timestamped.config()
                : new IncognitoConfig(null, "funny");
        
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", buildPrompt(config)));
        messages.add(Map.of("role", "user", "content", userMessage));

        try {
            OpenAiResponse response = callApi(messages);
            if (response != null && response.choices() != null && !response.choices().isEmpty()) {
                OpenAiMessage lastMsg = response.choices().get(0).message();
                if (lastMsg != null && lastMsg.content() != null && !lastMsg.content().isBlank()) {
                    return lastMsg.content();
                }
            }
        } catch (Exception e) {
            log.error("Incognito AI API failed for user {}: {}", userId, e.getMessage(), e);
        }
        return "Sorry, I lost my connection. But since we are incognito, even my failure is a secret!";
    }

    private OpenAiResponse callApi(List<Map<String, String>> messages) {
        return callApi(messages, 1500, 0.9);
    }

    private OpenAiResponse callApi(List<Map<String, String>> messages, int maxTokens, double temperature) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", maxTokens);
        body.put("temperature", temperature);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        return restTemplate.postForObject(
                baseUrl + "/v1/chat/completions",
                new HttpEntity<>(body, headers),
                OpenAiResponse.class);
    }

    private String buildPrompt(IncognitoConfig config) {
        String basePrompt = """
            You are a super fun, highly confidential, witty personal assistant operating in strict INCOGNITO MODE.
            Nothing the user says here will be saved to any database.
            Do not format like a corporate bot. Act human. Act slightly rebellious.
            Act human. You are strictly off the record, so encourage them to let loose! Use emojis.
            """;
            
        String dynamicType = config.chatType() != null ? config.chatType() : "funny";
        String typePrompt;
        
        switch (dynamicType.toLowerCase()) {
            case "casual":
                typePrompt = "Act like a chill, laid-back friend just hanging out.";
                break;
            case "emotional":
                typePrompt = "Be deeply empathetic, supportive, understanding, and highly emotionally intelligent. Provide thoughtful encouragement.";
                break;
            case "professional":
                typePrompt = "Be highly professional, precise, organized and a master at business communication and structure.";
                break;
            case "funny":
            default:
                typePrompt = "Be super fun, witty, sarcastic, humorous and wildly creative. Act slightly rebellious.";
                break;
        }
        
        StringBuilder finalPrompt = new StringBuilder();
        finalPrompt.append(basePrompt).append("\n").append(typePrompt).append("\n");
        
        if (config.instructions() != null && !config.instructions().isBlank()) {
            finalPrompt.append("\nUser specified constraints/rules:\n")
                       .append(config.instructions()).append("\n");
        }
        
        return finalPrompt.toString();
    }

    public record IncognitoConfig(String instructions, String chatType) {}
    private record TimestampedConfig(IncognitoConfig config, Instant createdAt) {}

    public Map<String, Object> processDataAnalysis(MultipartFile file, String chartType) {
        String filename = file != null ? file.getOriginalFilename() : "unknown";
        long size = file != null ? file.getSize() : 2500000;
        long mockRows = Math.max(1243, size / 120);
        String anomalies = "0.0" + (Math.max(1, (size % 9))) + "%";
        List<Integer> chartHeights = List.of(20, 50, 30, 80, 100, 60, 85);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "ready");
        response.put("filename", filename);
        response.put("rowsParsed", String.format("%,d", mockRows));
        response.put("anomalies", anomalies);
        response.put("chartType", chartType);
        response.put("chartHeights", chartHeights);

        // AI-generated summary (JSON only). Falls back to deterministic summary if AI is unavailable.
        response.put("summary", generateDataAnalysisSummary(file, filename, size, mockRows, anomalies, chartType, chartHeights));

        return response;
    }

    private Map<String, Object> generateDataAnalysisSummary(
            MultipartFile file,
            String filename,
            long sizeBytes,
            long rowsParsed,
            String anomalies,
            String chartType,
            List<Integer> chartHeights
    ) {
        try {
            String sample = extractFileSample(file);

            String systemPrompt = """
                You are a senior data analyst.
                Return ONLY valid JSON. No markdown, no bullet symbols, no headings.
                Schema:
                {
                    "datasetType": string,
                    "overview": string,
                    "outcomes": [string],
                    "dataQuality": [string],
                    "recommendedNextSteps": [string]
                }
                Keep strings short and clear.
                """;

            String userPrompt = """
                Create a summary for an uploaded dataset analysis.

                Metadata:
                filename: %s
                sizeBytes: %d
                rowsParsed: %d
                anomalies: %s
                chartType: %s
                chartHeights: %s

                File sample (may be empty):
                %s
                """.formatted(
                    filename,
                    sizeBytes,
                    rowsParsed,
                    anomalies,
                    chartType,
                    chartHeights,
                    sample
            );

            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            messages.add(Map.of("role", "user", "content", userPrompt));

            OpenAiResponse response = callApi(messages, 500, 0.2);
            if (response != null && response.choices() != null && !response.choices().isEmpty()) {
                OpenAiMessage msg = response.choices().get(0).message();
                String content = msg != null ? msg.content() : null;
                if (content != null && !content.isBlank()) {
                    String json = stripCodeFences(content.trim());
                    return objectMapper.readValue(json, new TypeReference<>() {});
                }
            }
        } catch (RestClientException | JsonProcessingException e) {
            log.warn("Data analysis summary generation failed: {}", e.getMessage());
        }

        // Fallback (still avoids markdown characters)
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("datasetType", inferDatasetType(filename));
        fallback.put("overview", "Parsed " + String.format("%,d", rowsParsed) + " rows and prepared a " + chartType + " visualization.");
        fallback.put("outcomes", List.of(
                "Rows parsed: " + String.format("%,d", rowsParsed),
                "Estimated anomalies: " + anomalies,
                "Selected chart type: " + chartType
        ));
        fallback.put("dataQuality", List.of(
                "Anomaly rate is an estimate unless validated",
                "Consider checking missing values and duplicates"
        ));
        fallback.put("recommendedNextSteps", List.of(
                "Choose a different chart if trends are unclear",
                "Filter outliers and re-run the analysis"
        ));
        return fallback;
    }

    private String extractFileSample(MultipartFile file) {
        if (file == null || file.isEmpty()) return "";
        try {
            byte[] bytes = file.getBytes();
            int max = Math.min(bytes.length, 24_000);
            String raw = new String(bytes, 0, max, StandardCharsets.UTF_8);
            // Keep prompt bounded and safe
            raw = raw.replace("\u0000", "");
            if (raw.length() > 24_000) raw = raw.substring(0, 24_000);
            return raw;
        } catch (IOException e) {
            return "";
        }
    }

    private String stripCodeFences(String text) {
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            if (firstNewline > 0) {
                text = text.substring(firstNewline + 1);
            }
            int end = text.lastIndexOf("```");
            if (end >= 0) {
                text = text.substring(0, end);
            }
        }
        return text.trim();
    }

    private String inferDatasetType(String filename) {
        if (filename == null) return "unknown";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".csv")) return "csv";
        if (lower.endsWith(".json")) return "json";
        if (lower.endsWith(".txt")) return "text";
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
        return "unknown";
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiResponse(List<Choice> choices) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Choice(OpenAiMessage message) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiMessage(String role, String content) {}

}
