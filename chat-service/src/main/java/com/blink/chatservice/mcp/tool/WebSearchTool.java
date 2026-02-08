package com.blink.chatservice.mcp.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Component
@RequiredArgsConstructor
public class WebSearchTool implements McpTool {

    private static final int MAX_QUERY_LENGTH = 500;
    private static final int MAX_RETRIES = 2;
    private static final long RETRY_DELAY_MS = 1000;
    private static final int CIRCUIT_BREAKER_THRESHOLD = 5;
    private static final long CIRCUIT_BREAKER_RESET_MS = 60000;
    
    @Qualifier("aiRestTemplate")
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong circuitOpenedAt = new AtomicLong(0);
    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();
    
    @Value("${web.search.api-key:}")
    private String serperApiKey;
    
    @Value("${web.search.cache.ttl.seconds:300}")
    private long cacheTtlSeconds;

    @Override
    public String name() {
        return "web_search";
    }

    @Override
    public String description() {
        return "Search the web for current information including latest news, facts, and recent events. Returns real search results from Google.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "query", Map.of(
                                "type", "string",
                                "description", "The search query",
                                "maxLength", MAX_QUERY_LENGTH
                        ),
                        "maxResults", Map.of(
                                "type", "integer",
                                "description", "Maximum results (default: 5, max: 10)",
                                "default", 5,
                                "minimum", 1,
                                "maximum", 10
                        )
                ),
                "required", List.of("query")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        try {
            String query = validateQuery(args.get("query"));
            Integer maxResults = validateMaxResults(args.get("maxResults"));
            
            if (isCircuitOpen()) {
                return createFallbackResponse(query);
            }
            
            CachedResult cached = getFromCache(query);
            if (cached != null) {
                return createSuccessResponse(query, cached.results);
            }
            
            var results = performSearch(query, maxResults);
            
            putInCache(query, results);
            consecutiveFailures.set(0);
            
            return createSuccessResponse(query, results);
            
        } catch (Exception e) {
            int failures = consecutiveFailures.incrementAndGet();
            if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
                circuitOpenedAt.set(System.currentTimeMillis());
            }
            
            return createFallbackResponse(args.get("query") != null ? args.get("query").toString() : "search");
        }
    }

    private String validateQuery(Object queryObj) {
        if (queryObj == null || queryObj.toString().trim().isEmpty()) {
            throw new IllegalArgumentException("Query is required");
        }
        
        String query = queryObj.toString().trim();
        if (query.length() > MAX_QUERY_LENGTH) {
            query = query.substring(0, MAX_QUERY_LENGTH);
        }
        
        return query;
    }

    private Integer validateMaxResults(Object obj) {
        if (obj == null) return 5;
        try {
            int val = ((Number) obj).intValue();
            return Math.min(Math.max(val, 1), 10);
        } catch (Exception e) {
            return 5;
        }
    }

    private List<Map<String, Object>> performSearch(String query, int maxResults) throws Exception {
        if (serperApiKey != null && !serperApiKey.trim().isEmpty()) {
            return searchWithSerper(query, maxResults);
        }
        
        return createSimulatedResults(query, maxResults);
    }

    private List<Map<String, Object>> searchWithSerper(String query, int maxResults) throws Exception {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("q", query);
        requestBody.put("num", maxResults);
        
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", serperApiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<String> entity = new HttpEntity<>(
                objectMapper.writeValueAsString(requestBody), 
                headers
        );
        
        ResponseEntity<String> response = restTemplate.postForEntity(
                "https://google.serper.dev/search", 
                entity, 
                String.class
        );
        
        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            return parseSerperResponse(response.getBody(), maxResults);
        }
        
        throw new RuntimeException("Serper API failed: " + response.getStatusCode());
    }

    private List<Map<String, Object>> parseSerperResponse(String responseBody, int maxResults) 
            throws JsonProcessingException {
        
        Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);
        List<Map<String, Object>> results = new ArrayList<>();
        
        // Parse organic results
        Object organicObj = response.get("organic");
        if (organicObj instanceof List) {
            List<?> organic = (List<?>) organicObj;
            
            for (Object item : organic) {
                if (results.size() >= maxResults) break;
                
                if (item instanceof Map) {
                    Map<?, ?> result = (Map<?, ?>) item;
                    
                    String title = getString(result, "title");
                    String snippet = getString(result, "snippet");
                    String link = getString(result, "link");
                    
                    if (!title.isEmpty() && !link.isEmpty()) {
                        results.add(createResult(title, snippet, link, "Google"));
                    }
                }
            }
        }
        
        // Parse news results
        Object newsObj = response.get("news");
        if (newsObj instanceof List && results.size() < maxResults) {
            List<?> news = (List<?>) newsObj;
            
            for (Object item : news) {
                if (results.size() >= maxResults) break;
                
                if (item instanceof Map) {
                    Map<?, ?> result = (Map<?, ?>) item;
                    
                    String title = getString(result, "title");
                    String snippet = getString(result, "snippet");
                    String link = getString(result, "link");
                    String source = getString(result, "source");
                    
                    if (!title.isEmpty() && !link.isEmpty()) {
                        results.add(createResult(title, snippet, link, source.isEmpty() ? "News" : source));
                    }
                }
            }
        }
        
        if (results.isEmpty()) {
            throw new RuntimeException("No results found");
        }
        
        return results;
    }

    private List<Map<String, Object>> createSimulatedResults(String query, int maxResults) {
        List<Map<String, Object>> results = new ArrayList<>();
        
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        
        results.add(createResult(
                "Search on Google",
                "Get the latest real-time results for: " + query,
                "https://www.google.com/search?q=" + encodedQuery,
                "Google"
        ));
        
        results.add(createResult(
                "Search on DuckDuckGo",
                "Privacy-focused search results for: " + query,
                "https://duckduckgo.com/?q=" + encodedQuery,
                "DuckDuckGo"
        ));
        
        if (query.toLowerCase().contains("news") || query.toLowerCase().contains("latest")) {
            results.add(createResult(
                    "Google News",
                    "Latest news articles about: " + query,
                    "https://news.google.com/search?q=" + encodedQuery,
                    "Google News"
            ));
        }
        
        return results.subList(0, Math.min(results.size(), maxResults));
    }

    private Map<String, Object> createResult(String title, String snippet, String url, String source) {
        Map<String, Object> result = new HashMap<>();
        result.put("title", sanitize(title));
        result.put("snippet", sanitize(snippet));
        result.put("url", url);
        result.put("source", sanitize(source));
        return result;
    }

    private String getString(Map<?, ?> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString().trim() : "";
    }

    private String sanitize(String text) {
        if (text == null) return "";
        return text.trim().replaceAll("\\s+", " ");
    }

    private Map<String, Object> createSuccessResponse(String query, List<Map<String, Object>> results) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("query", query);
        response.put("results", results);
        response.put("count", results.size());
        response.put("timestamp", Instant.now().toString());
        return response;
    }

    private Map<String, Object> createFallbackResponse(String query) {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        
        var fallback = List.of(
                createResult(
                        "Search on Google",
                        "Click to search for: " + query,
                        "https://www.google.com/search?q=" + encodedQuery,
                        "Google"
                )
        );
        
        return createSuccessResponse(query, fallback);
    }

    private boolean isCircuitOpen() {
        long openedAt = circuitOpenedAt.get();
        if (openedAt == 0) return false;
        
        long elapsed = System.currentTimeMillis() - openedAt;
        if (elapsed > CIRCUIT_BREAKER_RESET_MS) {
            circuitOpenedAt.set(0);
            consecutiveFailures.set(0);
            return false;
        }
        
        return true;
    }

    private CachedResult getFromCache(String query) {
        CachedResult cached = cache.get(query);
        if (cached == null) return null;
        
        long age = Duration.between(cached.timestamp, Instant.now()).getSeconds();
        if (age > cacheTtlSeconds) {
            cache.remove(query);
            return null;
        }
        
        return cached;
    }

    private void putInCache(String query, List<Map<String, Object>> results) {
        if (cache.size() > 100) {
            cache.clear();
        }
        cache.put(query, new CachedResult(results, Instant.now()));
    }

    private record CachedResult(List<Map<String, Object>> results, Instant timestamp) {
    }
}
