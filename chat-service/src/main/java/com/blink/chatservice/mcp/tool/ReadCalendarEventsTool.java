package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.user.service.OAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReadCalendarEventsTool implements McpTool {

    private final OAuthService oAuthService;
    private final ObjectMapper objectMapper;
    private final RestClient aiRestClient;

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DD_MM_YYYY = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final String BIRTHDAY_CALENDAR_ID = "addressbook#contacts@group.v.calendar.google.com";

    @Override
    public String name() {
        return "read_calendar_events";
    }

    @Override
    public String description() {
        return "Read Google Calendar events. Filters: 'today','tomorrow','this_week','this_month','this_year','DD-MM-YYYY'. Use 'query' to search.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "dateFilter", Map.of("type", "string", "description",
                    "Date filter: 'today','tomorrow','this_week','this_month','this_year','DD-MM-YYYY'"),
                "startDate", Map.of("type", "string", "description",
                    "Start date (DD-MM-YYYY) for custom range."),
                "endDate", Map.of("type", "string", "description",
                    "End date (DD-MM-YYYY) for custom range."),
                "query", Map.of("type", "string", "description",
                    "Search text (e.g., 'birthday', 'interview')"),
                "maxResults", Map.of("type", "integer", "description",
                    "Max results (default 25)")
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
        String query = (String) arguments.get("query");
        int maxResults = 25;

        Object maxResultsObj = arguments.get("maxResults");
        if (maxResultsObj != null) {
            try {
                maxResults = Math.min(maxResultsObj instanceof Integer ? (Integer) maxResultsObj :
                        Integer.parseInt(maxResultsObj.toString()), 100);
            } catch (NumberFormatException e) {
                log.warn("Invalid maxResults value: {}", maxResultsObj);
            }
        }

        try {
            String accessToken = oAuthService.getAccessToken(userId);

            // Calculate time bounds
            LocalDate[] dateRange = computeDateRange(dateFilter, startDateStr, endDateStr);
            LocalDate startDate = dateRange[0];
            LocalDate endDate = dateRange[1];

            if (query != null && !query.isBlank() && "today".equalsIgnoreCase(dateFilter)) {
                startDate = LocalDate.now(IST).minusMonths(1);
                endDate = LocalDate.now(IST).plusMonths(2);
            }

            // Convert to RFC3339 for Google Calendar API
            String timeMin = startDate.atStartOfDay(IST).toInstant().toString();
            String timeMax = endDate.plusDays(1).atStartOfDay(IST).toInstant().toString();

            log.info("Reading calendar events for user {} from {} to {} with query '{}'", userId, timeMin, timeMax, query);

            // Determine calendars to search
            List<String> calendarIds = new ArrayList<>();
            calendarIds.add("primary");
            boolean isBirthdayQuery = query != null && query.toLowerCase().contains("birthday");
            if (isBirthdayQuery) {
                calendarIds.add(BIRTHDAY_CALENDAR_ID);
            }

            List<Map<String, Object>> items = new ArrayList<>();
            boolean hadPermissionError = false;

            for (String calendarId : calendarIds) {
                try {
                    List<Map<String, Object>> calItems = fetchCalendarEvents(
                            accessToken, calendarId, timeMin, timeMax, query, maxResults);
                    items.addAll(calItems);
                } catch (Exception calEx) {
                    String errMsg = calEx.getMessage() != null ? calEx.getMessage() : "";
                    log.warn("Could not read calendar '{}' for user {}: {}", calendarId, userId, errMsg);
                    if (errMsg.contains("403") || errMsg.contains("401") || errMsg.contains("Forbidden")
                            || errMsg.contains("insufficient") || errMsg.contains("Unauthorized")) {
                        hadPermissionError = true;
                    }
                }
            }

            // Deep search fallback: fetch broadly and filter client-side
            if (items.isEmpty() && query != null && !query.isBlank() && !hadPermissionError) {
                log.info("Query '{}' yielded 0 results. Retrying with broad search...", query);
                try {
                    List<Map<String, Object>> broadItems = fetchCalendarEvents(
                            accessToken, "primary", timeMin, timeMax, null, 100);

                    String lowerQuery = query.toLowerCase();
                    items = broadItems.stream()
                            .filter(item -> {
                                String summary = String.valueOf(item.getOrDefault("summary", "")).toLowerCase();
                                String desc = String.valueOf(item.getOrDefault("description", "")).toLowerCase();
                                return summary.contains(lowerQuery) || desc.contains(lowerQuery) ||
                                       (!summary.isEmpty() && lowerQuery.contains(summary));
                            })
                            .toList();
                } catch (Exception e) {
                    String errMsg = e.getMessage() != null ? e.getMessage() : "";
                    log.warn("Broad search also failed for user {}: {}", userId, errMsg);
                    if (errMsg.contains("403") || errMsg.contains("401") || errMsg.contains("Forbidden")
                            || errMsg.contains("insufficient") || errMsg.contains("Unauthorized")) {
                        hadPermissionError = true;
                    }
                }
            }

            if (hadPermissionError && items.isEmpty()) {
                return Map.of(
                    "success", false,
                    "count", 0,
                    "events", List.of(),
                    "message", "Calendar access denied. The user needs to re-link their Google account to grant calendar permissions. Ask them to go to Settings and reconnect Google.",
                    "error_type", "PERMISSION_DENIED"
                );
            }

            if (items.isEmpty()) {
                return Map.of(
                    "success", true,
                    "count", 0,
                    "events", List.of(),
                    "message", "No events found for the specified date range.",
                    "date_range", Map.of("from", startDate.format(DD_MM_YYYY), "to", endDate.format(DD_MM_YYYY))
                );
            }

            List<Map<String, Object>> events = new ArrayList<>();
            for (Map<String, Object> item : items) {
                events.add(transformEvent(item));
            }

            return Map.of(
                "success", true,
                "count", events.size(),
                "events", events,
                "date_range", Map.of("from", startDate.format(DD_MM_YYYY), "to", endDate.format(DD_MM_YYYY)),
                "hint", "Summarize, identify conflicts, or use add_to_calendar for modifications."
            );

        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("Failed to read calendar events for user {}: {}", userId, errMsg, e);
            if (errMsg.contains("403") || errMsg.contains("401") || errMsg.contains("Forbidden")
                    || errMsg.contains("insufficient") || errMsg.contains("Unauthorized")
                    || errMsg.contains("No Google credentials")) {
                return Map.of("success", false,
                    "message", "Calendar access not authorized. Please re-link your Google account in Settings to grant calendar permissions.",
                    "error_type", "PERMISSION_DENIED");
            }
            return Map.of("success", false, "message", "Failed to read calendar events: " + errMsg);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchCalendarEvents(String accessToken, String calendarId,
            String timeMin, String timeMax, String query, int maxResults) throws Exception {

        String encodedCalendarId = URLEncoder.encode(calendarId, StandardCharsets.UTF_8);
        StringBuilder urlBuilder = new StringBuilder(
            "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId + "/events?");
        urlBuilder.append("timeMin=").append(URLEncoder.encode(timeMin, StandardCharsets.UTF_8));
        urlBuilder.append("&timeMax=").append(URLEncoder.encode(timeMax, StandardCharsets.UTF_8));
        urlBuilder.append("&maxResults=").append(maxResults);
        urlBuilder.append("&singleEvents=true");
        urlBuilder.append("&orderBy=startTime");

        if (query != null && !query.isBlank()) {
            urlBuilder.append("&q=").append(URLEncoder.encode(query, StandardCharsets.UTF_8));
        }

        String response = aiRestClient.get()
                .uri(URI.create(urlBuilder.toString()))
                .header("Authorization", "Bearer " + accessToken)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(String.class);

        Map<String, Object> result = objectMapper.readValue(response, Map.class);
        return (List<Map<String, Object>>) result.getOrDefault("items", List.of());
    }

    private LocalDate[] computeDateRange(String dateFilter, String startDateStr, String endDateStr) {
        LocalDate today = LocalDate.now(IST);
        LocalDate startDate;
        LocalDate endDate;

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
                case "tomorrow":
                    startDate = today.plusDays(1);
                    endDate = today.plusDays(1);
                    break;
                case "this_week":
                case "this week":
                    startDate = today.with(DayOfWeek.MONDAY);
                    endDate = today.with(DayOfWeek.SUNDAY);
                    break;
                case "this_month":
                case "this month":
                    startDate = today.withDayOfMonth(1);
                    endDate = today.withDayOfMonth(today.lengthOfMonth());
                    break;
                case "this_year":
                case "this year":
                    startDate = today.withDayOfYear(1);
                    endDate = today.withDayOfYear(today.lengthOfYear());
                    break;
                case "next_week":
                case "next week":
                    startDate = today.plusWeeks(1).with(DayOfWeek.MONDAY);
                    endDate = today.plusWeeks(1).with(DayOfWeek.SUNDAY);
                    break;
                default:
                    try {
                        startDate = LocalDate.parse(dateFilter, DD_MM_YYYY);
                        endDate = startDate;
                    } catch (Exception e) {
                        log.warn("Could not parse dateFilter '{}', defaulting to today", dateFilter);
                        startDate = today;
                        endDate = today;
                    }
                    break;
            }
        } else if (startDateStr != null) {
            try {
                startDate = LocalDate.parse(startDateStr, DD_MM_YYYY);
                endDate = (endDateStr != null) ? LocalDate.parse(endDateStr, DD_MM_YYYY) : startDate;
            } catch (Exception e) {
                log.warn("Could not parse date range, defaulting to today");
                startDate = today;
                endDate = today;
            }
        } else {
            startDate = today;
            endDate = today;
        }

        return new LocalDate[]{startDate, endDate};
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformEvent(Map<String, Object> item) {
        Map<String, Object> event = new LinkedHashMap<>();

        event.put("eventId", item.get("id"));
        event.put("title", item.getOrDefault("summary", "(No Title)"));
        event.put("description", item.getOrDefault("description", ""));
        event.put("location", item.getOrDefault("location", ""));
        event.put("status", item.getOrDefault("status", ""));

        Map<String, String> start = (Map<String, String>) item.get("start");
        if (start != null) {
            if (start.containsKey("dateTime")) {
                event.put("startTime", start.get("dateTime"));
                event.put("start_formatted", formatDateTime(start.get("dateTime")));
                event.put("isAllDay", false);
            } else if (start.containsKey("date")) {
                event.put("startTime", start.get("date"));
                event.put("start_formatted", start.get("date"));
                event.put("isAllDay", true);
            }
        }

        Map<String, String> end = (Map<String, String>) item.get("end");
        if (end != null) {
            if (end.containsKey("dateTime")) {
                event.put("endTime", end.get("dateTime"));
                event.put("end_formatted", formatDateTime(end.get("dateTime")));
            } else if (end.containsKey("date")) {
                event.put("endTime", end.get("date"));
                event.put("end_formatted", end.get("date"));
            }
        }

        Map<String, String> organizer = (Map<String, String>) item.get("organizer");
        if (organizer != null) {
            event.put("organizer", organizer.getOrDefault("email", organizer.getOrDefault("displayName", "")));
        }

        List<Map<String, Object>> attendees = (List<Map<String, Object>>) item.get("attendees");
        if (attendees != null && !attendees.isEmpty()) {
            List<Map<String, String>> cleanAttendees = attendees.stream()
                .map(attendee -> {
                    Map<String, String> clean = new LinkedHashMap<>();
                    clean.put("email", String.valueOf(attendee.getOrDefault("email", "")));
                    clean.put("name", String.valueOf(attendee.getOrDefault("displayName", "")));
                    clean.put("status", String.valueOf(attendee.getOrDefault("responseStatus", "needsAction")));
                    return clean;
                }).toList();
            event.put("attendees", cleanAttendees);
        }

        Map<String, Object> conferenceData = (Map<String, Object>) item.get("conferenceData");
        if (conferenceData != null) {
            List<Map<String, Object>> entryPoints = (List<Map<String, Object>>) conferenceData.get("entryPoints");
            if (entryPoints != null) {
                entryPoints.stream()
                    .filter(ep -> "video".equals(ep.get("entryPointType")))
                    .findFirst()
                    .ifPresent(ep -> event.put("meetingLink", ep.get("uri")));
            }
        }

        event.put("htmlLink", item.getOrDefault("htmlLink", ""));

        return event;
    }

    private String formatDateTime(String isoDateTime) {
        try {
            OffsetDateTime odt = OffsetDateTime.parse(isoDateTime);
            return odt.atZoneSameInstant(IST)
                    .format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
        } catch (Exception e) {
            try {
                LocalDateTime ldt = LocalDateTime.parse(isoDateTime.substring(0, Math.min(19, isoDateTime.length())));
                return ldt.format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
            } catch (Exception e2) {
                return isoDateTime;
            }
        }
    }
}
