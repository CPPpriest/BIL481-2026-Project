package com.unihelp.message.dto;

import java.time.Instant;

/**
 * A decrypted message as returned to one of the participants.
 * The sender is identified by display alias only (FR-20).
 */
public record MessageDto(
        Long id,
        Long conversationId,
        String senderAlias,
        boolean sentByMe,
        String content,
        Instant sentAt) {
}
