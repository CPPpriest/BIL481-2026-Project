package com.unihelp.auth;

/**
 * Account life cycle (Design Document §3.2.2).
 * PENDING until the 24-hour verification link is used (FR-03); LOCKED for 15 minutes after
 * 5 consecutive failed logins (FR-05); SUSPENDED by an administrator (FR-28).
 */
public enum AccountStatus {
    PENDING,
    ACTIVE,
    LOCKED,
    SUSPENDED
}
