package com.blink.chatservice.videochat.service;

import com.blink.chatservice.videochat.dto.CallHistoryResponse;
import com.blink.chatservice.videochat.dto.CallRequest;
import com.blink.chatservice.videochat.dto.CallResponse;
import com.blink.chatservice.videochat.entity.Call;

import java.time.LocalDateTime;
import java.util.List;

public interface CallService {
    CallResponse initiateCall(String callerId, CallRequest request);
    CallResponse acceptCall(String callId, String userId);
    CallResponse rejectCall(String callId, String userId);
    CallResponse endCall(String callId, String userId);
    Call getCall(String callId);
    CallResponse getCallDetails(String callId, String userId);
    List<CallResponse> getActiveCalls(String userId);
    void updateCallOffer(String callId, String offer);
    void updateCallAnswer(String callId, String answer);

    CallHistoryResponse getCallHistory(
            String userId,
            int page,
            int size,
            Call.CallStatus status,
            Call.CallType type,
            LocalDateTime startDate,
            LocalDateTime endDate
    );
}
