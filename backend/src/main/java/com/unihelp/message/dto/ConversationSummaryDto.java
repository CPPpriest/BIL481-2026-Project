package com.unihelp.message.dto;

import java.time.Instant;

/** One row of {@code GET /api/conversations} (FR-21). */
public record ConversationSummaryDto(
        Long id,
        Long postId,
        String postTitle,
        String counterpartAlias,
        String lastMessagePreview,
        Instant lastMessageAt,
        long unreadCount) {
}
