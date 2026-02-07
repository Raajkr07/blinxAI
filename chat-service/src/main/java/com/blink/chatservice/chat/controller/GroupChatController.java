package com.blink.chatservice.chat.controller;

import com.blink.chatservice.chat.dto.ErrorResponse;
import com.blink.chatservice.chat.dto.UpdateGroupRequest;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.blink.chatservice.chat.dto.GroupChatRequest;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat/groups")
@RequiredArgsConstructor
@Tag(name = "Group Chat", description = "Endpoints for listing and joining group chats")
@lombok.extern.slf4j.Slf4j
public class GroupChatController {

    private final ChatService chatService;

    @GetMapping
    @Operation(
            summary = "List all group conversations",
            description = "Can be filtered by membership or visibility in the service layer."
    )
    public ResponseEntity<List<Conversation>> listGroups(Authentication auth) {
        try {
            String userId = auth.getName();
            List<Conversation> groups = chatService.listGroupsVisibleToUser(userId);
            return ResponseEntity.ok(groups);
        } catch (Exception e) {
            log.error("Error listing groups", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/{groupId}/join")
    @Operation(
            summary = "Join a group conversation",
            description = "Adds the current user as a participant of the specified group."
    )
    public ResponseEntity<Conversation> joinGroup(
            Authentication auth,
            @PathVariable String groupId
    ) {
        try {
            String userId = auth.getName();
            Conversation conv = chatService.addUserToGroup(groupId, userId);
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error joining group", e);
            return ResponseEntity.status(500).build();
        }
    }
    @GetMapping("/{groupId}")
    @Operation(summary = "Get group details")
    public ResponseEntity<Conversation> getGroup(@PathVariable String groupId) {
        try {
            Conversation conv = chatService.getConversation(groupId);
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error getting group", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PutMapping("/{groupId}")
    @Operation(summary = "Update group details")
    public ResponseEntity<Conversation> updateGroup(
            Authentication auth,
            @PathVariable String groupId,
            @RequestBody UpdateGroupRequest request
    ) {
        try {
            String userId = auth.getName();
            Conversation conv = chatService.updateGroup(groupId, userId, request.title(), request.avatarUrl());
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error updating group", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/{groupId}/participants")
    @Operation(summary = "Add participants to group")
    public ResponseEntity<Conversation> addParticipants(
            Authentication auth,
            @PathVariable String groupId,
            @RequestBody GroupChatRequest request
    ) {
        try {
            if (request.participantIds() == null || request.participantIds().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            Conversation conv = null;
            for (String pid : request.participantIds()) {
                conv = chatService.addUserToGroup(groupId, pid);
            }
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error adding participants", e);
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/{groupId}/participants/{userId}")
    @Operation(summary = "Remove participant from group")
    public ResponseEntity<Conversation> removeParticipant(
            Authentication auth,
            @PathVariable String groupId,
            @PathVariable String userId
    ) {
        try {
            String requesterId = auth.getName();
            Conversation conv = chatService.removeUserFromGroup(groupId, userId, requesterId);
            return ResponseEntity.ok(conv);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error removing participant", e);
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/{groupId}/leave")
    @Operation(summary = "Leave a group conversation")
    public ResponseEntity<ErrorResponse> leaveGroup(
            Authentication auth,
            @PathVariable String groupId
    ) {
        try {
            String userId = auth.getName();
            chatService.leaveGroup(groupId, userId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("Error leaving group: {}", e.getMessage(), e);
            return ResponseEntity.status(500).build();
        }
    }

}
;
