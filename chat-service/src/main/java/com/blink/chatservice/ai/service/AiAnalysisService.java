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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AiAnalysisService {

    @Qualifier("aiRestTemplate")
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.provider:openai}")
    private String aiProvider;

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:gpt-4.1-mini}")
    private String model;

    @Value("${ai.base-url:https://api.openai.com}")
    private String baseUrl;

    public AiAnalysisService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public ConversationAnalysis analyzeConversation(List<Message> messages) {
        String prompt = "Analyze the following conversation history and provide insights.";
        String context = messages.stream()
                .map(m -> m.getSenderId() + ": " + m.getBody())
                .collect(Collectors.joining("\n"));

        return callAi(prompt, context, ConversationAnalysis.class,
                """
                You are a conversation analyst. Analyze the chat log provided.
                Return a JSON object with:
                - summary: string (max 3 lines)
                - key_points: array of strings (3-5 items)
                - sentiment: "positive" | "neutral" | "negative"
                - urgency: "low" | "medium" | "high"
                - follow_up_required: boolean
                """);
    }

    public AutoReplySuggestions suggestReplies(Message lastMessage) {
        String prompt = "Generate smart auto-replies for the last message.";
        String context = "Last message from " + lastMessage.getSenderId() + ": " + lastMessage.getBody();

        return callAi(prompt, context, AutoReplySuggestions.class,
                """
                You are a smart messaging assistant.
                Generate distinct, context-aware auto-replies.
                Return a JSON object with:
                - suggested_replies: array of strings (3-5 items)
                
                CRITICAL RULES:
                - Each reply MUST be 5-10 words maximum
                - MUST be complete sentences (no truncation, no ellipsis)
                - Match conversation tone (formal / informal)
                - No repetition
                - Be natural and conversational
                - Examples: "Thanks for the update!", "I'll get back to you soon.", "Sounds good to me!"
                """);
    }

    public SearchCriteria extractSearchQuery(String naturalQuery) {
        return callAi("Extract structured search criteria.", naturalQuery, SearchCriteria.class,
                """
                You are a search query parser. Extract structured filters from the natural language query.
                Return a JSON object with:
                - keywords: array of strings
                - user_names: array of strings (or empty)
                - date_range: { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } or null
                - sentiment: "positive" | "neutral" | "negative" | null
                - conversation_type: "direct" | "group" | null
                
                If required data is missing, return null for that field.
                """);
    }

    public TaskListExtraction extractTasks(String messageText) {
        String currentDate = LocalDate.now().toString();
        return callAi("Extract all tasks or reminders.", messageText, TaskListExtraction.class,
                """
                You are a task extractor. Analyze the conversation history for actionable tasks.
                Current Date: %s
                
                Identify ALL tasks mentioned.
                Categorize each task as "pending" (upcoming/future) or "done" (completed/past).
                
                Return a JSON object with:
                - tasks: array of task objects
                  - task_title: string
                  - description: string
                  - due_date: ISO 8601 string or null (calculated based on Current Date)
                  - priority: "low" | "medium" | "high"
                  - status: "pending" | "done"
                
                If NO tasks are detected, return { "tasks": [] }.
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
         return callAi("Estimate typing behavior.", messageText, TypingSimulation.class,
                 """
                 You are a UI behavior simulator. Estimate the complexity and typing duration for responding to or typing the provided text.
                 Return a JSON object with:
                 - response_complexity: "low" | "medium" | "high"
                 - typing_duration_ms: integer (realistic human typing delay for the text)
                 """);
    }

    @SuppressWarnings("unchecked")
    private <T> T callAi(String userPrompt, String userContext, Class<T> responseType, String systemInstructions) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("AI API key is not configured");
        }
        String url = baseUrl + "/v1/chat/completions";

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("max_tokens", 512);
        requestBody.put("temperature", 0.3);
        requestBody.put("response_format", Map.of("type", "json_object"));

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", systemInstructions + "\nIMPORTANT: Return ONLY valid JSON."),
                Map.of("role", "user", "content", userPrompt + "\n\nContext:\n" + userContext)
        );
        requestBody.put("messages", messages);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            Map<String, Object> response = restTemplate.postForObject(url, entity, Map.class);
            
            if (response == null || !response.containsKey("choices")) {
                throw new RuntimeException("Empty AI response");
            }

            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices.isEmpty()) throw new RuntimeException("No choices in AI response");

            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");

            if (content == null || content.trim().isEmpty()) return null;

            return objectMapper.readValue(content, responseType);

        } catch (Exception e) {
            log.error("Error during AI analysis call: {}", e.getMessage());
            throw new RuntimeException("AI Analysis failed: " + e.getMessage(), e);
        }
    }
}
