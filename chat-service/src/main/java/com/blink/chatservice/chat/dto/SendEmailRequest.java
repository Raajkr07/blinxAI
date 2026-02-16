package com.blink.chatservice.chat.dto;

public record SendEmailRequest(
    String to,
    String subject,
    String body,
    String conversationId
) {}
