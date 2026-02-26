package com.blink.chatservice.ai.service;

import com.blink.chatservice.mcp.registry.McpToolRegistry;
import com.blink.chatservice.mcp.tool.McpTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Intent-based tool router — only sends relevant tool schemas to the LLM
// based on what the user is asking about.
// Without this, every API call sends all 14 tool definitions (~1,500 tokens)
// even for simple messages like "hi" or "thanks".
// Conversational detection uses a 3-layer approach (industry pattern):
//   Layer 1 — Expanded regex with common abbreviations & typo variants
//   Layer 2 — Short-message heuristic (≤6 words + no intent keywords)
//   Layer 3 — Levenshtein fuzzy match (edit-distance ≤2 against known greetings)
@Slf4j
@Component
public class ToolRouter {

    public enum Intent {
        EMAIL,
        CALENDAR,
        MESSAGING,
        SEARCH,
        INTELLIGENCE,
        FILE
    }

    // Intent keyword patterns — compiled once at class load
    private static final Map<Intent, Pattern> INTENT_PATTERNS;
    static {
        int flags = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
        Map<Intent, Pattern> map = new EnumMap<>(Intent.class);
        map.put(Intent.EMAIL, Pattern.compile(
            "\\b(e-?mail|mail|inbox|gmail|compose|draft|reply.*mail|send.*mail|forward|yesterday|today|tomorrow|last|latest|recent)\\b", flags));
        map.put(Intent.CALENDAR, Pattern.compile(
            "\\b(calendar|event|schedule|meeting|appointment|remind|busy|free|slot|reschedule|update.*event|modify.*event|change.*time|move.*meeting|yesterday|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|week|month)\\b", flags));
        map.put(Intent.MESSAGING, Pattern.compile(
            "\\b(message|send.*to|chat.*with|conversation|tell\\s+(him|her|them)|dm|ping)\\b", flags));
        map.put(Intent.SEARCH, Pattern.compile(
            "\\b(search|find|look.*up|who\\s+is|google|web|latest|news|instagram|twitter|linkedin)\\b", flags));
        map.put(Intent.INTELLIGENCE, Pattern.compile(
            "\\b(summarize|summary|tasks?|extract|analyze|overview|recap)\\b", flags));
        map.put(Intent.FILE, Pattern.compile(
            "\\b(save|file|download|export|write.*to|note)\\b", flags));
        INTENT_PATTERNS = Collections.unmodifiableMap(map);
    }

    // Intent → tool name mapping
    private static final Map<Intent, Set<String>> INTENT_TOOLS;
    static {
        Map<Intent, Set<String>> map = new EnumMap<>(Intent.class);
        map.put(Intent.EMAIL, Set.of("send_email", "reply_email", "read_emails"));
        map.put(Intent.CALENDAR, Set.of("add_to_calendar", "read_calendar_events", "update_calendar_event", "delete_calendar_event"));
        map.put(Intent.MESSAGING, Set.of("send_message", "get_or_create_conversation",
            "view_conversation", "list_conversations", "search_user"));
        map.put(Intent.SEARCH, Set.of("web_search", "search_user"));
        map.put(Intent.INTELLIGENCE, Set.of("summarize_conversation", "extract_tasks", "view_conversation"));
        map.put(Intent.FILE, Set.of("save_file"));
        INTENT_TOOLS = Collections.unmodifiableMap(map);
    }

    // Layer 1 — Expanded conversational regex
    // Covers greetings, thanks, farewells, affirmations, common abbreviations,
    // and typical chat slang/misspellings.
    private static final Pattern CONVERSATIONAL = Pattern.compile(
        "^\\s*(" +
        // --- Compound: misspelled greeting + conversational tail ---
        "(h[eai]llo[w]?|hii+|hey+|hi+|hlow|hlw|helo|heloo+|yo+|howdy|hola)" +
            "\\s+(how\\s+(are|r)\\s+(you|u|ya)|there|buddy|bro|dude|friend|everyone|all|guys|man)" +
            "(\\s+.{0,20})?|" +
        // --- Standalone greetings & typos ---
        "h[eai]llo[w]?|hii+|hey+|hi+|hola|yo+|sup|wh?at'?s\\s*up|howdy|hlow|hlw|hlew|heloo+|helo|" +
        // How are you variants
        "how\\s+(are|r)\\s+(you|u|ya)|how'?s\\s+it\\s+going|hw\\s*r\\s*u|hru|how\\s*dy|" +
        // Good morning/night/evening
        "g(oo)?d\\s*(morning|mrng|night|nite|evening|evng|afternoon)|gm|gn|ge|gdm|" +
        // Thanks variants
        "thanks?|thank\\s*(you|u|yu)|thnx|thx|thn?ks|ty|tysm|" +
        // OK variants
        "ok(ay|ie|k)?|k+|alright|aight|ight|roger|copy|got\\s*it|noted|understood|" +
        // Bye variants
        "bye+|b+ye|bb|see\\s*(you|ya|u)|cya|tc|take\\s*care|later|gotta\\s*go|ttyl|" +
        // Affirmations / negations
        "yes|yep|yea+h?|ya+h?|yup|yass|sure|nope|nah+|no+|nay|" +
        // Laughter / reactions
        "ha(ha)+|he(he)+|lol|lmao|rofl|xd|nice|cool|great|awesome|wow|omg|" +
        // Filler / single-word acknowledgments
        "hmm+|hm+|ah+|oh+|ooh+|umm+|mhm+|uh\\s*huh|" +
        // Help / capabilities
        "what\\s+can\\s+you\\s+do|help|features" +
        ")\\s*[!?.,\\s]*$",
        Pattern.CASE_INSENSITIVE
    );

