package com.blink.chatservice;

import com.blink.chatservice.chat.repository.ConversationRepository;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.notification.service.EmailService;
import com.blink.chatservice.user.repository.OAuth2CredentialRepository;
import com.blink.chatservice.user.repository.RefreshTokenRepository;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.videochat.repository.CallRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.client.RestTemplate;

@SpringBootTest
@EnableAutoConfiguration(exclude = {
		MongoAutoConfiguration.class,
		MongoDataAutoConfiguration.class,
		MongoRepositoriesAutoConfiguration.class,
		RedisAutoConfiguration.class,
		RedisRepositoriesAutoConfiguration.class
})
@SuppressWarnings("unused")
class ChatServiceApplicationTests {

	@MockitoBean
	private EmailService emailService;

	@MockitoBean
	private SimpMessagingTemplate simpMessagingTemplate;

	@MockitoBean
	private StringRedisTemplate redisTemplate;

	@MockitoBean
	private RedisConnectionFactory redisConnectionFactory;

	@MockitoBean
	private ConversationRepository conversationRepository;

	@MockitoBean
	private MessageRepository messageRepository;

	@MockitoBean
	private UserRepository userRepository;

	@MockitoBean
	private OAuth2CredentialRepository oAuth2CredentialRepository;

	@MockitoBean
	private RefreshTokenRepository refreshTokenRepository;

	@MockitoBean
	private CallRepository callRepository;

	@MockitoBean(name = "aiRestTemplate")
	private RestTemplate aiRestTemplate;

	// Mocking MongoTemplate is required because HealthCheckController dependency
	// relies on it, but Mongo auto-configuration is excluded in this test slice.
	@MockitoBean
	private MongoTemplate mongoTemplate;

	@MockitoBean
	private MongoDatabaseFactory mongoDatabaseFactory;

	@Test
	void contextLoads() {
		org.assertj.core.api.Assertions.assertThat(emailService).isNotNull();
		org.assertj.core.api.Assertions.assertThat(simpMessagingTemplate).isNotNull();
		org.assertj.core.api.Assertions.assertThat(redisTemplate).isNotNull();
		org.assertj.core.api.Assertions.assertThat(redisConnectionFactory).isNotNull();
		org.assertj.core.api.Assertions.assertThat(conversationRepository).isNotNull();
		org.assertj.core.api.Assertions.assertThat(messageRepository).isNotNull();
		org.assertj.core.api.Assertions.assertThat(userRepository).isNotNull();
		org.assertj.core.api.Assertions.assertThat(oAuth2CredentialRepository).isNotNull();
		org.assertj.core.api.Assertions.assertThat(refreshTokenRepository).isNotNull();
		org.assertj.core.api.Assertions.assertThat(callRepository).isNotNull();
		org.assertj.core.api.Assertions.assertThat(aiRestTemplate).isNotNull();
		org.assertj.core.api.Assertions.assertThat(mongoTemplate).isNotNull();
		org.assertj.core.api.Assertions.assertThat(mongoDatabaseFactory).isNotNull();
	}
}