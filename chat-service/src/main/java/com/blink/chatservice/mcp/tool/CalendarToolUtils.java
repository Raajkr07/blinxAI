package com.blink.chatservice.mcp.tool;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// Shared utilities for Google Calendar MCP tools.
// Eliminates duplicated date-parsing and permission-checking logic.
public final class CalendarToolUtils {

    private static final Logger log = LoggerFactory.getLogger(CalendarToolUtils.class);

    public static final DateTimeFormatter GOOGLE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private CalendarToolUtils() {}

    // Check if an error message indicates a permission/authentication problem.
    public static boolean isPermissionError(String errMsg) {
        if (errMsg == null) return false;
        return errMsg.contains("403") || errMsg.contains("401")
                || errMsg.contains("Forbidden") || errMsg.contains("insufficient")
                || errMsg.contains("Unauthorized") || errMsg.contains("No Google credentials")
                || errMsg.contains("PERMISSION_DENIED") || errMsg.contains("access_denied");
    }

    // Parse a date-time string in either "dd-MM-yyyyTHH:mm:ss" or "yyyy-MM-ddTHH:mm:ss" format.
    // Falls back to date-only (start of day) if no time component is present.
    public static LocalDateTime parseDateTime(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            throw new IllegalArgumentException("Date/time is required");
        }

        String clean = dateStr.trim().replace(" ", "T").replace("Z", "");

        if (clean.contains("T")) {
            String datePart = clean.substring(0, clean.indexOf("T"));
            String timePart = clean.substring(clean.indexOf("T") + 1);

            // Normalize time: ensure HH:mm:ss
            if (timePart.length() == 5) timePart += ":00";
            if (timePart.length() > 8) timePart = timePart.substring(0, 8);

            return parseDatePart(datePart).atTime(LocalTime.parse(timePart));
        }

        return parseDatePart(clean).atStartOfDay();
    }

    // Parse a date string that may be in "yyyy-MM-dd" or "dd-MM-yyyy" format.
    public static LocalDate parseDatePart(String datePart) {
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