    // Max word count for the short-message heuristic (Layer 2)
    private static final int SHORT_MSG_MAX_WORDS = 6;

    // Known greeting stems for Levenshtein matching (Layer 3)
    private static final List<String> GREETING_STEMS = List.of(
        "hello", "hey", "hi", "thanks", "thank", "bye", "okay",
        "good", "morning", "evening", "night", "cool", "nice",
        "great", "awesome", "sup", "howdy", "hola", "yes", "no",
        "sure", "nope", "yeah", "lol"
    );

    // Max edit distance allowed for fuzzy greeting match
    private static final int MAX_EDIT_DISTANCE = 2;

    // ---------------------------------------------------------------------------
    // Public API

    // Detect which intents match a user message.
    public Set<Intent> detectIntents(String message) {
        if (message == null || message.isBlank()) return Collections.emptySet();
        Set<Intent> detected = EnumSet.noneOf(Intent.class);
        for (var entry : INTENT_PATTERNS.entrySet()) {
            if (entry.getValue().matcher(message).find()) {
                detected.add(entry.getKey());
            }
        }
        return detected;
    }

    // Multi-layer conversational check (industry pattern):
    //   Layer 1 — Regex match against expanded pattern
    //   Layer 2 — Short message (≤6 words) with no detected intents
    //   Layer 3 — First word is within edit-distance 2 of a known greeting
    public boolean isConversational(String message) {
        if (message == null || message.isBlank()) return false;
        String trimmed = message.trim();

        // Layer 1: Expanded regex (fast path for known patterns)
        if (CONVERSATIONAL.matcher(trimmed).matches()) {
            return true;
        }

        // Layer 2 + 3: Short message + no intent + fuzzy greeting check
        String[] words = trimmed.split("\\s+");
        if (words.length <= SHORT_MSG_MAX_WORDS && detectIntents(trimmed).isEmpty()) {
            // Check if first word fuzzy-matches a known greeting
            String firstWord = words[0].replaceAll("[^a-zA-Z]", "").toLowerCase();
            if (!firstWord.isEmpty() && matchesGreetingStem(firstWord)) {
                return true;
            }
            // Very short single words with no intent are almost always casual acknowledgments
            if (words.length <= 1) {
                return true;
            }
        }

        return false;
    }

    // Main entry point: return only the tools relevant to the user's message.
    public List<McpTool> route(String userMessage, McpToolRegistry registry) {
        // Pure greeting/thanks → skip tools entirely (saves ~1,500 tokens)
        if (isConversational(userMessage)) {
            log.debug("Conversational message detected, skipping all tools");
            return Collections.emptyList();
        }

        Set<Intent> intents = detectIntents(userMessage);

        // No specific intent → fallback to all tools (safety net)
        if (intents.isEmpty()) {
            log.debug("No specific intent detected, sending all tools");
            return new ArrayList<>(registry.all());
        }

        // Collect tool names from all matched intents
        Set<String> toolNames = intents.stream()
            .flatMap(intent -> INTENT_TOOLS.getOrDefault(intent, Collections.emptySet()).stream())
            .collect(Collectors.toCollection(LinkedHashSet::new));

        // search_user is cheap and often needed for context resolution
        if (intents.contains(Intent.MESSAGING) || intents.contains(Intent.INTELLIGENCE)) {
            toolNames.add("search_user");
        }

        List<McpTool> routed = toolNames.stream()
            .map(registry::get)
            .filter(Objects::nonNull)
            .toList();

        log.debug("Routed intents {} → {} tools: {}", intents, routed.size(), toolNames);
        return routed;
    }

    // Levenshtein fuzzy matching (Layer 3)
    private boolean matchesGreetingStem(String word) {
        for (String stem : GREETING_STEMS) {
            if (levenshtein(word, stem) <= MAX_EDIT_DISTANCE) {
                return true;
            }
        }
        return false;
    }

    // Standard Levenshtein distance — O(m*n) dynamic programming.
    // Only used on short words (≤15 chars), so perf is not a concern.
    static int levenshtein(String a, String b) {
        int m = a.length(), n = b.length();
        // Early termination: if length difference alone exceeds threshold, skip
        if (Math.abs(m - n) > MAX_EDIT_DISTANCE) return MAX_EDIT_DISTANCE + 1;
        int[] prev = new int[n + 1];
        int[] curr = new int[n + 1];
        for (int j = 0; j <= n; j++) prev[j] = j;
        for (int i = 1; i <= m; i++) {
            curr[0] = i;
            for (int j = 1; j <= n; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(Math.min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev; prev = curr; curr = tmp;
        }
        return prev[n];
    }
}
