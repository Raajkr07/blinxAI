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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.time.ZoneId;

/**
 * AI Chat Service - Production-grade implementation with:
 * - Autonomous tool execution (like Claude/ChatGPT)
 * - Retry logic with exponential backoff
 * - Proper error handling and sanitization
 * - Structured logging and metrics
 * - Separation of concerns (tool execution delegated)
 */
@Service
@Slf4j
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

    public Message processAiMessage(String userId, String conversationId, String userMessage, boolean shouldSaveUserMessage) {
        long startTime = System.currentTimeMillis();
        
        try {
            log.info("[AI] Processing message from user: {} in conversation: {}", userId, conversationId);
            
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            // Save user's message first (ensures persistence even if AI fails)
            if (shouldSaveUserMessage) {
                saveUserMessage(userId, conversationId, userMessage);
            }

            // Build conversation context
            List<Map<String, Object>> messages = buildConversationMessages(conversationId, user);

            // Execute AI reasoning loop (may involve multiple tool calls)
            String aiResponse = executeAiReasoningLoop(userId, messages);

            // Save and return AI's response
            Message savedMessage = saveAiMessage(conversationId, aiResponse);
            
            long duration = System.currentTimeMillis() - startTime;
            log.info("[AI] Completed in {}ms for user: {}", duration, userId);
            
            return savedMessage;

        } catch (IllegalStateException e) {
            log.error("[AI] Configuration error", e);
            return saveAiMessage(conversationId, "I'm currently unavailable. Please try again later.");
            
        } catch (Exception e) {
            log.error("[AI] Processing failed for user: {}", userId, e);
            return saveAiMessage(conversationId, "I encountered an error. Please try again.");
        }
    }

    /**
     * Core AI reasoning loop with tool execution.
     * Implements the thought-action-observation pattern like Claude/ChatGPT.
     */
    private String executeAiReasoningLoop(String userId, List<Map<String, Object>> messages) 
            throws JsonProcessingException {
        
        int iteration = 0;

        while (iteration++ < AiConstants.MAX_TOOL_ITERATIONS) {
            
            // Call OpenAI API with retry logic
            OpenAiResponse response = callOpenAiApiWithRetry(messages);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new RuntimeException("Empty AI response");
            }

            OpenAiMessage aiMessage = response.choices().get(0).message();

            // Check if AI wants to call tools
            if (aiMessage.tool_calls() != null && !aiMessage.tool_calls().isEmpty()) {
                log.info("[AI] Requested {} tool call(s)", aiMessage.tool_calls().size());

                // Add AI's tool-calling message to conversation
                messages.add(buildAssistantToolCallMessage(aiMessage));

                // Execute each tool and add results
                for (ToolCall toolCall : aiMessage.tool_calls()) {
                    executeToolAndAddResult(userId, toolCall, messages);
                }

                // Continue loop - AI will process tool results and respond
                continue;
            }

            // AI provided final response (no more tools needed)
            if (aiMessage.content() != null && !aiMessage.content().trim().isEmpty()) {
                return aiMessage.content();
            }

            throw new RuntimeException("AI returned no content and no tool calls");
        }

        log.warn("[AI] Max iterations reached for user: {}", userId);
        return "Your request is too complex. Please break it down into smaller steps.";
    }

    /**
     * Execute a single tool call using the dedicated executor.
     */
    private void executeToolAndAddResult(String userId, ToolCall toolCall, List<Map<String, Object>> messages) {
        String toolName = toolCall.function().name();
        String arguments = toolCall.function().arguments();

        // Delegate to McpToolExecutor (handles timeout, validation, sanitization)
        McpToolExecutor.ToolExecutionResult result = toolExecutor.execute(userId, toolName, arguments);

        // Add tool result to conversation (OpenAI format)
        messages.add(Map.of(
                "role", "tool",
                "tool_call_id", toolCall.id(),
                "name", toolName,
                "content", result.toJson(objectMapper)
        ));
    }

    /**
     * Call OpenAI API with exponential backoff retry.
     */
    private OpenAiResponse callOpenAiApiWithRetry(List<Map<String, Object>> messages) 
            throws JsonProcessingException {
        
        int attempt = 0;
        Exception lastException = null;

        while (attempt < AiConstants.AI_API_RETRY_ATTEMPTS) {
            try {
                return callOpenAiApi(messages);
            } catch (RestClientException e) {
                lastException = e;
                attempt++;
                
                if (attempt < AiConstants.AI_API_RETRY_ATTEMPTS) {
                    long delay = AiConstants.AI_API_RETRY_DELAY_MS * (1L << (attempt - 1)); // Exponential backoff
                    log.warn("[AI] API call failed (attempt {}/{}), retrying in {}ms", 
                            attempt, AiConstants.AI_API_RETRY_ATTEMPTS, delay);
                    
                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during retry", ie);
                    }
                }
            }
        }

        log.error("[AI] API call failed after {} attempts", AiConstants.AI_API_RETRY_ATTEMPTS, lastException);
        throw new RuntimeException(AiConstants.ERROR_AI_API_FAILED, lastException);
    }

    /**
     * Call OpenAI API (single attempt).
     */
    private OpenAiResponse callOpenAiApi(List<Map<String, Object>> messages) throws JsonProcessingException {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("AI API key not configured");
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);
        requestBody.put("max_tokens", AiConstants.DEFAULT_MAX_TOKENS);
        requestBody.put("temperature", AiConstants.DEFAULT_TEMPERATURE);

        // Include tools if available
        List<Map<String, Object>> tools = buildToolDefinitions();
        if (!tools.isEmpty()) {
            requestBody.put("tools", tools);
            requestBody.put("tool_choice", "auto");
        }

        String url = baseUrl + "/v1/chat/completions";
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        String jsonBody = objectMapper.writeValueAsString(requestBody);

        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
        return restTemplate.postForObject(url, entity, OpenAiResponse.class);
    }

    /**
     * Build conversation messages from database history + system prompt.
     */
    private List<Map<String, Object>> buildConversationMessages(String conversationId, User user) {
        List<Map<String, Object>> messages = new ArrayList<>();

        // System prompt (defines AI behavior and available tools)
        messages.add(Map.of(
                "role", "system",
                "content", buildSystemPrompt(user)
        ));

        // Recent conversation history
        List<Message> history = messageRepository
                .findByConversationIdAndDeletedFalseOrderByIdDesc(
                        conversationId,
                        org.springframework.data.domain.PageRequest.of(0, AiConstants.MAX_HISTORY_MESSAGES)
                )
                .getContent().stream()
                .sorted(Comparator.comparing(Message::getId))
                .collect(Collectors.toList());

        for (Message msg : history) {
            String role = msg.getSenderId().equals(AiConstants.AI_USER_ID) ? "assistant" : "user";
            messages.add(Map.of(
                    "role", role,
                    "content", msg.getBody()
            ));
        }

        return messages;
    }

    /**
     * Build system prompt that explains AI capabilities and available tools.
     */
    private String buildSystemPrompt(User user) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are ").append(AiConstants.AI_USER_NAME)
              .append(", a helpful assistant in the Blink Chat application.\n\n");
        prompt.append("User: ").append(user.getUsername())
              .append(" (ID: ").append(user.getId()).append(")\n");
        
        // Add current date/time context
        prompt.append("Current Date/Time: ").append(java.time.LocalDateTime.now()
              .format(java.time.format.DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a")))
              .append("\n\n");

        prompt.append("CAPABILITIES:\n");
        prompt.append("You can chat naturally AND perform actions using the following tools:\n\n");

        toolRegistry.all().forEach(tool -> {
            prompt.append("- ").append(tool.name()).append(": ")
                  .append(tool.description()).append("\n");
        });

        prompt.append("\nGUIDELINES:\n");
        prompt.append("1. When a user asks you to DO something (send message, search users, etc.), use the appropriate tool.\n");
        prompt.append("2. For general questions or conversation, respond directly without tools.\n");
        prompt.append("3. You CAN answer general knowledge questions, provide information, and have natural conversations.\n");
        prompt.append("4. For date/time questions, use the current date/time provided above.\n");
        prompt.append("5. BEFORE using save_file tool, ALWAYS ask the user: 'Would you like me to generate this file for you to save as [filename]?' Wait for confirmation.\n");
        prompt.append("6. When saving files, organize and format the content nicely for readability.\n");
        prompt.append("7. Be friendly, concise, and helpful.\n");
        prompt.append("8. If a tool fails, explain the error clearly to the user.\n");
        prompt.append("9. Always confirm successful actions (e.g., 'Message sent to John').\n");
        prompt.append("10. IMPORTANT: When using save_file, the tool creates a draft. You MUST tell the user to check the popup to confirm and choose the save location.\n");
        prompt.append("11. Use plain text formatting - avoid markdown symbols like ** (bold) or * (italics).\n");
        prompt.append("12. For send_email: ask for recipient, subject, and content if missing. When you call the tool, it will open a preview modal for the user. Tell the user 'I've drafted the email for you to review.'\n");

        return prompt.toString();
    }

    /**
     * Build OpenAI tool definitions from MCP tools.
     */
    private List<Map<String, Object>> buildToolDefinitions() {
        return toolRegistry.all().stream()
                .map(tool -> Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", tool.name(),
                                "description", tool.description(),
                                "parameters", tool.inputSchema()
                        )
                ))
                .collect(Collectors.toList());
    }

    /**
     * Build assistant message with tool calls (OpenAI format).
     */
    private Map<String, Object> buildAssistantToolCallMessage(OpenAiMessage aiMessage) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("role", "assistant");
        msg.put("content", aiMessage.content() != null ? aiMessage.content() : "");
        msg.put("tool_calls", aiMessage.tool_calls().stream()
                .map(tc -> Map.of(
                        "id", tc.id(),
                        "type", "function",
                        "function", Map.of(
                                "name", tc.function().name(),
                                "arguments", tc.function().arguments()
                        )
                ))
                .collect(Collectors.toList()));
        return msg;
    }

    private void saveUserMessage(String userId, String conversationId, String content) {
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(userId);
        msg.setBody(content.trim());
        msg.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        msg.setSeen(false);
        msg.setDeleted(false);
        messageRepository.save(msg);
    }

    private Message saveAiMessage(String conversationId, String content) {
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(AiConstants.AI_USER_ID);
        msg.setBody(content);
        msg.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        msg.setSeen(false);
        msg.setDeleted(false);
        Message saved = messageRepository.save(msg);
        return saved;
    }

    public Conversation getOrCreateAiConversation(String userId) {
        List<Conversation> conversations = chatService.listConversationsForUser(userId);
        return conversations.stream()
                .filter(c -> "AI_ASSISTANT".equals(c.getType().name()))
                .findFirst()
                .orElseGet(() -> chatService.createAiConversation(userId));
    }

    // OpenAI API Response DTOs
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
