package com.blink.chatservice.videochat.dto;

import java.util.List;

public record CallHistoryResponse(
        List<CallResponse> calls,
        int currentPage,
        int totalPages,
        long totalElements,
        int pageSize,
        boolean hasNext,
        boolean hasPrevious
) {
    public static CallHistoryResponse of(
            List<CallResponse> calls,
            int currentPage,
            int totalPages,
            long totalElements,
            int pageSize,
            boolean hasNext,
            boolean hasPrevious) {
        return new CallHistoryResponse(
                calls,
                currentPage,
                totalPages,
                totalElements,
                pageSize,
                hasNext,
                hasPrevious
        );
    }
}
