package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Qualifier;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class UpdateCalendarEventTool implements McpTool {

    private final OAuthService oAuthService;
    private final RestClient restClient;

    public UpdateCalendarEventTool(OAuthService oAuthService,
                                    @Qualifier("googleApiRestClient") RestClient restClient) {
        this.oAuthService = oAuthService;
        this.restClient = restClient;
    }

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
                LocalDateTime startLdt = CalendarToolUtils.parseDateTime(startDateStr);
                LocalDateTime endLdt = (endDateStr != null && !endDateStr.isBlank())
                        ? CalendarToolUtils.parseDateTime(endDateStr)
                        : startLdt.plusHours(1);

                patch.put("start", Map.of("dateTime", startLdt.format(CalendarToolUtils.GOOGLE_FORMAT), "timeZone", timezone));
                patch.put("end", Map.of("dateTime", endLdt.format(CalendarToolUtils.GOOGLE_FORMAT), "timeZone", timezone));
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

            if (CalendarToolUtils.isPermissionError(errMsg)) {
                return Map.of("success", false,
                    "message", "Please log out and log back in with Google to refresh your permissions and access this feature.",
                    "error_type", "PERMISSION_DENIED");
            }

            return Map.of("success", false, "message", "Failed to update event: " + errMsg);
        }
    }
}
