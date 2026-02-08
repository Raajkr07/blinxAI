package com.blink.chatservice.websocket.controller;

import com.blink.chatservice.videochat.dto.CallNotification;
import com.blink.chatservice.videochat.dto.WebRtcSignal;
import com.blink.chatservice.videochat.entity.Call;
import com.blink.chatservice.videochat.service.CallService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class VideoCallWsController {

    private final SimpMessagingTemplate messagingTemplate;
    private final CallService callService;

    @MessageMapping("/video/signal")
    public void handleSignal(@Payload WebRtcSignal signal, Principal principal) {
        if (principal == null || signal == null || signal.callId() == null) return;

        String senderId = principal.getName();
        Call call = callService.getCall(signal.callId());
        
        if (!isParticipant(call, senderId)) return;

        String targetId = call.getCallerId().equals(senderId) ? call.getReceiverId() : call.getCallerId();
        messagingTemplate.convertAndSend("/topic/video/" + targetId + "/signal", signal);

        processSignal(signal, call);
    }

    @MessageMapping("/video/call-notification")
    public void handleCallNotification(@Payload CallNotification notification, Principal principal) {
        if (principal == null || notification == null || notification.receiverId() == null) return;
        if (!principal.getName().equals(notification.callerId())) return;

        messagingTemplate.convertAndSend("/topic/video/" + notification.receiverId() + "/notification", notification);
    }

    private void processSignal(WebRtcSignal signal, Call call) {
        if (signal.type() == WebRtcSignal.SignalType.OFFER) {
            callService.updateCallOffer(call.getId(), signal.data());
        } else if (signal.type() == WebRtcSignal.SignalType.ANSWER) {
            callService.updateCallAnswer(call.getId(), signal.data());
        }
    }

    private boolean isParticipant(Call call, String userId) {
        return call.getCallerId().equals(userId) || call.getReceiverId().equals(userId);
    }
}
