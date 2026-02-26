package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
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
        return "Create a Google Calendar event. Write the title like a real person would — 'Coffee with Raj' not 'Meeting: Coffee Discussion'.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "title", Map.of("type", "string", "description", "Short, natural event title. Write like a real person: 'Lunch with Priya', 'Dentist appointment', 'Team standup'. No corporate jargon."),
                "description", Map.of("type", "string", "description", "Brief personal note about the event. 1-2 lines max. 'Discussing the new feature rollout' not 'This meeting is scheduled to facilitate discussion regarding upcoming product deliverables'."),
                "startTime", Map.of("type", "string", "description", "Start time (DD-MM-YYYYTHH:MM:SS)"),
                "endTime", Map.of("type", "string", "description", "End time (optional, defaults to +1hr)"),
                "location", Map.of("type", "string", "description", "Location or meeting link"),
                "timeZone", Map.of("type", "string", "description", "Timezone (default: Asia/Kolkata)")
            ),
            "required", List.of("title", "startTime")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String title = (String) args.get("title");
        String description = (String) args.getOrDefault("description", "");
        String startDateStr = (String) args.get("startTime");
        String endDateStr = (String) args.get("endTime");
        String timezone = (String) args.getOrDefault("timeZone", "Asia/Kolkata");
        String location = (String) args.getOrDefault("location", "");

        if (title == null || title.isBlank() || startDateStr == null || startDateStr.isBlank()) {
            return Map.of("error", true, "message", "Title and startTime are required.");
        }
        if (title.length() > 500) {
            return Map.of("error", true, "message", "Title too long (max 500 chars).");
        }

        try {
            log.info("Adding calendar event for user {}: {} in timezone {}", userId, title, timezone);
            String accessToken = oAuthService.getAccessToken(userId);

            // Robust Date Parsing for dd-MM-yyyy
            LocalDateTime startLdt = parseDateTime(startDateStr);
            LocalDateTime endLdt;
            if (endDateStr != null && !endDateStr.isBlank()) {
                endLdt = parseDateTime(endDateStr);
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

        } catch (IllegalArgumentException e) {
            // No Google credentials linked
            log.warn("No Google credentials for user {}: {}", userId, e.getMessage());
            return Map.of("success", false,
                "message", "You don't have permission to access Google Calendar. Please link your Google account in Settings.",
                "error_type", "PERMISSION_DENIED");
        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Failed to add Google Calendar event for user {}: {}", userId, errMsg, e);

            // Check for permission/auth errors from Google API
            if (isPermissionError(errMsg)) {
                return Map.of("success", false,
                    "message", "You don't have permission to create calendar events. Please re-link your Google account in Settings to grant calendar access.",
                    "error_type", "PERMISSION_DENIED");
            }

            Map<String, Object> errorPayload = new LinkedHashMap<>();
            errorPayload.put("title", title);
            errorPayload.put("description", description);
            errorPayload.put("startTime", startDateStr);
            errorPayload.put("location", location);
            errorPayload.put("error", errMsg);
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/actions", Map.of(
                "type", "ADD_TO_CALENDAR_REQUEST",
                "payload", errorPayload
            ));
            return Map.of("error", true, "message", "Failed to add to calendar: " + errMsg);
        }
    }

    private boolean isPermissionError(String errMsg) {
        return errMsg.contains("403") || errMsg.contains("401")
                || errMsg.contains("Forbidden") || errMsg.contains("insufficient")
                || errMsg.contains("Unauthorized") || errMsg.contains("No Google credentials")
                || errMsg.contains("PERMISSION_DENIED") || errMsg.contains("access_denied");
    }

    private LocalDateTime parseDateTime(String dateStr) {
        String clean = dateStr.replace(" ", "T").replace("Z", "");
        if (clean.contains("T")) {
            String timePart = clean.substring(clean.indexOf("T") + 1);
            String datePart = clean.substring(0, clean.indexOf("T"));
            if (timePart.length() == 5) timePart += ":00";
            else if (timePart.length() > 8) timePart = timePart.substring(0, 8);

            return parseDatePart(datePart).atTime(LocalTime.parse(timePart));
        } else {
            return parseDatePart(clean).atStartOfDay();
        }
    }

    private LocalDate parseDatePart(String datePart) {
        if (datePart == null || datePart.isBlank()) {
            throw new IllegalArgumentException("Date is required");
        }
        try {
            if (datePart.contains("-")) {
                String[] parts = datePart.split("-");
                if (parts[0].length() == 4) return LocalDate.parse(datePart); // yyyy-MM-dd
                return LocalDate.parse(datePart, DateTimeFormatter.ofPattern("dd-MM-yyyy"));
            }
            return LocalDate.parse(datePart);
        } catch (Exception e) {
            log.warn("Could not parse date '{}', falling back to today", datePart);
            return LocalDate.now();
        }
    }
}
