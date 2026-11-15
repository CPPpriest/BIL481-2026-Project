package com.unihelp.admin.dto;

import jakarta.validation.constraints.NotNull;

/** Body of PATCH /api/admin/users/{id}/suspension: {"suspended": true | false}. */
public record SuspensionRequest(@NotNull Boolean suspended) {
}
