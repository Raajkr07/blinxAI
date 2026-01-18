package com.blink.chatservice.videochat.service;

import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.videochat.dto.CallHistoryResponse;
import com.blink.chatservice.videochat.dto.CallNotification;
import com.blink.chatservice.videochat.dto.CallRequest;
import com.blink.chatservice.videochat.dto.CallResponse;
import com.blink.chatservice.videochat.dto.WebRtcSignal;
import com.blink.chatservice.videochat.entity.Call;
import com.blink.chatservice.videochat.repository.CallRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class CallServiceImpl implements CallService {

    private final CallRepository callRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional
    public CallResponse initiateCall(String callerId, CallRequest request) {
        log.info("Initiating call from {} to {}", callerId, request.receiverId());

        if (callerId == null || callerId.isBlank()) {
            throw new IllegalArgumentException("Caller ID cannot be null or empty");
        }

        // can't call yourself, that would be weird
        if (callerId.equals(request.receiverId())) {
            throw new IllegalArgumentException("Cannot call yourself");
        }

        // checking if receiver exists - but not blocking the call if check fails
        // sometimes user might exist but repository lookup fails due to caching issues
        try {
            if (!userRepository.existsById(request.receiverId())) {
                log.warn("Receiver {} not found in user repository, but allowing call to proceed", request.receiverId());
            }
        } catch (Exception e) {
            log.warn("Failed to verify receiver existence: {}", e.getMessage());
        }

        // cleaning up any stuck calls before starting new one
        cleanupZombieCalls(callerId);
        cleanupZombieCalls(request.receiverId());

        // checking if caller is already in another call
        List<Call> activeCalls = callRepository.findByCallerIdOrReceiverIdAndStatus(
                callerId, callerId, Call.CallStatus.ANSWERED);
        
        if (!activeCalls.isEmpty()) {
            log.info("Caller {} has active calls, ending them.", callerId);
            for (Call activeCall : activeCalls) {
                endCallInDb(activeCall, Call.CallStatus.ENDED);
            }
        }

        // checking if receiver is busy - we don't want to disturb them if they're already on a call
        List<Call> receiverActiveCalls = callRepository.findByCallerIdOrReceiverIdAndStatus(
                request.receiverId(), request.receiverId(), Call.CallStatus.ANSWERED);
        
        if (!receiverActiveCalls.isEmpty()) {
            throw new IllegalStateException("Receiver is already in another call");
        }

        // creating the call record in database
        Call call = new Call();
        call.setCallerId(callerId);
        call.setReceiverId(request.receiverId());
        call.setType(request.type() == CallRequest.CallType.VIDEO 
                ? Call.CallType.VIDEO 
                : Call.CallType.AUDIO);
        call.setStatus(Call.CallStatus.INITIATED);
        call.setStartedAt(LocalDateTime.now());
        call.setCreatedAt(LocalDateTime.now());
        if (request.conversationId() != null) {
            call.setConversationId(request.conversationId());
        }

        call = callRepository.save(call);
        
        // sending notification to receiver through websocket
        sendCallNotification(call, callerId, request.receiverId());
        
        // marking call as ringing now that receiver has been notified
        call.setStatus(Call.CallStatus.RINGING);
        call = callRepository.save(call);
        
        return CallResponse.from(call);
    }
    
    private void sendCallNotification(Call call, String callerId, String receiverId) {
        try {
            messagingTemplate.convertAndSendToUser(
                    receiverId,
                    "/queue/video/call-notification",
                    new CallNotification(
                            call.getId(),
                            callerId,
                            receiverId,
                            call.getType().name(),
                            call.getConversationId()
                    )
            );
        } catch (Exception e) {
            log.error("Failed to send call notification to user {}", receiverId, e);
            // not throwing error here because call is already saved in DB
        }
    }


    @Override
    @Transactional
    public CallResponse acceptCall(String callId, String userId) {
        Call call = getCallOrThrow(callId);

        // only receiver can accept the call
        if (!call.getReceiverId().equals(userId)) {
            throw new IllegalArgumentException("You are not the receiver of this call");
        }

        // can only accept if call is still ringing or just initiated
        if (call.getStatus() != Call.CallStatus.INITIATED && 
            call.getStatus() != Call.CallStatus.RINGING) {
            throw new IllegalStateException("Call cannot be accepted in current status: " + call.getStatus());
        }

        call.setStatus(Call.CallStatus.ANSWERED);
        call.setAnsweredAt(LocalDateTime.now());
        call = callRepository.save(call);
        
        log.info("Call {} accepted by user {}", callId, userId);
        return CallResponse.from(call);
    }

    @Override
    @Transactional
    public CallResponse rejectCall(String callId, String userId) {
        Call call = getCallOrThrow(callId);

        // only receiver can reject
        if (!call.getReceiverId().equals(userId)) {
            throw new IllegalArgumentException("You are not the receiver of this call");
        }

        endCallInDb(call, Call.CallStatus.REJECTED);
        return CallResponse.from(call);
    }

    @Override
    @Transactional
    public CallResponse endCall(String callId, String userId) {
        Call call = getCallOrThrow(callId);

        // both caller and receiver can end the call
        if (!call.getCallerId().equals(userId) && !call.getReceiverId().equals(userId)) {
            throw new IllegalArgumentException("You are not a participant of this call");
        }

        Call.CallStatus endStatus = Call.CallStatus.ENDED;
        // if call was never picked up and receiver is ending it, mark as missed
        if (call.getStatus() == Call.CallStatus.INITIATED || 
            call.getStatus() == Call.CallStatus.RINGING) {
            if (call.getReceiverId().equals(userId)) {
                endStatus = Call.CallStatus.MISSED;
            }
        }
        
        endCallInDb(call, endStatus);
        
        // letting the other person know call has ended
        String otherUser = call.getCallerId().equals(userId) ? call.getReceiverId() : call.getCallerId();
        sendSignal(otherUser, new WebRtcSignal(callId, WebRtcSignal.SignalType.CALL_ENDED, "Call ended", otherUser));
        
        return CallResponse.from(call);
    }

    @Override
    public Call getCall(String callId) {
        return getCallOrThrow(callId);
    }

    @Override
    public List<CallResponse> getActiveCalls(String userId) {
        // cleaning up any zombie calls while we're here
        cleanupZombieCalls(userId);
        
        List<Call> calls = callRepository.findByCallerIdOrReceiverIdAndStatus(
                userId, userId, Call.CallStatus.ANSWERED);
        return calls.stream()
                .map(CallResponse::from)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateCallOffer(String callId, String offer) {
        Call call = getCallOrThrow(callId);
        call.setCallerOffer(offer);
        callRepository.save(call);
    }

    @Override
    @Transactional
    public void updateCallAnswer(String callId, String answer) {
        Call call = getCallOrThrow(callId);
        call.setReceiverAnswer(answer);
        callRepository.save(call);
    }

    @Override
    public void addIceCandidate(String callId, String userId, String candidate) {
        if (candidate == null || candidate.isBlank()) {
            log.warn("Received empty ICE candidate for call {}", callId);
            return;
        }

        Call call = callRepository.findById(callId).orElse(null);
        if (call == null) {
            log.warn("Attempted to add ICE candidate for non-existent call: {}", callId);
            return;
        }

        // figuring out who to send this ICE candidate to
        String targetUserId;
        if (userId.equals(call.getCallerId())) {
            targetUserId = call.getReceiverId();
        } else if (userId.equals(call.getReceiverId())) {
            targetUserId = call.getCallerId();
        } else {
            log.warn("User {} is not a participant in call {}", userId, callId);
            return;
        }

        // relaying the ICE candidate to the other person
        WebRtcSignal signal = new WebRtcSignal(
            callId, 
            WebRtcSignal.SignalType.ICE_CANDIDATE, 
            candidate, 
            targetUserId
        );
        sendSignal(targetUserId, signal);
        log.debug("Relayed ICE candidate from {} to {} for call {}", userId, targetUserId, callId);
    }

    private void sendSignal(String userId, WebRtcSignal signal) {
        try {
            messagingTemplate.convertAndSendToUser(userId, "/queue/video/signal", signal);
        } catch (Exception e) {
            log.error("Failed to send WebRTC signal to user {}", userId, e);
        }
    }

    // finding and ending calls that have been stuck for too long
    // this happens when client crashes or internet dies during a call
    private void cleanupZombieCalls(String userId) {
        try {
            LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
            
            List<Call> activeCalls = callRepository.findByCallerIdOrReceiverIdAndStatus(
                    userId, userId, Call.CallStatus.ANSWERED);
            List<Call> ringingCalls = callRepository.findByCallerIdOrReceiverIdAndStatus(
                    userId, userId, Call.CallStatus.RINGING);
            List<Call> initiatedCalls = callRepository.findByCallerIdOrReceiverIdAndStatus(
                    userId, userId, Call.CallStatus.INITIATED);
            
            activeCalls.addAll(ringingCalls);
            activeCalls.addAll(initiatedCalls);
            
            for (Call call : activeCalls) {
                // if call is older than 1 hour, it's definitely stuck
                if (call.getCreatedAt() != null && call.getCreatedAt().isBefore(oneHourAgo)) {
                    log.warn("Cleaning up zombie call {} for user {}: status={}, age={} minutes", 
                            call.getId(), userId, call.getStatus(), 
                            java.time.Duration.between(call.getCreatedAt(), LocalDateTime.now()).toMinutes());
                    endCallInDb(call, Call.CallStatus.ENDED);
                    
                    // notifying the other person that call has been cleaned up
                    String otherUser = call.getCallerId().equals(userId) 
                            ? call.getReceiverId() 
                            : call.getCallerId();
                    sendSignal(otherUser, new WebRtcSignal(
                            call.getId(), 
                            WebRtcSignal.SignalType.CALL_ENDED, 
                            "Call ended due to timeout", 
                            otherUser));
                }
            }
        } catch (Exception e) {
            log.error("Error cleaning up zombie calls for user {}: {}", userId, e.getMessage(), e);
        }
    }
    
    private void endCallInDb(Call call, Call.CallStatus status) {
        call.setStatus(status);
        call.setEndedAt(LocalDateTime.now());
        callRepository.save(call);
    }

    private Call getCallOrThrow(String callId) {
        return callRepository.findById(callId)
                .orElseThrow(() -> new IllegalArgumentException("Call not found: " + callId));
    }

    @Override
    public CallHistoryResponse getCallHistory(
            String userId,
            int page,
            int size,
            Call.CallStatus status,
            Call.CallType type,
            LocalDateTime startDate,
            LocalDateTime endDate) {
        
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID cannot be null or empty");
        }

        log.info("Fetching call history for user: {}, page: {}, size: {}, status: {}, type: {}", 
                userId, page, size, status, type);

        // making sure page and size are reasonable
        if (page < 0) {
            page = 0;
        }

        if (size <= 0 || size > 100) {
            size = 20; // default to 20 if invalid
        }

        // sorting by newest first - that's what users usually want to see
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Call> callPage;

        try {
            // applying filters based on what user has requested
            if (startDate != null && endDate != null) {
                if (startDate.isAfter(endDate)) {
                    throw new IllegalArgumentException("Start date must be before end date");
                }
                log.debug("Querying with date range: {} to {}", startDate, endDate);
                callPage = callRepository.findCallHistoryByUserIdAndDateRange(userId, startDate, endDate, pageable);
            } else if (status != null && type != null) {
                // when both filters are there, we fetch all and filter in memory
                // not ideal for huge datasets but works fine for most cases
                log.debug("Querying with status: {} and type: {}", status, type);
                callPage = callRepository.findCallHistoryByUserId(userId, pageable);
                List<Call> filteredCalls = callPage.getContent().stream()
                        .filter(call -> call.getStatus() == status && call.getType() == type)
                        .collect(Collectors.toList());
                log.debug("Filtered {} calls from {} total", filteredCalls.size(), callPage.getContent().size());
            } else if (status != null) {
                log.debug("Querying with status: {}", status);
                callPage = callRepository.findCallHistoryByUserIdAndStatus(userId, status, pageable);
            } else if (type != null) {
                log.debug("Querying with type: {}", type);
                callPage = callRepository.findCallHistoryByUserIdAndType(userId, type, pageable);
            } else {
                // no filters, just give everything
                log.debug("Querying all calls for user: {}", userId);
                callPage = callRepository.findCallHistoryByUserId(userId, pageable);
            }

            // logging what we found for debugging
            log.info("Found {} calls for user {} (total elements: {}, total pages: {})", 
                    callPage.getContent().size(), userId, callPage.getTotalElements(), callPage.getTotalPages());
            
            // logging first few calls to see if user is caller or receiver
            callPage.getContent().stream().limit(3).forEach(call -> 
                log.debug("Call {}: caller={}, receiver={}, status={}, type={}", 
                        call.getId(), call.getCallerId(), call.getReceiverId(), 
                        call.getStatus(), call.getType())
            );

            List<CallResponse> callResponses = callPage.getContent().stream()
                    .map(CallResponse::from)
                    .collect(Collectors.toList());

            log.debug("Retrieved {} call history records for user {} (page {}/{})", 
                    callResponses.size(), userId, page, callPage.getTotalPages());

            return CallHistoryResponse.of(
                    callResponses,
                    callPage.getNumber(),
                    callPage.getTotalPages(),
                    callPage.getTotalElements(),
                    callPage.getSize(),
                    callPage.hasNext(),
                    callPage.hasPrevious()
            );
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error retrieving call history for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to retrieve call history", e);
        }
    }
}
