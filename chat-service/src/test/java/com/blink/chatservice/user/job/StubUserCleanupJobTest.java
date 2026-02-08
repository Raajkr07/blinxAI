package com.blink.chatservice.user.job;

import com.blink.chatservice.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StubUserCleanupJobTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private StubUserCleanupJob stubUserCleanupJob;

    @Test
    void cleanupStubUsers_shouldCallRepositoryDelete() {
        // Arrange
        when(userRepository.deleteIncompleteUsers(any(LocalDateTime.class))).thenReturn(5L);

        // Act
        stubUserCleanupJob.cleanupStubUsers();

        // Assert
        verify(userRepository).deleteIncompleteUsers(any(LocalDateTime.class));
    }
}
