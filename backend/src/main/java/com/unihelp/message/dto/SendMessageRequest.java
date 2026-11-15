package com.unihelp.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/conversations/{id}/messages} (FR-19: up to 1,000 characters). */
public record SendMessageRequest(
        @NotBlank @Size(max = 1000) String content) {
}
