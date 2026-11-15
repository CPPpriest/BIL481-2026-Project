package com.unihelp.admin.dto;

import com.unihelp.auth.AccountStatus;

/** Result of a suspension change; alias only, no e-mail (NFR-04). */
public record AccountStatusDto(Long userId, String displayAlias, AccountStatus status) {
}
