package com.unihelp.auth.dto;

import com.unihelp.auth.AccountStatus;
import com.unihelp.auth.Role;

/**
 * The caller's OWN profile (login response). This is the only response DTO that may carry
 * an e-mail address; it is never returned for another user (NFR-04).
 */
public record AccountDto(String email, String displayAlias, Role role, AccountStatus status,
                         boolean notificationsEnabled) {
}
