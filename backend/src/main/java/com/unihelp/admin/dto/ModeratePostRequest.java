package com.unihelp.admin.dto;

import com.unihelp.admin.ModerationAction;
import jakarta.validation.constraints.NotNull;

/** Body of PATCH /api/admin/posts/{id}: {"action": "RESTORE" | "REMOVE"}. */
public record ModeratePostRequest(@NotNull ModerationAction action) {
}
