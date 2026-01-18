package com.blink.chatservice.ai.service;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.registry.McpToolRegistry;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

// Service wrapper for OpenAI / MCP tool calls.
// Acts as an orchestration layer between ChatService and LLMs.
@Service
@Slf4j
public class AiService {

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    @Qualifier("aiRestTemplate")
    private final RestTemplate restTemplate;
    private final McpToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    public AiService(ChatService chatService,
                     UserRepository userRepository,
                     MessageRepository messageRepository,
                     McpToolRegistry toolRegistry,
                     RestTemplate restTemplate,
                     ObjectMapper objectMapper) {
        this.chatService = chatService;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.toolRegistry = toolRegistry;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Value("${ai.provider:openai}")
    private String aiProvider;

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:gpt-4.1-mini}")
    private String model;

    @Value("${ai.base-url:https://api.openai.com}")
    private String baseUrl;

    private static final String AI_USER_ID = "ai-assistant";
    private static final int MAX_ITERATIONS = 5;

    public Message processAiMessage(String userId, String conversationId, String userMessage) {
        try {
            // Get user context
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            // Save user message FIRST before processing AI response.
            // This ensures if AI fails/timeouts, user at least sees their own message.
            Message userMsg = new Message();
            userMsg.setConversationId(conversationId);
            userMsg.setSenderId(userId);
            userMsg.setBody(userMessage.trim());
            userMsg.setCreatedAt(LocalDateTime.now());
            userMsg.setSeen(false);
            userMsg.setDeleted(false);
            messageRepository.save(userMsg);
            log.debug("Saved user message for userId={}, conversationId={}", userId, conversationId);

            // Get conversation history (now includes the user message we just saved)
            List<Message> history = messageRepository
                    .findByConversationIdAndDeletedFalseOrderByCreatedAtDesc(conversationId, 
                            org.springframework.data.domain.PageRequest.of(0, 20))
                    .getContent()
                    .stream()
                    .sorted(Comparator.comparing(Message::getCreatedAt))
                    .collect(Collectors.toList());

            // Get user's conversations and friends
            List<Conversation> userConversations = chatService.listConversationsForUser(userId);
            Set<String> friendIds = userConversations.stream()
                    .filter(c -> c.getType().name().equals("DIRECT"))
                    .flatMap(c -> c.getParticipants().stream())
                    .filter(id -> !id.equals(userId) && !id.equals(AI_USER_ID))
                    .collect(Collectors.toSet());

            // Build system prompt with user context
            String systemPrompt = buildSystemPrompt(user, userConversations, friendIds);

            // Build conversation messages (exclude the user message we just added, as it's already in history)
            List<Map<String, String>> messages = buildMessages(history, null);

            // Call AI API
            String aiResponse = callOpenAIApi(userId, systemPrompt, messages);

            // Save AI response as a message
            Message aiMessage = new Message();
            aiMessage.setConversationId(conversationId);
            aiMessage.setSenderId(AI_USER_ID);
            aiMessage.setBody(aiResponse);
            aiMessage.setCreatedAt(LocalDateTime.now());
            aiMessage.setSeen(false);
            aiMessage.setDeleted(false);

            Message savedAiMessage = messageRepository.save(aiMessage);
            log.debug("Saved AI response for userId={}, conversationId={}", userId, conversationId);

            return savedAiMessage;
        } catch (Exception e) {
            log.error("Error processing AI message for userId={}, conversationId={}",
                    userId, conversationId, e);

            throw new RuntimeException("Failed to process AI message: " + e.getMessage(), e);
        }
    }

    private String buildSystemPrompt(User user, List<Conversation> conversations, Set<String> friendIds) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("""
        You are Blink AI, a smart and friendly assistant integrated into the Blink chat application.
        Your goal is to help users communicate, manage their data, and navigate the app efficiently.
        
        You have access to a set of powerful tools. ALWAYS use them when a user asks to perform an action.
        Do not describe how to do it; just do it.
        """);
        
