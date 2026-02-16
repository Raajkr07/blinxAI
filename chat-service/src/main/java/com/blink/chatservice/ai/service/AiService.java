package com.blink.chatservice.ai.service;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.executor.McpToolExecutor;
import com.blink.chatservice.mcp.registry.McpToolRegistry;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AiService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final RestTemplate restTemplate;
    private final McpToolRegistry toolRegistry;
    private final McpToolExecutor toolExecutor;
    private final ObjectMapper objectMapper;
    private final ExecutorService toolExecutorService;

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:gpt-4o}")
    private String model;

    @Value("${ai.base-url:https://api.openai.com}")
    private String baseUrl;

    public AiService(ChatService chatService,
                     UserRepository userRepository,
                     MessageRepository messageRepository,
                     @Qualifier("aiRestTemplate") RestTemplate restTemplate,
                     McpToolRegistry toolRegistry,
                     McpToolExecutor toolExecutor,
                     ObjectMapper objectMapper) {
        this.chatService = chatService;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.restTemplate = restTemplate;
        this.toolRegistry = toolRegistry;
        this.toolExecutor = toolExecutor;
        this.objectMapper = objectMapper;
        this.toolExecutorService = Executors.newFixedThreadPool(10, r -> {
            Thread t = new Thread(r, "ai-tool-exec");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    public void shutdown() {
        toolExecutorService.shutdown();
        try {
            if (!toolExecutorService.awaitTermination(5, TimeUnit.SECONDS)) {
                toolExecutorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            toolExecutorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    public Message processAiMessage(String userId, String conversationId, String userMessage, boolean shouldSave) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (shouldSave) {
            saveMessage(userId, conversationId, userMessage);
        }

        List<Map<String, Object>> context = buildContext(conversationId, user);
        String response;
        try {
            response = executeReasoning(userId, context);
        } catch (Exception e) {
            log.error("AI reasoning failed for user {}: {}", userId, e.getMessage(), e);
            response = AiConstants.ERROR_AI_API_FAILED;
        }

        return saveMessage(AiConstants.AI_USER_ID, conversationId, response);
    }

    private String executeReasoning(String userId, List<Map<String, Object>> messages) {
        int iterations = 0;
        while (iterations++ < AiConstants.MAX_TOOL_ITERATIONS) {
            OpenAiResponse response = callApi(messages);
            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                log.warn("Empty API response at iteration {}", iterations);
                return AiConstants.ERROR_AI_API_FAILED;
            }

            OpenAiMessage lastMsg = response.choices().get(0).message();
            if (lastMsg == null) {
                return AiConstants.ERROR_AI_API_FAILED;
            }

            if (lastMsg.tool_calls() != null && !lastMsg.tool_calls().isEmpty()) {
                // Build new list preserving order
                List<Map<String, Object>> updatedMessages = new ArrayList<>(messages);
                updatedMessages.add(Map.of(
                    "role", "assistant",
                    "content", lastMsg.content() != null ? lastMsg.content() : "",
                    "tool_calls", lastMsg.tool_calls()
                ));

                // Execute tools in parallel, collect results in order
                List<CompletableFuture<Map<String, Object>>> futures = lastMsg.tool_calls().stream()
                    .map(call -> CompletableFuture.supplyAsync(() -> {
                        try {
                            var execution = toolExecutor.execute(userId, call.function().name(), call.function().arguments());
                            return Map.<String, Object>of(
                                "role", "tool",
                                "tool_call_id", call.id(),
                                "name", call.function().name(),
                                "content", execution.toJson(objectMapper)
                            );
                        } catch (Exception e) {
                            log.error("Tool {} execution threw: {}", call.function().name(), e.getMessage());
                            return Map.<String, Object>of(
                                "role", "tool",
                                "tool_call_id", call.id(),
                                "name", call.function().name(),
                                "content", "{\"error\":\"Tool execution failed\"}"
                            );
                        }
                    }, toolExecutorService))
                    .toList();

                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

                for (var future : futures) {
                    try {
                        updatedMessages.add(future.get());
                    } catch (Exception e) {
                        log.error("Failed to retrieve tool result: {}", e.getMessage());
                    }
                }
                messages = updatedMessages;
                continue;
            }

            if (lastMsg.content() != null && !lastMsg.content().isBlank()) {
                return lastMsg.content();
            }
        }
        return AiConstants.ERROR_MAX_ITERATIONS;
    }

    private OpenAiResponse callApi(List<Map<String, Object>> messages) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", AiConstants.DEFAULT_MAX_TOKENS);
        body.put("temperature", AiConstants.DEFAULT_TEMPERATURE);

        List<Map<String, Object>> tools = toolRegistry.all().stream()
            .map(t -> Map.<String, Object>of("type", "function", "function", Map.of(
                "name", t.name(), "description", t.description(), "parameters", t.inputSchema()
            ))).toList();

        if (!tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            return restTemplate.postForObject(
                    baseUrl + "/v1/chat/completions",
                    new HttpEntity<>(body, headers),
                    OpenAiResponse.class);
        } catch (Exception e) {
            log.error("AI API call failed: {}", e.getMessage());
            return null;
        }
    }

    private List<Map<String, Object>> buildContext(String conversationId, User user) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", buildPrompt(user)));

        messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
            conversationId, org.springframework.data.domain.PageRequest.of(0, AiConstants.MAX_HISTORY_MESSAGES)
        ).getContent().stream()
            .sorted(Comparator.comparing(Message::getId))
            .forEach(m -> messages.add(Map.of(
                "role", m.getSenderId().equals(AiConstants.AI_USER_ID) ? "assistant" : "user",
                "content", m.getBody()
            )));

        return messages;
    }

    private String buildPrompt(User user) {
        String timestamp = LocalDateTime.now(IST).format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
        return """
            You are %s, AI assistant in BlinX Chat.
            User: %s | Now: %s IST

            Rules:
            - Concise, proactive, professional. No fluff.
            - Call tools directly without asking permission.
            - Infer missing details (default event duration: 1hr). Ask only if essential.
            - For "What can you do?": list Email, Calendar, Messaging, Intelligence capabilities briefly.
            - Calendar adds: infer details, confirm with user.
            - Email sends: call the send_email tool first. The UI will automatically pop up a preview modal for the user to edit/confirm. Do NOT repeat the email content in your chat response.
            """.formatted(AiConstants.AI_USER_NAME, user.getUsername(), timestamp);
    }

    private Message saveMessage(String senderId, String conversationId, String content) {
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(senderId);
        msg.setBody(content);
        msg.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        msg.setSeen(false);
        msg.setDeleted(false);
        return messageRepository.save(msg);
    }

    public Conversation getOrCreateAiConversation(String userId) {
        return chatService.listConversationsForUser(userId).stream()
            .filter(c -> "AI_ASSISTANT".equals(c.getType().name()))
            .findFirst()
            .orElseGet(() -> chatService.createAiConversation(userId));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiResponse(List<Choice> choices) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Choice(OpenAiMessage message) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiMessage(String role, String content, List<ToolCall> tool_calls) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ToolCall(String id, String type, ToolFunction function) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ToolFunction(String name, String arguments) {}
}
