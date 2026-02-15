package com.blink.chatservice.ai.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

public class AiAnalysisModels {

    @JsonInclude(NON_NULL)
    public record ConversationAnalysis(
            String summary,
            @JsonProperty("key_points") List<String> keyPoints,
            String sentiment,
            String urgency,
            @JsonProperty("follow_up_required") boolean followUpRequired
    ) {}

    @JsonInclude(NON_NULL)
    public record AutoReplySuggestions(
            @JsonProperty("suggested_replies") List<String> suggestedReplies
    ) {}

    @JsonInclude(NON_NULL)
    public record SearchCriteria(
            List<String> keywords,
            @JsonProperty("user_names") List<String> userNames,
            @JsonProperty("date_range") DateRange dateRange,
            String sentiment,
            @JsonProperty("conversation_type") String conversationType
    ) {}

    @JsonInclude(NON_NULL)
    public record DateRange(String from, String to) {}

    @JsonInclude(NON_NULL)
    public record TaskListExtraction(
            @JsonProperty("tasks") List<TaskExtraction> tasks
    ) {}

    @JsonInclude(NON_NULL)
    public record TaskExtraction(
            @JsonProperty("task_title") String taskTitle,
            String description,
            @JsonProperty("date") String date,
            String priority,
            @JsonProperty("status") String status // "pending" | "done"
    ) {}

    @JsonInclude(NON_NULL)
    public record TypingSimulation(
            @JsonProperty("response_complexity") String responseComplexity,
            @JsonProperty("typing_duration_ms") int typingDurationMs
    ) {}
}