        prompt.append("\nAVAILABLE TOOLS & CAPABILITIES:\n");
        toolRegistry.all().forEach(tool -> {
             prompt.append("- ").append(tool.name()).append(": ").append(tool.description()).append("\n");
        });
        
        prompt.append("\nHowever, you can also:\n");
        prompt.append("- Answer general questions about the app or assist with drafting messages.\n");
        prompt.append("- Summarize lengthy conversations and extract key insights.\n");
        
        prompt.append("\nUSER CONTEXT:\n");
        prompt.append("Name: ").append(user.getUsername() != null ? user.getUsername() : "Unknown").append("\n");
        prompt.append("ID: ").append(user.getId()).append("\n");
        
        prompt.append("\nSTATS:\n");
        prompt.append("- Active Conversations: ").append(conversations.size()).append("\n");
        
        if (!friendIds.isEmpty()) {
            prompt.append("- Friends: ").append(String.join(", ", friendIds)).append("\n");
        }

        prompt.append("\nGUIDELINES:\n");
        prompt.append("1. If the user asks 'What can I do?', provide a bulleted list of your specific capabilities based strictly on the 'AVAILABLE TOOLS' listed above. Group them logically.\n");
        prompt.append("2. Be concise but warm. Use emojis sparingly if appropriate.\n");
        prompt.append("3. If a tool fails, explain why clearly to the user.\n");
        prompt.append("4. Never assume successful action without tool confirmation.\n");

