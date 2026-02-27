package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class DeleteCalendarEventTool implements McpTool {

    private final OAuthService oAuthService;
    private final RestClient restClient;

    public DeleteCalendarEventTool(OAuthService oAuthService,
                                    @org.springframework.beans.factory.annotation.Qualifier("googleApiRestClient") RestClient restClient) {
        this.oAuthService = oAuthService;
        this.restClient = restClient;
    }

    @Override
    public String name() {
        return "delete_calendar_event";
    }

    @Override
    public String description() {
        return "Delete or remove an existing Google Calendar event. Use read_calendar_events first to find the correct event ID.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "eventId", Map.of("type", "string", "description", "Event ID from read_calendar_events")
            ),
            "required", List.of("eventId")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> arguments) {
        String eventId = (String) arguments.get("eventId");

        if (eventId == null || eventId.isBlank()) {
            return Map.of("success", false, "message", "Event ID is required. Use read_calendar_events first to find the event.");
        }

        try {
            log.info("Deleting calendar event {} for user {}", eventId, userId);
            String accessToken = oAuthService.getAccessToken(userId);

            String deleteUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events/" + eventId;

            restClient.delete()
                    .uri(deleteUrl)
                    .header("Authorization", "Bearer " + accessToken)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Calendar event {} deleted successfully for user {}", eventId, userId);

            return Map.of("success", true, "message", "Event has been successfully removed from your calendar.");

        } catch (IllegalArgumentException e) {
            // No Google credentials linked
            log.warn("No Google credentials for user {}: {}", userId, e.getMessage());
            return Map.of("success", false,
                "message", "Please log out and log back in with Google to grant access to manage your Calendar.",
                "error_type", "PERMISSION_DENIED");
        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Failed to delete calendar event {} for user {}: {}", eventId, userId, errMsg, e);

            if (CalendarToolUtils.isPermissionError(errMsg)) {
                return Map.of("success", false,
                    "message", "Please log out and log back in with Google to refresh your permissions and access this feature.",
                    "error_type", "PERMISSION_DENIED");
            }

            if (errMsg.contains("404") || errMsg.contains("Not Found") || errMsg.contains("GONE")) {
                return Map.of("success", true, "message", "Event is already deleted or does not exist.");
            }

            return Map.of("success", false, "message", "Failed to delete event: " + errMsg);
        }
    }
}
