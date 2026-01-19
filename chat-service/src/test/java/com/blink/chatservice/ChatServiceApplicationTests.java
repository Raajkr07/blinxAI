package com.blink.chatservice;

import com.blink.chatservice.chat.repository.ConversationRepository;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.user.repository.RefreshTokenRepository;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.videochat.repository.CallRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.messaging.simp.SimpMessagingTemplate;

// Mock Test for this project
@SpringBootTest
@EnableAutoConfiguration(exclude = {
		MongoAutoConfiguration.class,
		MongoDataAutoConfiguration.class,
		MongoRepositoriesAutoConfiguration.class,
		RedisAutoConfiguration.class,
		RedisRepositoriesAutoConfiguration.class,
		MailSenderAutoConfiguration.class
})
class ChatServiceApplicationTests {

	@MockBean
	private JavaMailSender javaMailSender;

	@MockBean
	private SimpMessagingTemplate simpMessagingTemplate;

	@MockBean
	private RedisTemplate<String, String> redisTemplate;

	@MockBean
	private RedisConnectionFactory redisConnectionFactory;

	@MockBean
	private ConversationRepository conversationRepository;

	@MockBean
	private MessageRepository messageRepository;

	@MockBean
	private UserRepository userRepository;

	@MockBean
	private RefreshTokenRepository refreshTokenRepository;

	@MockBean
	private CallRepository callRepository;

	@Test
	void contextLoads() {
	}
}