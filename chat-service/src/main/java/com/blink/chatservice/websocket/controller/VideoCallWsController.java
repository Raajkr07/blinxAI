package com.blink.chatservice.websocket.controller;

import com.blink.chatservice.videochat.dto.CallNotification;
import com.blink.chatservice.videochat.dto.WebRtcSignal;
import com.blink.chatservice.videochat.entity.Call;
import com.blink.chatservice.videochat.service.CallService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

// this controller handles all the websocket stuff for video calls - basically the real-time signaling part
@Controller
@RequiredArgsConstructor
@Slf4j
public class VideoCallWsController {

    private final SimpMessagingTemplate messagingTemplate;
    private final CallService callService;

    // handling WebRTC signals like offer, answer, ICE candidates etc
    // this is where the actual peer-to-peer connection setup happens
    @MessageMapping("/video/signal")
    public void handleSignal(@Payload WebRtcSignal signal, Principal principal) {
        if (principal == null) {
            log.warn("Received WebRTC signal without authentication");
            return;
        }

        if (signal == null || signal.callId() == null || signal.type() == null) {
            log.warn("Received invalid WebRTC signal from {}", principal.getName());
            return;
        }

        String senderId = principal.getName();
        log.debug("Received WebRTC signal from {}: type={}, callId={}", 
                senderId, signal.type(), signal.callId());

        try {
            Call call = callService.getCall(signal.callId());
            
            // making sure this person is actually part of the call
            if (!isParticipant(call, senderId)) {
                log.warn("User {} is not a participant of call {}", senderId, signal.callId());
                sendErrorToUser(senderId, "You are not a participant of this call");
                return;
            }

            // can't send signals if call is already ended, except for the CALL_ENDED signal itself
            if (!call.isActive() && signal.type() != WebRtcSignal.SignalType.CALL_ENDED) {
                log.warn("Received signal for inactive call {}: status={}", signal.callId(), call.getStatus());
                sendErrorToUser(senderId, "Call is not active");
                return;
            }

            String targetUserId = getOtherParticipant(call, senderId);

            processSignal(signal, call);

            forwardSignalToUser(targetUserId, signal);

            log.debug("Forwarded WebRTC signal to user {}: type={}, callId={}", 
                    targetUserId, signal.type(), signal.callId());

        } catch (IllegalArgumentException e) {
            log.error("Call not found: {}", signal.callId());
            sendErrorToUser(senderId, "Call not found");
        } catch (Exception e) {
            log.error("Error handling WebRTC signal from {}: {}", senderId, e.getMessage(), e);
            sendErrorToUser(senderId, "Failed to process signal");
        }
    }

    // when someone initiates a call, we send notification to the receiver through this
    @MessageMapping("/video/call-notification")
    public void handleCallNotification(@Payload CallNotification notification, Principal principal) {
        if (principal == null) {
            log.warn("Received call notification without authentication");
            return;
        }

        if (notification == null || notification.receiverId() == null) {
            log.warn("Received invalid call notification from {}", principal.getName());
            return;
        }

        String senderId = principal.getName();
        
        // security check - making sure the caller ID in notification matches who's actually sending it
        if (!senderId.equals(notification.callerId())) {
            log.warn("Call notification sender mismatch: principal={}, callerId={}", 
                    senderId, notification.callerId());
            return;
        }

        log.debug("Call notification from {} to {}", senderId, notification.receiverId());

        try {
            messagingTemplate.convertAndSendToUser(
                    notification.receiverId(),
                    "/queue/video/call-notification",
                    notification
            );
            log.info("Call notification sent to {}: callId={}", 
                    notification.receiverId(), notification.callId());
        } catch (Exception e) {
            log.error("Failed to send call notification to {}: {}", 
                    notification.receiverId(), e.getMessage(), e);
        }
    }

    // processing different types of WebRTC signals and saving them in DB
    private void processSignal(WebRtcSignal signal, Call call) {
        switch (signal.type()) {
            case OFFER:
                callService.updateCallOffer(signal.callId(), signal.data());
                break;
            case ANSWER:
                callService.updateCallAnswer(signal.callId(), signal.data());
                break;
            case ICE_CANDIDATE:
                // only adding ICE candidate if there's actual data, no point saving empty strings
                if (signal.data() != null && !signal.data().isBlank()) {
                    callService.addIceCandidate(signal.callId(), 
                            getOtherParticipant(call, signal.targetUserId()), signal.data());
                }
                break;
            case CALL_ENDED:
                // we're just forwarding this signal, actual call ending happens through REST API
                break;
            default:
                log.warn("Unknown signal type: {}", signal.type());
        }
    }

    // checking if this user is actually part of this call or not
    private boolean isParticipant(Call call, String userId) {
        return call.getCallerId().equals(userId) || call.getReceiverId().equals(userId);
    }

    // getting the other person in the call - if you're the caller, returns receiver and vice versa
    private String getOtherParticipant(Call call, String userId) {
        return call.getCallerId().equals(userId) 
                ? call.getReceiverId() 
                : call.getCallerId();
    }

    // sending the WebRTC signal to the other user through websocket
    private void forwardSignalToUser(String userId, WebRtcSignal signal) {
        try {
            messagingTemplate.convertAndSendToUser(
                    userId,
                    "/queue/video/signal",
                    signal
            );
        } catch (Exception e) {
            log.error("Failed to forward signal to user {}: {}", userId, e.getMessage(), e);
        }
    }

    // sending error message back to user when something goes wrong
    private void sendErrorToUser(String userId, String errorMessage) {
        try {
            messagingTemplate.convertAndSendToUser(
                    userId,
                    "/queue/video/error",
                    new ErrorMessage(errorMessage)
            );
        } catch (Exception e) {
            log.error("Failed to send error to user {}: {}", userId, e.getMessage(), e);
        }
    }

    private record ErrorMessage(String error) {}
}
