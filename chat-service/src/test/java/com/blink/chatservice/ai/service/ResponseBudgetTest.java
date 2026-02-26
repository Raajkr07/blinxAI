package com.blink.chatservice.ai.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ResponseBudgetTest {

    private ResponseBudget responseBudget;

    @BeforeEach
    void setUp() {
        responseBudget = new ResponseBudget();
    }

    @Test
    void conversational_shouldReturnConcise() {
        var tier = responseBudget.determine("hello", true, false);
        assertEquals(ResponseBudget.Tier.CONCISE, tier);
        assertEquals(200, tier.maxTokens());
    }

    @Test
    void detailedRequest_shouldReturnExtended() {
        var tier = responseBudget.determine("give me at least 500 words about AI", false, false);
        assertEquals(ResponseBudget.Tier.EXTENDED, tier);
        assertEquals(2000, tier.maxTokens());
    }

    @Test
    void detailedKeyword_shouldReturnExtended() {
        var tier = responseBudget.determine("explain in detail how quantum computing works", false, false);
        assertEquals(ResponseBudget.Tier.EXTENDED, tier);
    }

    @Test
    void withTools_shouldReturnDetailed() {
        var tier = responseBudget.determine("send an email to john", false, true);
        assertEquals(ResponseBudget.Tier.DETAILED, tier);
        assertEquals(1000, tier.maxTokens());
    }

    @Test
    void simpleQuestion_shouldReturnStandard() {
        var tier = responseBudget.determine("what is the capital of France", false, false);
        assertEquals(ResponseBudget.Tier.STANDARD, tier);
        assertEquals(500, tier.maxTokens());
    }

    @Test
    void normalChat_shouldReturnStandard() {
        var tier = responseBudget.determine("tell me a joke", false, false);
        assertEquals(ResponseBudget.Tier.STANDARD, tier);
    }

    @Test
    void nullMessage_shouldReturnStandard() {
        assertEquals(ResponseBudget.Tier.STANDARD, responseBudget.determine(null, false, false));
    }

    @Test
    void maxTokens_shorthand() {
        assertEquals(200, responseBudget.maxTokens("hi", true, false));
        assertEquals(2000, responseBudget.maxTokens("explain detailed", false, false));
        assertEquals(1000, responseBudget.maxTokens("search web", false, true));
    }
}
