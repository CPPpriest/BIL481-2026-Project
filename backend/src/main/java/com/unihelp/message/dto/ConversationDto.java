package com.unihelp.message.dto;

import java.time.Instant;

/** Response of {@code POST /api/posts/{id}/conversations}. */
public record ConversationDto(
        Long id,
        Long postId,
        String postTitle,
        String counterpartAlias,
        Instant createdAt,
        MessageDto firstMessage) {
}
