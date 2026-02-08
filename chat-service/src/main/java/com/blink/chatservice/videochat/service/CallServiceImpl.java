package com.blink.chatservice.videochat.service;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.videochat.dto.*;
import com.blink.chatservice.videochat.entity.Call;
import com.blink.chatservice.videochat.repository.CallRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CallServiceImpl implements CallService {

    private final CallRepository callRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional
    public CallResponse initiateCall(String callerId, CallRequest request) {
        if (callerId.equals(request.receiverId())) throw new IllegalArgumentException("Cannot call yourself");

        User caller = findUser(callerId);
        User receiver = findUser(request.receiverId());
        if (receiver == null) throw new IllegalArgumentException("Receiver not found");

        var activeCalls = callRepository.findByCallerIdOrReceiverIdAndStatus(receiver.getId(), receiver.getId(), Call.CallStatus.ANSWERED);
        if (!activeCalls.isEmpty()) throw new IllegalStateException("Receiver busy");

        Call call = new Call();
        call.setCallerId(caller.getId());
        call.setReceiverId(receiver.getId());
        call.setType(request.type() == CallRequest.CallType.VIDEO ? Call.CallType.VIDEO : Call.CallType.AUDIO);
        call.setStatus(Call.CallStatus.RINGING);
        call.setStartedAt(LocalDateTime.now(ZoneId.of("UTC")));
        call.setConversationId(request.conversationId());
        call = callRepository.save(call);

        messagingTemplate.convertAndSend("/topic/video/" + receiver.getId() + "/notification",
            new CallNotification(call.getId(), caller.getId(), receiver.getId(), call.getType().name(), 
            call.getConversationId(), caller.getUsername(), caller.getAvatarUrl()));

        return CallResponse.from(call, caller, receiver);
    }

    @Override
    @Transactional
    public CallResponse acceptCall(String callId, String userId) {
        Call call = getCallOrThrow(callId);
        if (!call.getReceiverId().equals(userId)) throw new IllegalArgumentException("Not authorized");

        call.setStatus(Call.CallStatus.ANSWERED);
        call.setAnsweredAt(LocalDateTime.now(ZoneId.of("UTC")));
        return createCallResponse(callRepository.save(call));
    }

    @Override
    @Transactional
    public CallResponse rejectCall(String callId, String userId) {
        Call call = getCallOrThrow(callId);
        if (!call.getReceiverId().equals(userId)) throw new IllegalArgumentException("Not authorized");

        call.setStatus(Call.CallStatus.REJECTED);
        call.setEndedAt(LocalDateTime.now(ZoneId.of("UTC")));
        callRepository.save(call);

        sendSignal(call.getCallerId(), new WebRtcSignal(callId, WebRtcSignal.SignalType.CALL_ENDED, "Rejected", userId));
        return createCallResponse(call);
    }

    @Override
    @Transactional
    public CallResponse endCall(String callId, String userId) {
        Call call = getCallOrThrow(callId);
        if (!call.getCallerId().equals(userId) && !call.getReceiverId().equals(userId)) throw new IllegalArgumentException("Not authorized");

        call.setStatus(call.getStatus() == Call.CallStatus.ANSWERED ? Call.CallStatus.ENDED : Call.CallStatus.MISSED);
        call.setEndedAt(LocalDateTime.now(ZoneId.of("UTC")));
        callRepository.save(call);

        String other = call.getCallerId().equals(userId) ? call.getReceiverId() : call.getCallerId();
        sendSignal(other, new WebRtcSignal(callId, WebRtcSignal.SignalType.CALL_ENDED, "Ended", userId));

        return createCallResponse(call);
    }

    @Override
    public Call getCall(String callId) { return getCallOrThrow(callId); }

    @Override
    public CallResponse getCallDetails(String callId, String userId) {
        Call call = getCallOrThrow(callId);
        if (!call.getCallerId().equals(userId) && !call.getReceiverId().equals(userId)) throw new IllegalArgumentException("Not authorized");
        return createCallResponse(call);
    }

    @Override
    public List<CallResponse> getActiveCalls(String userId) {
        return callRepository.findByCallerIdOrReceiverIdAndStatus(userId, userId, Call.CallStatus.ANSWERED)
            .stream().map(this::createCallResponse).toList();
    }

    @Override
    @Transactional
    public void updateCallOffer(String callId, String offer) {
        Call c = getCallOrThrow(callId);
        c.setCallerOffer(offer);
        callRepository.save(c);
    }

    @Override
    @Transactional
    public void updateCallAnswer(String callId, String answer) {
        Call c = getCallOrThrow(callId);
        c.setReceiverAnswer(answer);
        callRepository.save(c);
    }

    @Override
    public CallHistoryResponse getCallHistory(String userId, int page, int size, Call.CallStatus status, Call.CallType type, LocalDateTime start, LocalDateTime end) {
        var pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        var callPage = (start != null && end != null) 
            ? callRepository.findCallHistoryByUserIdAndDateRange(userId, start, end, pageable)
            : callRepository.findCallHistoryByUserId(userId, pageable);

        var responses = callPage.getContent().stream().map(this::createCallResponse).toList();
        return CallHistoryResponse.of(responses, callPage.getNumber(), callPage.getTotalPages(), callPage.getTotalElements(), callPage.getSize(), callPage.hasNext(), callPage.hasPrevious());
    }

    @Scheduled(fixedRate = 60000)
    public void performCallMaintenance() {
        var threshold = LocalDateTime.now(ZoneId.of("UTC")).minusMinutes(1);
        callRepository.findByStatusAndCreatedAtBefore(Call.CallStatus.RINGING, threshold).forEach(c -> {
            c.setStatus(Call.CallStatus.MISSED);
            c.setEndedAt(LocalDateTime.now(ZoneId.of("UTC")));
            callRepository.save(c);
        });
    }

    private void sendSignal(String userId, WebRtcSignal signal) {
        messagingTemplate.convertAndSend("/topic/video/" + userId + "/signal", signal);
    }

    private Call getCallOrThrow(String id) {
        return callRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Call not found"));
    }

    private User findUser(String id) {
        return userRepository.findById(id).or(() -> userRepository.findByUsername(id)).orElse(null);
    }

    private CallResponse createCallResponse(Call call) {
        return CallResponse.from(call, findUser(call.getCallerId()), findUser(call.getReceiverId()));
    }
}
