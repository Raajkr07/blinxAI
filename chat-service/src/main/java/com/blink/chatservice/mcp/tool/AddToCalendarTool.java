package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AddToCalendarTool implements McpTool {

    private final SimpMessagingTemplate messagingTemplate;
    private final OAuthService oAuthService;
    private final RestClient restClient = RestClient.create();

    @Override
    public String name() {
        return "add_to_calendar";
    }

    @Override
    public String description() {
        return "Directly add an event to the user's Google Calendar. " +
               "CRITICAL: Always look back at the conversation history to extract the date, time, and context. " +
               "If a date (e.g., '20th Feb') or time was mentioned earlier, use it automatically. " +
               "Only ask the user if the information is genuinely missing or highly ambiguous. " +
               "Write even summaries in professional Indian English style.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "title", Map.of("type", "string", "description", "Engaging, professional Indian English title. Avoid 'Meeting' or 'Date' - use 'Coffee catch-up with Raj Kumar' etc."),
                "description", Map.of("type", "string", "description", "Rich, human-like description that connects with the context. Write it like a personal note."),
                "startTime", Map.of("type", "string", "description", "Start time (ISO 8601: YYYY-MM-DDTHH:MM:SS)"),
                "endTime", Map.of("type", "string", "description", "End time (optional)"),
                "location", Map.of("type", "string", "description", "Location or link (optional)"),
                "timeZone", Map.of("type", "string", "description", "User's timezone (e.g. 'Asia/Kolkata') if known")
            ),
            "required", List.of("title", "startTime")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String title = (String) args.get("title");
        String description = (String) args.getOrDefault("description", "");
        String startDateStr = (String) args.get("startTime");
        String endDateStr = (String) args.get("endTime");
        String timezone = (String) args.getOrDefault("timeZone", "Asia/Kolkata");
        String location = (String) args.getOrDefault("location", "");

        if (title == null || startDateStr == null) {
            return Map.of("error", true, "message", "Title and startTime are required");
        }

        try {
            log.info("Adding calendar event for user {}: {} in timezone {}", userId, title, timezone);
            String accessToken = oAuthService.getAccessToken(userId);

            // Robust Date Parsing
            String rawStart = startDateStr.replace(" ", "T");
            String startPart = rawStart.contains("T") ? rawStart.substring(0, 19).replace("Z", "") : rawStart;
            if (startPart.length() == 10) startPart += "T00:00:00";
            else if (startPart.length() == 16) startPart += ":00";
            
            LocalDateTime startLdt = LocalDateTime.parse(startPart.substring(0, 19));
            
            LocalDateTime endLdt;
            if (endDateStr != null && !endDateStr.isBlank()) {
                String rawEnd = endDateStr.replace(" ", "T");
                String endPart = rawEnd.contains("T") ? rawEnd.substring(0, 19).replace("Z", "") : rawEnd;
                if (endPart.length() == 10) endPart += "T00:00:00";
                else if (endPart.length() == 16) endPart += ":00";
                endLdt = LocalDateTime.parse(endPart.substring(0, 19));
            } else {
                endLdt = startLdt.plusHours(1);
            }

            // Google requires RFC3339. ALWAYS include seconds.
            DateTimeFormatter gFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
            String startIso = startLdt.format(gFormat);
            String endIso = endLdt.format(gFormat);

            Map<String, Object> requestBody = Map.of(
                "summary", title,
                "description", description,
                "location", location,
                "start", Map.of("dateTime", startIso, "timeZone", timezone),
                "end", Map.of("dateTime", endIso, "timeZone", timezone)
            );

            log.info("Sending GCal Request: {}", requestBody);

            restClient.post()
                    .uri("https://www.googleapis.com/calendar/v3/calendars/primary/events")
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toBodilessEntity();

            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "ADD_TO_CALENDAR_REQUEST",
                "payload", Map.of(
                    "title", title,
                    "description", description,
                    "startTime", startIso,
                    "location", location,
                    "googleCalendarUrl", "https://calendar.google.com/calendar/r/eventedit?text=" + URLEncoder.encode(title, StandardCharsets.UTF_8) + "&dates=" + startIso.replace("-", "").replace(":", "") + "/" + endIso.replace("-", "").replace(":", ""),
                    "success", true
                )
            ));

            return Map.of("success", true, "message", "Event '" + title + "' successfully added to Google Calendar.");

        } catch (Exception e) {
            log.error("Failed to add Google Calendar event for user {}: {}", userId, e.getMessage(), e);
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "ADD_TO_CALENDAR_REQUEST",
                "payload", Map.of(
                    "title", title,
                    "description", description,
                    "startTime", startDateStr,
                    "location", location,
                    "error", e.getMessage()
                )
            ));
            return Map.of("error", true, "message", "Failed to add to calendar: " + e.getMessage());
        }
    }
}
