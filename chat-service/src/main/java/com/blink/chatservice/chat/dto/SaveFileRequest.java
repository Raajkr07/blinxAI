package com.blink.chatservice.chat.dto;

public record SaveFileRequest(
    String fileName,
    String content,
    String conversationId
) {}
