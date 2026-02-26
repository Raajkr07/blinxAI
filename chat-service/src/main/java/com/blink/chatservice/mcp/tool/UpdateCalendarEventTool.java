package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

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
public class UpdateCalendarEventTool implements McpTool {

    private final OAuthService oAuthService;
    private final RestClient restClient = RestClient.create();

    @Override
    public String name() {
        return "update_calendar_event";
    }

    @Override
    public String description() {
        return "Update or reschedule an existing Google Calendar event. Use natural titles and descriptions.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "eventId", Map.of("type", "string", "description", "Event ID from read_calendar_events"),
                "title", Map.of("type", "string", "description", "New title — keep it short and natural like 'Coffee with Raj'"),
                "description", Map.of("type", "string", "description", "Brief personal note, 1-2 lines"),
                "startTime", Map.of("type", "string", "description", "New start time (DD-MM-YYYYTHH:MM:SS or yyyy-MM-ddTHH:mm:ss)"),
                "endTime", Map.of("type", "string", "description", "New end time (defaults to +1hr from startTime)"),
                "location", Map.of("type", "string", "description", "New location or meeting link"),
                "timeZone", Map.of("type", "string", "description", "Timezone (default: Asia/Kolkata)")
            ),
            "required", List.of("eventId")
        );
    }

    @Override
    @SuppressWarnings("unchecked")
    public Object execute(String userId, Map<String, Object> args) {
        String eventId = (String) args.get("eventId");
        String title = (String) args.get("title");
        String description = (String) args.get("description");
        String startDateStr = (String) args.get("startTime");
        String endDateStr = (String) args.get("endTime");
        String location = (String) args.get("location");
        String timezone = (String) args.getOrDefault("timeZone", "Asia/Kolkata");

        if (eventId == null || eventId.isBlank()) {
            return Map.of("success", false, "message", "Event ID is required. Use read_calendar_events first to find the event.");
        }

        // Check if at least one field is being updated
        if (title == null && description == null && startDateStr == null && location == null) {
            return Map.of("success", false, "message", "Provide at least one field to update (title, description, startTime, or location).");
        }

        try {
            log.info("Updating calendar event {} for user {}", eventId, userId);
            String accessToken = oAuthService.getAccessToken(userId);

            String getUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events/" + eventId;

            // 1. Verify the event exists
            Map<String, Object> currentEvent;
            try {
                currentEvent = restClient.get()
                        .uri(getUrl)
                        .header("Authorization", "Bearer " + accessToken)
                        .accept(MediaType.APPLICATION_JSON)
                        .retrieve()
                        .body(Map.class);
            } catch (Exception fetchEx) {
                String fetchErr = fetchEx.getMessage() != null ? fetchEx.getMessage() : "";
                if (fetchErr.contains("404") || fetchErr.contains("Not Found")) {
                    return Map.of("success", false, "message", "Event not found. The event may have been deleted. Use read_calendar_events to find the correct event ID.");
                }
                throw fetchEx;
            }

            if (currentEvent == null) {
                return Map.of("success", false, "message", "Event not found.");
            }

            // 2. Prepare patch body with only the fields being updated
            Map<String, Object> patch = new LinkedHashMap<>();
            if (title != null && !title.isBlank()) patch.put("summary", title);
            if (description != null) patch.put("description", description);
            if (location != null) patch.put("location", location);

            if (startDateStr != null && !startDateStr.isBlank()) {
                LocalDateTime startLdt = parseDateTime(startDateStr);
                LocalDateTime endLdt = (endDateStr != null && !endDateStr.isBlank())
                        ? parseDateTime(endDateStr)
                        : startLdt.plusHours(1);

                DateTimeFormatter gFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
                patch.put("start", Map.of("dateTime", startLdt.format(gFormat), "timeZone", timezone));
                patch.put("end", Map.of("dateTime", endLdt.format(gFormat), "timeZone", timezone));
            }

            // 3. Send PATCH request to Google Calendar API
            restClient.patch()
                    .uri(getUrl)
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(patch)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Calendar event {} updated successfully for user {}", eventId, userId);

            String updatedTitle = title != null ? title : String.valueOf(currentEvent.getOrDefault("summary", "Event"));
            return Map.of("success", true, "message", "Event '" + updatedTitle + "' has been successfully updated.");

        } catch (IllegalArgumentException e) {
            // No Google credentials linked
            log.warn("No Google credentials for user {}: {}", userId, e.getMessage());
            return Map.of("success", false,
                "message", "Please log out and log back in with Google to grant access to manage your Calendar.",
                "error_type", "PERMISSION_DENIED");
        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Failed to update calendar event {} for user {}: {}", eventId, userId, errMsg, e);

            if (isPermissionError(errMsg)) {
                return Map.of("success", false,
                    "message", "Please log out and log back in with Google to refresh your permissions and access this feature.",
                    "error_type", "PERMISSION_DENIED");
            }

            return Map.of("success", false, "message", "Failed to update event: " + errMsg);
        }
    }

    private boolean isPermissionError(String errMsg) {
        return errMsg.contains("403") || errMsg.contains("401")
                || errMsg.contains("Forbidden") || errMsg.contains("insufficient")
                || errMsg.contains("Unauthorized") || errMsg.contains("No Google credentials")
                || errMsg.contains("PERMISSION_DENIED") || errMsg.contains("access_denied");
    }

    private LocalDateTime parseDateTime(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            throw new IllegalArgumentException("Date/time is required");
        }

        String clean = dateStr.trim().replace(" ", "T").replace("Z", "");

        // Handle ISO format (yyyy-MM-ddTHH:mm:ss)
        if (clean.contains("T")) {
            String datePart = clean.substring(0, clean.indexOf("T"));
            String timePart = clean.substring(clean.indexOf("T") + 1);

            // Normalize time part
            if (timePart.length() == 5) timePart += ":00";
            if (timePart.length() > 8) timePart = timePart.substring(0, 8);

            LocalDate date = parseDatePart(datePart);
            LocalTime time = LocalTime.parse(timePart);
            return date.atTime(time);
        }

        // Date-only: default to start of day
        return parseDatePart(clean).atStartOfDay();
    }

    private LocalDate parseDatePart(String datePart) {
        if (datePart == null || datePart.isBlank()) {
            throw new IllegalArgumentException("Date is required");
        }
        try {
            if (datePart.contains("-")) {
                String[] parts = datePart.split("-");
                if (parts[0].length() == 4) return LocalDate.parse(datePart); // yyyy-MM-dd
                return LocalDate.parse(datePart, DateTimeFormatter.ofPattern("dd-MM-yyyy")); // dd-MM-yyyy
            }
            return LocalDate.parse(datePart); // ISO default
        } catch (Exception e) {
            log.warn("Could not parse date '{}', falling back to today", datePart);
            return LocalDate.now();
        }
    }
}
