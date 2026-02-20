package com.blink.chatservice.chat.service;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.model.ConversationType;
import com.blink.chatservice.chat.repository.ConversationRepository;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplTest {

    @Mock
    private ConversationRepository conversationRepository;
    @Mock
    private MessageRepository messageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserService userService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ChatServiceImpl chatService;

    private String userId = "user-1";
    private String otherUserId = "user-2";
    private Conversation conversation;

    @BeforeEach
    void setUp() {
        conversation = new Conversation();
        conversation.setId("conv-1");
        conversation.setType(ConversationType.DIRECT);
        conversation.setParticipants(new HashSet<>(Set.of(userId, otherUserId)));
    }

    @Test
    void createDirectConversation_withExistingConversation_shouldReturnExisting() {
        when(userService.resolveUserIdFromContact(anyString())).thenReturn(otherUserId);
        when(conversationRepository.findDirectByParticipants(eq(ConversationType.DIRECT), anyList())).thenReturn(Optional.of(conversation));

        Conversation result = chatService.createDirectConversation(userId, "contact");

        assertNotNull(result);
        assertEquals("conv-1", result.getId());
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void sendMessage_shouldSaveMessageAndBroadcast() {
        when(conversationRepository.findById("conv-1")).thenReturn(Optional.of(conversation));
        Message message = new Message();
        message.setId("msg-1");
        message.setCreatedAt(LocalDateTime.now());
        message.setBody("Hello");
        when(messageRepository.save(any(Message.class))).thenReturn(message);

        Message result = chatService.sendMessage("conv-1", userId, "Hello");

        assertNotNull(result);
        assertEquals("Hello", result.getBody());
        verify(messageRepository).save(any(Message.class));
        verify(messagingTemplate, timeout(1000).atLeastOnce()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void getConversation_withValidId_shouldReturnConversation() {
        when(conversationRepository.findById("conv-1")).thenReturn(Optional.of(conversation));

        Conversation result = chatService.getConversation("conv-1");

        assertNotNull(result);
        assertEquals("conv-1", result.getId());
    }

    @Test
    void getConversation_withInvalidId_shouldThrowException() {
        when(conversationRepository.findById("invalid")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> chatService.getConversation("invalid"));
    }
}
