package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReadEmailsTool implements McpTool {

    private final OAuthService oAuthService;
    private final ObjectMapper objectMapper;
    private final RestClient aiRestClient;

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int DEFAULT_MAX_RESULTS = 20;
    private static final DateTimeFormatter DD_MM_YYYY = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    @Override
    public String name() {
        return "read_emails";
    }

    @Override
    public String description() {
        return "Read emails from Gmail inbox by date (today/yesterday/DD-MM-YYYY) or date range.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "dateFilter", Map.of("type", "string", "description",
                    "Date filter: 'today', 'yesterday', or a specific date in DD-MM-YYYY format"),
                "startDate", Map.of("type", "string", "description",
                    "Start date for range filter (DD-MM-YYYY). Use with endDate for custom ranges."),
                "endDate", Map.of("type", "string", "description",
                    "End date for range filter (DD-MM-YYYY). Defaults to startDate if not provided."),
                "query", Map.of("type", "string", "description",
                    "Gmail search query (e.g. 'from:x@gmail.com', 'is:unread')"),
                "maxResults", Map.of("type", "integer", "description",
                    "Max emails to return (default 20, max 50)"),
                "labelFilter", Map.of("type", "string", "description",
                    "Label filter: INBOX, SENT, STARRED, UNREAD, ALL, PRIMARY (default INBOX)")
            ),
            "required", List.of("dateFilter")
        );
    }

    @Override
    @SuppressWarnings("unchecked")
    public Object execute(String userId, Map<Object, Object> arguments) {
        String dateFilter = (String) arguments.get("dateFilter");
        String startDateStr = (String) arguments.get("startDate");
        String endDateStr = (String) arguments.get("endDate");
        String userQuery = (String) arguments.get("query");
        String labelFilter = (String) arguments.getOrDefault("labelFilter", "INBOX");
        int maxResults = DEFAULT_MAX_RESULTS;

        Object maxResultsObj = arguments.get("maxResults");
        if (maxResultsObj != null) {
            maxResults = Math.min(maxResultsObj instanceof Integer ? (Integer) maxResultsObj :
                    Integer.parseInt(maxResultsObj.toString()), 50);
        }

        try {
            String accessToken = oAuthService.getAccessToken(userId);

            // Build date-based Gmail query
            String gmailQuery = buildDateQuery(dateFilter, startDateStr, endDateStr);
            if (userQuery != null && !userQuery.isBlank()) {
                gmailQuery += " " + userQuery;
            }

            log.info("Reading emails for user {} with query: '{}', label: {}, max: {}",
                    userId, gmailQuery, labelFilter, maxResults);

            // Step 1: List message IDs
            String listUrl = String.format(
                "https://www.googleapis.com/gmail/v1/users/me/messages?q=%s&labelIds=%s&maxResults=%d",
                URLEncoder.encode(gmailQuery, StandardCharsets.UTF_8),
                URLEncoder.encode(labelFilter, StandardCharsets.UTF_8),
                maxResults
            );

            String listResponse = aiRestClient.get()
                    .uri(listUrl)
                    .header("Authorization", "Bearer " + accessToken)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(String.class);

            Map<String, Object> listResult = objectMapper.readValue(listResponse, Map.class);

            List<Map<String, String>> messageRefs = (List<Map<String, String>>) listResult.get("messages");
            if (messageRefs == null || messageRefs.isEmpty()) {
                return Map.of(
                    "success", true,
                    "count", 0,
                    "emails", List.of(),
                    "message", "No emails found for the specified filter.",
                    "query_used", gmailQuery
                );
            }

            // Step 2: Fetch each message's details
            List<Map<String, Object>> emails = new ArrayList<>();
            for (Map<String, String> ref : messageRefs) {
                try {
                    Map<String, Object> emailDetail = fetchEmailDetail(accessToken, ref.get("id"));
                    if (emailDetail != null) {
                        emails.add(emailDetail);
                    }
                } catch (Exception e) {
                    log.warn("Failed to fetch email {}: {}", ref.get("id"), e.getMessage());
                }
            }

            // Sort by timestamp descending (newest first)
            emails.sort((a, b) -> {
                long tsA = (long) a.getOrDefault("timestamp_epoch", 0L);
                long tsB = (long) b.getOrDefault("timestamp_epoch", 0L);
                return Long.compare(tsB, tsA);
            });

            return Map.of(
                "success", true,
                "count", emails.size(),
                "emails", emails,
                "query_used", gmailQuery,
                "hint", "You can now summarize these emails, extract tasks/events, or help the user reply to any of them using the reply_email or send_email tool."
            );

        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Failed to read emails for user {}: {}", userId, errMsg, e);
            if (errMsg.contains("403") || errMsg.contains("401") || errMsg.contains("Forbidden")
                    || errMsg.contains("insufficient") || errMsg.contains("Unauthorized")
                    || errMsg.contains("No Google credentials")) {
                return Map.of("success", false,
                    "message", "Email access not authorized. Please re-link your Google account in Settings to grant email permissions.",
                    "error_type", "PERMISSION_DENIED");
            }
            return Map.of("success", false, "message", "Failed to read emails: " + errMsg);
        }
    }

    private String buildDateQuery(String dateFilter, String startDateStr, String endDateStr) {
        LocalDate startDate;
        LocalDate endDate;
        LocalDate today = LocalDate.now(IST);

        if (dateFilter != null && !dateFilter.isBlank()) {
            switch (dateFilter.toLowerCase().trim()) {
                case "today":
                    startDate = today;
                    endDate = today;
                    break;
                case "yesterday":
                    startDate = today.minusDays(1);
                    endDate = today.minusDays(1);
                    break;
                case "this_week":
                case "this week":
                    startDate = today.with(DayOfWeek.MONDAY);
                    endDate = today;
                    break;
                case "last_week":
                case "last week":
                    startDate = today.minusWeeks(1).with(DayOfWeek.MONDAY);
                    endDate = today.minusWeeks(1).with(DayOfWeek.SUNDAY);
                    break;
                default:
                    // Try parsing as a date
                    try {
                        startDate = LocalDate.parse(dateFilter, DD_MM_YYYY);
                        endDate = startDate;
                    } catch (Exception e) {
                        startDate = today;
                        endDate = today;
                    }
                    break;
            }
        } else if (startDateStr != null) {
            startDate = LocalDate.parse(startDateStr, DD_MM_YYYY);
            endDate = (endDateStr != null) ? LocalDate.parse(endDateStr, DD_MM_YYYY) : startDate;
        } else {
            startDate = today;
            endDate = today;
        }

        // Gmail uses 'after:YYYY/MM/DD before:YYYY/MM/DD' format
        // 'after' is exclusive, 'before' is exclusive, so adjust
        String afterDate = startDate.format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        String beforeDate = endDate.plusDays(1).format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));

        return "after:" + afterDate + " before:" + beforeDate;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchEmailDetail(String accessToken, String messageId) {
        String url = String.format(
            "https://www.googleapis.com/gmail/v1/users/me/messages/%s?format=full",
            messageId
        );

        String response = aiRestClient.get()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(String.class);

        try {
            Map<String, Object> msg = objectMapper.readValue(response, Map.class);
            Map<String, Object> payload = (Map<String, Object>) msg.get("payload");

            if (payload == null) return null;

            List<Map<String, String>> headers = (List<Map<String, String>>) payload.get("headers");

            String from = getHeader(headers, "From");
            String to = getHeader(headers, "To");
            String subject = getHeader(headers, "Subject");
            String date = getHeader(headers, "Date");
            String replyTo = getHeader(headers, "Reply-To");
            String messageIdHeader = getHeader(headers, "Message-ID");

            String snippet = (String) msg.getOrDefault("snippet", "");
            String threadId = (String) msg.get("threadId");
            long internalDate = Long.parseLong(msg.getOrDefault("internalDate", "0").toString());
            List<String> labelIds = (List<String>) msg.getOrDefault("labelIds", List.of());

            // Extract body text
            String body = extractBodyText(payload);

            // Format the timestamp
            String formattedTime = "";
            if (internalDate > 0) {
                Instant instant = Instant.ofEpochMilli(internalDate);
                formattedTime = LocalDateTime.ofInstant(instant, IST)
                        .format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
            }

            Map<String, Object> emailInfo = new LinkedHashMap<>();
            emailInfo.put("messageId", messageId);
            emailInfo.put("threadId", threadId);
            emailInfo.put("from", from);
            emailInfo.put("to", to);
            emailInfo.put("subject", subject != null ? subject : "(No Subject)");
            emailInfo.put("snippet", snippet);
            emailInfo.put("body", body != null && body.length() > 2000 ? body.substring(0, 2000) + "..." : body);
            emailInfo.put("date", date);
            emailInfo.put("formatted_time", formattedTime);
            emailInfo.put("timestamp_epoch", internalDate);
            emailInfo.put("labels", labelIds);
            emailInfo.put("is_unread", labelIds.contains("UNREAD"));
            emailInfo.put("is_starred", labelIds.contains("STARRED"));
            if (replyTo != null) emailInfo.put("replyTo", replyTo);
            if (messageIdHeader != null) emailInfo.put("messageIdHeader", messageIdHeader);

            return emailInfo;

        } catch (Exception e) {
            log.warn("Error parsing email {}: {}", messageId, e.getMessage());
            return null;
        }
    }

    private String getHeader(List<Map<String, String>> headers, String name) {
        if (headers == null) return null;
        return headers.stream()
                .filter(h -> name.equalsIgnoreCase(h.get("name")))
                .map(h -> h.get("value"))
                .findFirst()
                .orElse(null);
    }

    @SuppressWarnings("unchecked")
    private String extractBodyText(Map<String, Object> payload) {
        // Check for direct body data
        Map<String, Object> body = (Map<String, Object>) payload.get("body");
        if (body != null && body.get("data") != null) {
            return decodeBase64Url((String) body.get("data"));
        }

        // Check parts recursively
        List<Map<String, Object>> parts = (List<Map<String, Object>>) payload.get("parts");
        if (parts != null) {
            // Prefer text/plain first
            for (Map<String, Object> part : parts) {
                String mimeType = (String) part.get("mimeType");
                if ("text/plain".equals(mimeType)) {
                    Map<String, Object> partBody = (Map<String, Object>) part.get("body");
                    if (partBody != null && partBody.get("data") != null) {
                        return decodeBase64Url((String) partBody.get("data"));
                    }
                }
            }
            // Fallback to text/html
            for (Map<String, Object> part : parts) {
                String mimeType = (String) part.get("mimeType");
                if ("text/html".equals(mimeType)) {
                    Map<String, Object> partBody = (Map<String, Object>) part.get("body");
                    if (partBody != null && partBody.get("data") != null) {
                        String html = decodeBase64Url((String) partBody.get("data"));
                        // Strip HTML tags for plain text
                        return html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
                    }
                }
            }
            // Check multipart nested parts
            for (Map<String, Object> part : parts) {
                String mimeType = (String) part.get("mimeType");
                if (mimeType != null && mimeType.startsWith("multipart/")) {
                    String nested = extractBodyText(part);
                    if (nested != null) return nested;
                }
            }
        }
        return null;
    }

    private String decodeBase64Url(String data) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(data);
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Base64 decode failed: {}", e.getMessage());
            return null;
        }
    }
}
