package com.blink.chatservice.ai.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class ToolRouterTest {

    private ToolRouter toolRouter;

    @BeforeEach
    void setUp() {
        toolRouter = new ToolRouter();
    }

    // -----------------------------------------------------------------------
    // Layer 1: Regex-based conversational detection
    // -----------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {
        "hi", "hello", "hey", "Hi!", "Hello?", "hey!",
        "thanks", "thank you", "thnx", "thx", "ty", "tysm",
        "ok", "okay", "okie", "k", "kk", "alright",
        "bye", "byee", "see you", "cya", "tc", "ttyl",
        "good morning", "good night", "gm", "gn",
        "yes", "yep", "yeah", "nope", "nah", "no",
        "haha", "hehe", "lol", "lmao", "cool", "nice", "awesome",
        "hmm", "hmmmm", "what can you do", "help",
        "how are you", "how r u", "hru", "sup", "what's up"
    })
    void layer1_regex_shouldDetectConversational(String msg) {
        assertTrue(toolRouter.isConversational(msg),
            "Should be conversational: [" + msg + "]");
    }

    // -----------------------------------------------------------------------
    // Layer 2+3: Short message heuristic + Levenshtein fuzzy matching
    // -----------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {
        "hlow",              // Regex Layer 1 match
        "hlow how are you",  // Compound greeting regex match
        "heloo",             // Regex Layer 1 match
        "thnks",             // Regex Layer 1 match
        "helo there",        // Compound greeting regex match
        "yo",                // 1 word, no intent → Layer 2 catches it
        "aight",             // Regex catches
        "ok fine",           // 2 words, no intent → Layer 2 catches it
    })
    void layer2and3_shouldDetectFuzzyConversational(String msg) {
        assertTrue(toolRouter.isConversational(msg),
            "Should be conversational (fuzzy): [" + msg + "]");
    }

    // -----------------------------------------------------------------------
    // Non-conversational messages (should NOT be caught)
    // -----------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {
        "send an email to john@example.com",
        "search for latest news about AI",
        "schedule a meeting tomorrow at 3pm",
        "extract tasks from my conversation with Baki",
        "summarize the conversation",
        "what is the weather today",
        "save this file to my desktop",
        "find information about quantum computing",
        "send a message to Alice saying hi",
        "read my calendar events for this week"
    })
    void shouldNotDetectAsConversational(String msg) {
        assertFalse(toolRouter.isConversational(msg),
            "Should NOT be conversational: [" + msg + "]");
    }

    // -----------------------------------------------------------------------
    // Intent detection
    // -----------------------------------------------------------------------

    @Test
    void detectIntents_email() {
        var intents = toolRouter.detectIntents("send an email to john");
        assertTrue(intents.contains(ToolRouter.Intent.EMAIL));
    }

    @Test
    void detectIntents_calendar() {
        var intents = toolRouter.detectIntents("schedule a meeting tomorrow");
        assertTrue(intents.contains(ToolRouter.Intent.CALENDAR));
    }

    @Test
    void detectIntents_search() {
        var intents = toolRouter.detectIntents("search on web for latest news");
        assertTrue(intents.contains(ToolRouter.Intent.SEARCH));
    }

    @Test
    void detectIntents_messaging() {
        var intents = toolRouter.detectIntents("send a message to Alice");
        assertTrue(intents.contains(ToolRouter.Intent.MESSAGING));
    }

    @Test
    void detectIntents_intelligence() {
        var intents = toolRouter.detectIntents("extract the tasks");
        assertTrue(intents.contains(ToolRouter.Intent.INTELLIGENCE));
    }

    @Test
    void detectIntents_empty() {
        assertTrue(toolRouter.detectIntents("").isEmpty());
        assertTrue(toolRouter.detectIntents(null).isEmpty());
    }

    // -----------------------------------------------------------------------
    // Levenshtein distance unit tests
    // -----------------------------------------------------------------------

    @Test
    void levenshtein_identical() {
        assertEquals(0, ToolRouter.levenshtein("hello", "hello"));
    }

    @Test
    void levenshtein_oneEdit() {
        assertEquals(1, ToolRouter.levenshtein("hello", "helo"));
        assertEquals(1, ToolRouter.levenshtein("hello", "heloo"));
    }

    @Test
    void levenshtein_twoEdits() {
        // hello → hlow is actually 3 edits (delete 'e', change 'l'→'o', change 'o'→'w')
        assertEquals(3, ToolRouter.levenshtein("hello", "hlow"));
        // hello → helo is 1 edit (delete one 'l')
        assertEquals(1, ToolRouter.levenshtein("hello", "helo"));
    }

    @Test
    void levenshtein_empty() {
        // Early termination: |5-0| > MAX_EDIT_DISTANCE → returns MAX_EDIT_DISTANCE + 1
        assertEquals(3, ToolRouter.levenshtein("hello", ""));
        assertEquals(0, ToolRouter.levenshtein("", ""));
    }
}
