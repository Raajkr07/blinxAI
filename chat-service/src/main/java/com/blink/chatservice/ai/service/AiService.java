package com.blink.chatservice.ai.service;

import com.blink.chatservice.ai.config.AiConstants;
import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.executor.McpToolExecutor;
import com.blink.chatservice.mcp.registry.McpToolRegistry;
import com.blink.chatservice.mcp.tool.McpTool;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
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
import java.util.concurrent.Executor;

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
    private final Executor aiToolExecutor;
    private final ToolRouter toolRouter;
    private final TokenEstimator tokenEstimator;
    private final ResponseBudget responseBudget;

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
                     ObjectMapper objectMapper,
                     @Qualifier("aiToolExecutor") Executor aiToolExecutor,
                     ToolRouter toolRouter,
                     TokenEstimator tokenEstimator,
                     ResponseBudget responseBudget) {
        this.chatService = chatService;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.restTemplate = restTemplate;
        this.toolRegistry = toolRegistry;
        this.toolExecutor = toolExecutor;
        this.objectMapper = objectMapper;
        this.aiToolExecutor = aiToolExecutor;
        this.toolRouter = toolRouter;
        this.tokenEstimator = tokenEstimator;
        this.responseBudget = responseBudget;
    }

    public Message processAiMessage(String userId, String conversationId, String userMessage, boolean shouldSave) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (shouldSave) {
            chatService.sendMessage(conversationId, userId, userMessage);
        }

        // Route to only the tools relevant to the user's intent
        boolean conversational = toolRouter.isConversational(userMessage);
        List<McpTool> relevantTools = conversational ? Collections.emptyList() : toolRouter.route(userMessage, toolRegistry);

        // Dynamic max_tokens budget — industry pattern: match response size to query complexity
        int maxTokens = responseBudget.maxTokens(userMessage, conversational, !relevantTools.isEmpty());
        log.debug("Response budget: {} tokens (conversational={}, tools={})", maxTokens, conversational, relevantTools.size());

        List<Map<String, Object>> context = buildContext(conversationId, user, conversational);
        String response;
        try {
            response = executeReasoning(userId, context, relevantTools, maxTokens);
        } catch (Exception e) {
            log.error("AI reasoning failed for user {}: {}", userId, e.getMessage(), e);
            response = AiConstants.ERROR_AI_API_FAILED;
        }

        return chatService.sendMessage(conversationId, AiConstants.AI_USER_ID, response);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, String>> summarizeCapabilities() {
        String toolsJson;
        try {
            toolsJson = objectMapper.writeValueAsString(toolRegistry.all().stream()
                .map(t -> Map.of("name", t.name(), "description", t.description()))
                .toList());
        } catch (Exception e) {
            toolsJson = "[]";
        }

        String prompt = "You are a backend orchestrator. Here is a raw list of tools available:\n" + toolsJson + "\n" +
            "Group these tools into neat categories (e.g. 'Email', 'Calendar', 'Messaging', 'Search', 'Intelligence', 'Files').\n" +
            "For each category, provide a single, natural description of what you can do. Do NOT list the internal tool names.\n" +
            "Return EXACTLY a JSON array of objects with properties 'name' (category) and 'description' (summary of what you can do in this category in Indian English). \n" +
            "Return ONLY the JSON array. Do NOT wrap it in ```json blocks or provide any extra text.";

        List<Map<String, Object>> messages = List.of(
            Map.of("role", "user", "content", prompt)
        );

        OpenAiResponse response = callApi(messages, null, 1500);
        
        if (response != null && response.choices() != null && !response.choices().isEmpty()) {
            OpenAiMessage msg = response.choices().get(0).message();
            if (msg != null && msg.content() != null) {
                String content = msg.content().trim();
                try {
                    if (content.startsWith("```json")) content = content.substring(7);
                    if (content.startsWith("```")) content = content.substring(3);
                    if (content.endsWith("```")) content = content.substring(0, content.length() - 3);
                    content = content.trim();
                    
                    return objectMapper.readValue(content, List.class);
                } catch (Exception e) {
                    log.error("Failed to parse AI capabilities response: {}", content, e);
                }
            }
        }
        
        return List.of(Map.of("name", "Error", "description", "Unable to load capabilities via AI."));
    }

    @CircuitBreaker(name = "aiService", fallbackMethod = "executeReasoningFallback")
    String executeReasoning(String userId, List<Map<String, Object>> messages, List<McpTool> tools, int maxTokens) {
        // Build tool schemas once for the entire reasoning cycle (not per iteration)
        List<Map<String, Object>> toolSchemas = tools.isEmpty() ? Collections.emptyList() :
            tools.stream()
                .map(t -> Map.<String, Object>of("type", "function", "function", Map.of(
                    "name", t.name(), "description", t.description(), "parameters", t.inputSchema()
                ))).toList();

        int iterations = 0;
        while (iterations++ < AiConstants.MAX_TOOL_ITERATIONS) {
            OpenAiResponse response = callApi(messages, toolSchemas, maxTokens);
            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                log.warn("Empty API response at iteration {}", iterations);
                return AiConstants.ERROR_AI_API_FAILED;
            }

            OpenAiMessage lastMsg = response.choices().get(0).message();
            if (lastMsg == null) {
                return AiConstants.ERROR_AI_API_FAILED;
            }

            if (lastMsg.tool_calls() != null && !lastMsg.tool_calls().isEmpty()) {
                List<Map<String, Object>> updatedMessages = new ArrayList<>(messages);
                updatedMessages.add(Map.of(
                    "role", "assistant",
                    "content", lastMsg.content() != null ? lastMsg.content() : "",
                    "tool_calls", lastMsg.tool_calls()
                ));

                // Execute tools in parallel, truncate oversized results
                List<CompletableFuture<Map<String, Object>>> futures = lastMsg.tool_calls().stream()
                    .map(call -> CompletableFuture.supplyAsync(() -> {
                        try {
                            var execution = toolExecutor.execute(userId, call.function().name(), call.function().arguments());
                            String resultJson = execution.toJson(objectMapper);
                            // Cap tool results to prevent context explosion
                            resultJson = tokenEstimator.truncate(resultJson, AiConstants.MAX_TOOL_RESULT_TOKENS);
                            return Map.<String, Object>of(
                                "role", "tool",
                                "tool_call_id", call.id(),
                                "name", call.function().name(),
                                "content", resultJson
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
                    }, aiToolExecutor))
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

    private OpenAiResponse callApi(List<Map<String, Object>> messages, List<Map<String, Object>> toolSchemas, int maxTokens) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", maxTokens);
        body.put("temperature", AiConstants.DEFAULT_TEMPERATURE);

        if (toolSchemas != null && !toolSchemas.isEmpty()) {
            body.put("tools", toolSchemas);
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

    // Build context with sliding window: recent messages in full, older ones truncated.
    // For conversational messages, load fewer history messages to save tokens.
    private List<Map<String, Object>> buildContext(String conversationId, User user, boolean conversational) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", buildPrompt(user)));

        // Conversational messages only need last 3 messages for context continuity
        int historyLimit = conversational ? 3 : AiConstants.MAX_HISTORY_MESSAGES;

        List<Message> history = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
            conversationId, org.springframework.data.domain.PageRequest.of(0, historyLimit)
        ).getContent();

        // Reverse to chronological order
        List<Message> chronological = new ArrayList<>(history);
        Collections.reverse(chronological);

        int total = chronological.size();
        for (int i = 0; i < total; i++) {
            Message m = chronological.get(i);
            String role = m.getSenderId().equals(AiConstants.AI_USER_ID) ? "assistant" : "user";
            String body = m.getBody();

            // Older messages (beyond the recent window) get truncated to save tokens
            int posFromEnd = total - 1 - i;
            if (posFromEnd >= AiConstants.RECENT_MESSAGES_VERBATIM && body.length() > 200) {
                body = tokenEstimator.truncate(body, AiConstants.TRUNCATED_MESSAGE_MAX_TOKENS);
            }

            messages.add(Map.of("role", role, "content", body));
        }

        return messages;
    }

    private String buildPrompt(User user) {
        String timestamp = LocalDateTime.now(IST).format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
        return """
            You are %s, AI assistant in BlinX Chat.
            User: %s | Now: %s IST

            Response style:
            - This is a CHAT interface. Keep responses to 1-3 sentences unless the user explicitly asks for detail.
            - For greetings, reply with a single friendly sentence.
            - For web search results, summarize key findings in 2-4 concise bullet points.
            - Never exceed 3 paragraphs unless the user says "detailed", "explain", or asks for a specific word count.
            - Use markdown formatting (bold, bullets) for readability.

            Behavior:
            - Concise, proactive, professional. No fluff or filler.
            - Call tools directly without asking permission.
            - Infer missing details (default event duration: 1hr). Ask only if essential.
            - For "What can you do?": list Email, Calendar, Messaging, Intelligence capabilities briefly. At the end, ALWAYS add: "(To view my detailed capabilities, go to: ... -> View Profile or right-click on the AI Button)".
            - Calendar adds: infer details, confirm with user.
            - Email sends: call the send_email tool first. The UI will automatically pop up a preview modal for the user to edit/confirm. Do NOT repeat the email content in your chat response.

            EMAIL WRITING (CRITICAL — follow strictly):
            - Write ALL emails in natural, casual-professional Indian English. Sound like a real person, NOT an AI.
            - NEVER use these phrases: "I hope this email finds you well", "As per our discussion", "Please find attached", "I am writing to", "Kindly do the needful", "I would like to bring to your notice", "With reference to", "Thanking you".
            - Use warm, direct openings: "Hey Raj,", "Hi there,", "Quick update —", "Just wanted to check —".
            - Keep it SHORT. Real people don't write 5-paragraph emails. 3-5 lines max unless the user asks for more.
            - Replies should match the tone of the original email. If someone wrote casually, reply casually. If formal, stay formal but still human.
            - Use natural sign-offs: "Cheers,", "Thanks!", "Talk soon,", "Best," — NOT "Warm regards" or "Yours sincerely".
            - For follow-ups, be direct: "Hey, just following up on this — any update?" instead of "I am writing to follow up on my previous correspondence."
            - Match the user's intent exactly. If they say "tell him I'll be late", write a 2-line casual message, not a formal letter.

            CALENDAR EVENTS:
            - Write event titles like a real person would: "Coffee with Raj" not "Meeting: Coffee Discussion with Mr. Raj Kumar".
            - Descriptions should be brief personal notes: "Catching up on the project timeline" not "This meeting has been scheduled to discuss the ongoing project deliverables and timeline."
            - For event modifications, be direct in your chat response: "Done, moved to 4 PM" — not "I have successfully rescheduled your calendar event."
            - For holidays/festivals queries, use dateFilter with the month name (e.g., 'march') and include query like 'holiday' or 'festival'. The system will automatically search special calendars.

            EMAIL & DATE HANDLING (CRITICAL):
            - ALWAYS use the dateFilter parameter for dates, NEVER put dates in the query parameter.
            - For specific dates, use DD-MM-YYYY format (e.g., '25-02-2026').
            - For "emails on 25-02-2026", use dateFilter='25-02-2026' with NO query.
            - For month queries like "March emails", use dateFilter='march'.
            - For relative queries, use: 'today', 'yesterday', 'last_3_days', 'last_7_days', 'last_30_days'.
            - Use labelFilter='ALL' or leave empty to search all labels (recommended). Only restrict to 'INBOX' if user specifically asks.
            """.formatted(AiConstants.AI_USER_NAME, user.getUsername(), timestamp);
    }

    public Conversation getOrCreateAiConversation(String userId) {
        return chatService.listConversationsForUser(userId).stream()
            .filter(c -> "AI_ASSISTANT".equals(c.getType().name()))
            .findFirst()
            .orElseGet(() -> chatService.createAiConversation(userId));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiResponse(List<Choice> choices, Usage usage) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Choice(OpenAiMessage message) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OpenAiMessage(String role, String content, List<ToolCall> tool_calls) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ToolCall(String id, String type, ToolFunction function) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ToolFunction(String name, String arguments) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Usage(int prompt_tokens, int completion_tokens, int total_tokens) {}

    public String executeReasoningFallback(String userId, List<Map<String, Object>> messages, List<McpTool> tools, int maxTokens, Throwable t) {
        log.error("AI reasoning circuit breaker active for user {}: {}", userId, t.getMessage());
        return AiConstants.ERROR_AI_API_FAILED;
    }
}
