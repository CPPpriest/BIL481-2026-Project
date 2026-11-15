package com.unihelp.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/posts/{id}/conversations}: the first message to the author. */
public record StartConversationRequest(
        @NotBlank @Size(max = 1000) String content) {
}
