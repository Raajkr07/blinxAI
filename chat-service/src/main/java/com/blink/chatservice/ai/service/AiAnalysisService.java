package com.blink.chatservice.ai.service;

import com.blink.chatservice.ai.model.AiAnalysisModels.*;
import com.blink.chatservice.chat.entity.Message;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AiAnalysisService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:gpt-4o-mini}")
    private String model;

    @Value("${ai.base-url:https://api.openai.com}")
    private String baseUrl;

    public AiAnalysisService(@Qualifier("aiRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @CircuitBreaker(name = "aiAnalysisService", fallbackMethod = "analyzeFallback")
    public ConversationAnalysis analyzeConversation(List<Message> messages) {
        String context = messages.stream()
                .map(m -> String.format("[%s] %s: %s",
                    m.getCreatedAt().format(DateTimeFormatter.ofPattern("dd-MM HH:mm")),
                    m.getSenderId(), m.getBody()))
                .collect(Collectors.joining("\n"));

        return callAi(context, ConversationAnalysis.class,
                """
                Analyze chat log. Return JSON:
                {"summary":"str(max 3 lines)","key_points":["str"](3-5),"sentiment":"positive|neutral|negative","urgency":"low|medium|high","follow_up_required":bool}
                """);
    }

    @CircuitBreaker(name = "aiAnalysisService", fallbackMethod = "suggestFallback")
    public AutoReplySuggestions suggestReplies(Message lastMessage) {
        String context = lastMessage.getSenderId() + ": " + lastMessage.getBody();

        return callAi(context, AutoReplySuggestions.class,
                """
                Generate 3-5 auto-replies. Return JSON:
                {"suggested_replies":["str"]}
                Rules: 5-10 words each, complete sentences, match tone, no repetition.
                """);
    }

    public SearchCriteria extractSearchQuery(String naturalQuery) {
        return callAi(naturalQuery, SearchCriteria.class,
                """
                Extract search filters. Return JSON:
                {"keywords":["str"],"user_names":["str"],"date_range":{"from":"DD-MM-YYYY","to":"DD-MM-YYYY"}|null,"sentiment":"positive|neutral|negative"|null,"conversation_type":"direct|group"|null}
                """);
    }

    public TaskListExtraction extractTasks(String messageText) {
        String currentDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
        return callAi(messageText, TaskListExtraction.class,
                """
                You are a task extraction expert. Carefully read the conversation/text below and extract ALL actionable items.
                Current Date: %s.

                What counts as a task:
                - Explicit to-dos: "I'll send the report", "Can you review this?", "Let's schedule a call"
                - Deadlines/commitments: "Need this by Friday", "Submit before 5pm", "Due next week"
                - Follow-ups: "I'll check and get back", "Will update you tomorrow", "Remind me to..."
                - Action items from decisions: "So we're going with plan B", "Let's finalize the design"
                - Requests: "Please share the file", "Can you book the room?"

                What is NOT a task:
                - Greetings, casual chat, opinions, questions without action
                - Past events that are purely informational

                Return JSON:
                {"tasks":[{"task_title":"short clear title","description":"brief context from conversation","date":"DD-MM-YYYY"|null,"priority":"low|medium|high","status":"pending|done"}]}
                Rules:
                - task_title: 3-8 words, actionable verb (e.g. "Send project report to Raj")
                - description: 1 line of context explaining why/what
                - date: extract or infer date if mentioned, null if not
                - priority: high=urgent/deadline, medium=important, low=nice-to-have
                - status: "done" if explicitly completed, "pending" otherwise
                - Empty if no tasks: {"tasks":[]}
                """.formatted(currentDate));
    }

    public TaskExtraction extractTask(String messageText) {
        TaskListExtraction list = extractTasks(messageText);
        if (list != null && list.tasks() != null && !list.tasks().isEmpty()) {
            return list.tasks().get(0);
        }
        return null;
    }

    public TypingSimulation simulateTyping(String messageText) {
         return callAi(messageText, TypingSimulation.class,
                 """
                 Estimate typing complexity. Return JSON:
                 {"response_complexity":"low|medium|high","typing_duration_ms":int}
                 """);
    }

    @SuppressWarnings("unchecked")
    private <T> T callAi(String userContext, Class<T> responseType, String systemInstructions) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("AI API key is not configured");
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("max_tokens", 512);
        requestBody.put("temperature", 0.3);
        requestBody.put("response_format", Map.of("type", "json_object"));

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", systemInstructions + "\nReturn ONLY valid JSON."),
                Map.of("role", "user", "content", userContext)
        );
        requestBody.put("messages", messages);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            Map<String, Object> response = restTemplate.postForObject(
                    baseUrl + "/v1/chat/completions", entity, Map.class);

            if (response == null || !response.containsKey("choices")) {
                throw new RuntimeException("Empty AI response");
            }

            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new RuntimeException("No choices in AI response");
            }

            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            if (message == null) {
                throw new RuntimeException("No message in AI response");
            }

            String content = (String) message.get("content");
            if (content == null || content.trim().isEmpty()) return null;

            return objectMapper.readValue(content, responseType);

        } catch (Exception e) {
            log.error("AI analysis call failed: {}", e.getMessage());
            throw new RuntimeException("AI Analysis failed: " + e.getMessage(), e);
        }
    }

    public ConversationAnalysis analyzeFallback(List<Message> messages, Throwable t) {
        log.error("AI analysis circuit breaker active: {}", t.getMessage());
        return new ConversationAnalysis("Summary unreachable right now.", Collections.emptyList(), "Neutral", "Low", false);
    }

    public AutoReplySuggestions suggestFallback(Message lastMessage, Throwable t) {
        log.error("AI suggest circuit breaker active: {}", t.getMessage());
        return new AutoReplySuggestions(List.of("Okay", "Understood"), "Suggestions currently unavailable.");
    }
}
