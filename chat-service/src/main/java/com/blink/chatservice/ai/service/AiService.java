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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.stream.Collectors;

@Service
public class AiService {

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final RestTemplate restTemplate;
    private final McpToolRegistry toolRegistry;
    private final McpToolExecutor toolExecutor;
    private final ObjectMapper objectMapper;

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
    }

    public Message processAiMessage(String userId, String conversationId, String userMessage, boolean shouldSave) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (shouldSave) {
            saveMessage(userId, conversationId, userMessage);
        }

        List<Map<String, Object>> context = buildContext(conversationId, user);
        String response = executeReasoning(userId, context);
        
        return saveMessage(AiConstants.AI_USER_ID, conversationId, response);
    }

    private String executeReasoning(String userId, List<Map<String, Object>> messages) {
        int iterations = 0;
        while (iterations++ < AiConstants.MAX_TOOL_ITERATIONS) {
            OpenAiResponse response = callApi(messages);
            OpenAiMessage lastMsg = response.choices().get(0).message();

            if (lastMsg.tool_calls() != null && !lastMsg.tool_calls().isEmpty()) {
                messages.add(Map.of(
                    "role", "assistant",
                    "content", lastMsg.content() != null ? lastMsg.content() : "",
                    "tool_calls", lastMsg.tool_calls()
                ));

                for (ToolCall call : lastMsg.tool_calls()) {
                    executeTool(userId, call, messages);
                }
                continue;
            }

            if (lastMsg.content() != null && !lastMsg.content().isBlank()) {
                return lastMsg.content();
            }
        }
        return "I'm sorry, I couldn't complete that request.";
    }

    private void executeTool(String userId, ToolCall call, List<Map<String, Object>> messages) {
        var execution = toolExecutor.execute(userId, call.function().name(), call.function().arguments());
        messages.add(Map.of(
            "role", "tool",
            "tool_call_id", call.id(),
            "name", call.function().name(),
            "content", execution.toJson(objectMapper)
        ));
    }

    private OpenAiResponse callApi(List<Map<String, Object>> messages) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", AiConstants.DEFAULT_MAX_TOKENS);
        
        List<Map<String, Object>> tools = toolRegistry.all().stream()
            .map(t -> Map.of("type", "function", "function", Map.of(
                "name", t.name(), "description", t.description(), "parameters", t.inputSchema()
            ))).toList();
        
        if (!tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        return restTemplate.postForObject(baseUrl + "/v1/chat/completions", new HttpEntity<>(body, headers), OpenAiResponse.class);
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
        StringBuilder sb = new StringBuilder();
        sb.append("You are ").append(AiConstants.AI_USER_NAME).append(", a helpful assistant in Blink Chat.\n")
          .append("User: ").append(user.getUsername()).append(" (ID: ").append(user.getId()).append(")\n")
          .append("Date: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))).append("\n\n")
          .append("Capabilities:\n");
        
        toolRegistry.all().forEach(t -> sb.append("- ").append(t.name()).append(": ").append(t.description()).append("\n"));
        
        sb.append("\nGuidelines:\n")
          .append("1. Use tools for actions like sending messages or searching and more.\n")
          .append("2. Be concise and friendly.\n")
          .append("3. For save_file, ask for confirmation first.\n");
        
        return sb.toString();
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
