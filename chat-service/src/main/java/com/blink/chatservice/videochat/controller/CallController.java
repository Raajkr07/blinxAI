package com.blink.chatservice.videochat.controller;

import com.blink.chatservice.videochat.dto.CallHistoryResponse;
import com.blink.chatservice.videochat.dto.CallRequest;
import com.blink.chatservice.videochat.dto.CallResponse;
import com.blink.chatservice.videochat.entity.Call;
import com.blink.chatservice.videochat.service.CallService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/calls")
@RequiredArgsConstructor
public class CallController {

    private final CallService callService;

    @PostMapping("/initiate")
    public ResponseEntity<CallResponse> initiateCall(Authentication auth, @Valid @RequestBody CallRequest request) {
        return ResponseEntity.ok(callService.initiateCall(auth.getName(), request));
    }

    @PostMapping("/{callId}/accept")
    public ResponseEntity<CallResponse> acceptCall(Authentication auth, @PathVariable String callId) {
        return ResponseEntity.ok(callService.acceptCall(callId, auth.getName()));
    }

    @PostMapping("/{callId}/reject")
    public ResponseEntity<CallResponse> rejectCall(Authentication auth, @PathVariable String callId) {
        return ResponseEntity.ok(callService.rejectCall(callId, auth.getName()));
    }

    @PostMapping("/{callId}/end")
    public ResponseEntity<CallResponse> endCall(Authentication auth, @PathVariable String callId) {
        return ResponseEntity.ok(callService.endCall(callId, auth.getName()));
    }

    @GetMapping("/active")
    public ResponseEntity<List<CallResponse>> getActiveCalls(Authentication auth) {
        return ResponseEntity.ok(callService.getActiveCalls(auth.getName()));
    }

    @GetMapping("/{callId}")
    public ResponseEntity<CallResponse> getCall(Authentication auth, @PathVariable String callId) {
        return ResponseEntity.ok(callService.getCallDetails(callId, auth.getName()));
    }

    @GetMapping("/history")
    public ResponseEntity<CallHistoryResponse> getCallHistory(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Call.CallStatus status,
            @RequestParam(required = false) Call.CallType type,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        LocalDateTime start = startDate != null ? LocalDateTime.parse(startDate) : null;
        LocalDateTime end = endDate != null ? LocalDateTime.parse(endDate) : null;

        return ResponseEntity.ok(callService.getCallHistory(auth.getName(), page, size, status, type, start, end));
    }
}