        return prompt.toString();
    }

    private List<Map<String, Object>> openAiTools() {
        return toolRegistry.all().stream()
                .map(tool -> Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", tool.name(),
                                "description", tool.description(),
                                "parameters", tool.inputSchema()
                        )
                ))
                .toList();
    }

    private List<Map<String, String>> buildMessages(List<Message> history, String userMessage) {
        List<Map<String, String>> messages = new ArrayList<>();

        // Add history (last 10 messages for context)
        List<Message> recentHistory = history.stream()
                .skip(Math.max(0, history.size() - 10))
                .collect(Collectors.toList());

        for (Message msg : recentHistory) {
            Map<String, String> message = new HashMap<>();
            if (msg.getSenderId().equals(AI_USER_ID)) {
                message.put("role", "assistant");
            } else {
                message.put("role", "user");
            }
            message.put("content", msg.getBody());
            messages.add(message);
        }

        // Add current user message if provided (for backward compatibility)
        if (userMessage != null && !userMessage.trim().isEmpty()) {
            Map<String, String> currentMessage = new HashMap<>();
            currentMessage.put("role", "user");
            currentMessage.put("content", userMessage.trim());
            messages.add(currentMessage);
        }

        return messages;
    }

    private String callOpenAIApi(String userId, String systemPrompt, List<Map<String, String>> messages) throws JsonProcessingException {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("AI API key is not configured");
        }

        List<Map<String, Object>> conversation = new ArrayList<>();
        conversation.add(Map.of(
                "role", "system",
                "content", systemPrompt
        ));
        messages.forEach(m -> conversation.add(new HashMap<>(m)));

        int iteration = 0;

        while (iteration++ < MAX_ITERATIONS) {
            // Prepare Request
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("messages", conversation);
            requestBody.put("max_tokens", 512);
            
            List<Map<String, Object>> tools = openAiTools();
            if (!tools.isEmpty()) {
                requestBody.put("tools", tools);
                requestBody.put("tool_choice", "auto");
            }

            // Execute Request
            OpenAiResponse response = executeRequest(requestBody);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new RuntimeException("Empty AI response from provider");
            }

            Choice choice = response.choices().get(0);
            OpenAiMessage responseMessage = choice.message();

            // Check if there are tool calls
            if (responseMessage.tool_calls() != null && !responseMessage.tool_calls().isEmpty()) {
                
                // 1. Add assistant message with tool calls to conversation
                Map<String, Object> assistantMsg = new HashMap<>();
                assistantMsg.put("role", "assistant");
                assistantMsg.put("content", responseMessage.content());
                assistantMsg.put("tool_calls", responseMessage.tool_calls().stream()
                        .map(tc -> Map.of(
                                "id", tc.id(),
                                "type", "function",
                                "function", Map.of(
                                        "name", tc.function().name(),
                                        "arguments", tc.function().arguments()
                                )
                        ))
                        .collect(Collectors.toList()));
                conversation.add(assistantMsg);

                // 2. Execute tools and add results
                executeToolsSafely(userId, responseMessage.tool_calls(), conversation);
                
                // 3. Loop again to let AI process tool outputs and generate final response.
                continue;
            }

            // Return the message content
            if (responseMessage.content() != null && !responseMessage.content().trim().isEmpty()) {
                return responseMessage.content();
            }

            throw new RuntimeException("No assistant message content returned and no tool calls made");
        }
        
        throw new RuntimeException("AI tool execution exceeded max iterations (" + MAX_ITERATIONS + ")");
    }
    
    private OpenAiResponse executeRequest(Map<String, Object> requestBody) {
        String url = baseUrl + "/v1/chat/completions";
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        String jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsString(requestBody);
            log.debug("Sending AI Request: {}", jsonBody);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize request body", e);
        }

        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);

        try {
            return restTemplate.postForObject(url, entity, OpenAiResponse.class);
        } catch (Exception e) {
            log.error("Error calling AI API: {}", e.getMessage());
            throw new RuntimeException("Failed to call AI API: " + e.getMessage(), e);
        }
    }

    public Conversation getOrCreateAiConversation(String userId) {
        // Check if AI conversation exists
        List<Conversation> conversations = chatService.listConversationsForUser(userId);
        Optional<Conversation> aiConv = conversations.stream()
                .filter(c -> c.getType().name().equals("AI_ASSISTANT"))
                .findFirst();

        if (aiConv.isPresent()) {
            return aiConv.get();
        }

        return chatService.createAiConversation(userId);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiResponse(String id, String object, long created, String model, List<Choice> choices, Usage usage) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Choice(int index, OpenAiMessage message, String finishReason) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiMessage(String role, String content, List<ToolCall> tool_calls) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ToolCall(String id, String type, ToolFunction function) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ToolFunction(String name, String arguments) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Usage(int promptTokens, int completionTokens, int totalTokens) {}

    private void executeToolsSafely(
            String userId,
            List<ToolCall> toolCalls,
            List<Map<String, Object>> conversation) {

        if (toolCalls == null || toolCalls.isEmpty()) return;

        for (ToolCall call : toolCalls) {
            String resultJson;
            try {
                var tool = toolRegistry.get(call.function().name());
                
                if (tool == null) {
                    log.warn("Model requested non-existent tool: {}", call.function().name());
                    resultJson = safeJson(Map.of("error", "Tool not found: " + call.function().name()));
                } else if (!tool.isAllowedForUser(userId)) {
                    log.warn("User {} tried to use unauthorized tool: {}", userId, call.function().name());
                    resultJson = safeJson(Map.of("error", "Unauthorized to use tool: " + call.function().name()));
                } else {
                    Map<Object, Object> args = new HashMap<>();
                    if (call.function().arguments() != null && !call.function().arguments().isBlank()) {
                        try {
                            args = objectMapper.readValue(call.function().arguments(), Map.class);
                        } catch (Exception e) {
                            throw new IllegalArgumentException("Invalid JSON arguments provided by model");
                        }
                    }
                    
                    log.info("Executing tool {} for user {}", call.function().name(), userId);
                    Object result = tool.execute(userId, args);
                    resultJson = safeJson(result);
                }
            } catch (Exception e) {
                log.error("Tool execution failed: {}", call.function().name(), e);
                resultJson = safeJson(Map.of("error", "Execution failed: " + e.getMessage()));
            }

            conversation.add(Map.of(
                    "role", "tool",
                    "tool_call_id", call.id(),
                    "name", call.function().name(),
                    "content", resultJson
            ));
        }
    }

    private String safeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "{\"error\":\"Result could not be serialized\"}";
        }
    }
}
