package com.blink.chatservice.videochat.controller;

import com.blink.chatservice.videochat.dto.CallHistoryResponse;
import com.blink.chatservice.videochat.dto.CallRequest;
import com.blink.chatservice.videochat.dto.CallResponse;
import com.blink.chatservice.videochat.entity.Call;
import com.blink.chatservice.videochat.service.CallService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/calls")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Video Calls", description = "Video and audio call management")
public class CallController {

    private final CallService callService;

    @Operation(summary = "Initiate a call", description = "Start a new video or audio call")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Call initiated successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request"),
            @ApiResponse(responseCode = "409", description = "User is already in a call")
    })
    // starting a new call - either video or audio
    @PostMapping("/initiate")
    public ResponseEntity<CallResponse> initiateCall(
            Authentication auth,
            @Valid @RequestBody CallRequest request) {
        
        if (auth == null || auth.getName() == null) {
            log.error("Unauthenticated call initiation attempt");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String callerId = auth.getName();
        log.info("User {} initiating call to {}", callerId, request.receiverId());
        
        try {
            CallResponse response = callService.initiateCall(callerId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            // receiver is already busy in another call
            log.warn("Call initiation failed - user busy: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        } catch (IllegalArgumentException e) {
            log.warn("Call initiation failed - invalid request: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    @Operation(summary = "Accept a call", description = "Accept an incoming call")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Call accepted successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid call state"),
            @ApiResponse(responseCode = "403", description = "Not authorized to accept this call"),
            @ApiResponse(responseCode = "404", description = "Call not found")
    })
    // accepting an incoming call - only receiver can do this
    @PostMapping("/{callId}/accept")
    public ResponseEntity<CallResponse> acceptCall(
            Authentication auth,
            @PathVariable String callId) {
        
        if (callId == null || callId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String userId = auth.getName();
        log.info("User {} accepting call {}", userId, callId);
        
        try {
            CallResponse response = callService.acceptCall(callId, userId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // user is not the receiver of this call
            log.warn("Call accept failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalStateException e) {
            // call is in wrong state - maybe already ended or rejected
            log.warn("Call accept failed - invalid state: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    @Operation(summary = "Reject a call", description = "Reject an incoming call")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Call rejected successfully"),
            @ApiResponse(responseCode = "403", description = "Not authorized to reject this call"),
            @ApiResponse(responseCode = "404", description = "Call not found")
    })
    // rejecting an incoming call - when you don't want to pick up
    @PostMapping("/{callId}/reject")
    public ResponseEntity<CallResponse> rejectCall(
            Authentication auth,
            @PathVariable String callId) {
        
        if (callId == null || callId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String userId = auth.getName();
        log.info("User {} rejecting call {}", userId, callId);
        
        try {
            CallResponse response = callService.rejectCall(callId, userId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Call reject failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @Operation(summary = "End a call", description = "End an active call")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Call ended successfully"),
            @ApiResponse(responseCode = "403", description = "Not authorized to end this call"),
            @ApiResponse(responseCode = "404", description = "Call not found")
    })
    // ending an active call - either participant can do this
    @PostMapping("/{callId}/end")
    public ResponseEntity<CallResponse> endCall(
            Authentication auth,
            @PathVariable String callId) {
        
        if (callId == null || callId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String userId = auth.getName();
        log.info("User {} ending call {}", userId, callId);
        
        try {
            CallResponse response = callService.endCall(callId, userId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Call end failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    // getting all ongoing calls for this user
    @Operation(summary = "Get active calls", description = "Get all active calls for current user")
    @GetMapping("/active")
    public ResponseEntity<List<CallResponse>> getActiveCalls(Authentication auth) {
        String userId = auth.getName();
        log.debug("Fetching active calls for user {}", userId);
        
        List<CallResponse> calls = callService.getActiveCalls(userId);
        return ResponseEntity.ok(calls);
    }

    @Operation(summary = "Get call details", description = "Get details of a specific call")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Call details retrieved"),
            @ApiResponse(responseCode = "403", description = "Not authorized to view this call"),
            @ApiResponse(responseCode = "404", description = "Call not found")
    })
    // fetching details of a specific call - only participants can see this
    @GetMapping("/{callId}")
    public ResponseEntity<CallResponse> getCall(
            Authentication auth,
            @PathVariable String callId) {
        
        if (callId == null || callId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String userId = auth.getName();
        
        try {
            Call call = callService.getCall(callId);
            
            // making sure this user is actually part of the call before showing details
            if (!call.getCallerId().equals(userId) && !call.getReceiverId().equals(userId)) {
                log.warn("User {} attempted to access call {} without authorization", userId, callId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            return ResponseEntity.ok(CallResponse.from(call));
        } catch (IllegalArgumentException e) {
            log.warn("Call not found: {}", callId);
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
            summary = "Get call history", 
            description = "Get paginated call history for the current user with optional filters for status, type, and date range"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Call history retrieved successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request parameters")
    })
    // getting call history with pagination and filters - useful for showing call logs
    @GetMapping("/history")
    public ResponseEntity<CallHistoryResponse> getCallHistory(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Call.CallStatus status,
            @RequestParam(required = false) Call.CallType type,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        
        String userId = auth.getName();
        log.info("Fetching call history for user {}: page={}, size={}, status={}, type={}", 
                userId, page, size, status, type);

        try {
            java.time.LocalDateTime startDateTime = null;
            java.time.LocalDateTime endDateTime = null;

            // parsing date strings if provided - expecting ISO format
            if (startDate != null && !startDate.isBlank()) {
                try {
                    startDateTime = java.time.LocalDateTime.parse(startDate);
                } catch (Exception e) {
                    log.warn("Invalid start date format: {}", startDate);
                    return ResponseEntity.badRequest().build();
                }
            }

            if (endDate != null && !endDate.isBlank()) {
                try {
                    endDateTime = java.time.LocalDateTime.parse(endDate);
                } catch (Exception e) {
                    log.warn("Invalid end date format: {}", endDate);
                    return ResponseEntity.badRequest().build();
                }
            }

            CallHistoryResponse response = callService.getCallHistory(
                    userId, page, size, status, type, startDateTime, endDateTime);
            
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid call history request: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error retrieving call history for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // temporary debug endpoint to test call queries
    @Operation(summary = "Debug: Test call queries", description = "Debug endpoint to test if queries are working")
    @GetMapping("/debug/test-queries/{userId}")
    public ResponseEntity<String> debugTestQueries(
            Authentication auth,
            @PathVariable String userId) {
        
        log.info("Debug: Testing call queries for user {}", userId);
        
        try {
            // test the repository query directly
            List<Call> allCalls = callService.getActiveCalls(userId).stream()
                    .map(cr -> callService.getCall(cr.id()))
                    .collect(java.util.stream.Collectors.toList());
            
            StringBuilder result = new StringBuilder();
            result.append("Testing queries for user: ").append(userId).append("\n\n");
            
            // get call history
            CallHistoryResponse history = callService.getCallHistory(userId, 0, 10, null, null, null, null);
            result.append("Call History Results:\n");
            result.append("Total calls: ").append(history.totalElements()).append("\n");
            result.append("Calls on this page: ").append(history.calls().size()).append("\n\n");
            
            history.calls().forEach(call -> {
                result.append(String.format("Call %s: caller=%s, receiver=%s, status=%s, type=%s\n",
                        call.id(), call.callerId(), call.receiverId(), call.status(), call.type()));
            });
            
            return ResponseEntity.ok(result.toString());
        } catch (Exception e) {
            log.error("Debug query failed", e);
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }
}
