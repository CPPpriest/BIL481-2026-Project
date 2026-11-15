package com.unihelp.auth;

/**
 * Internal module boundary used by post, message, report and admin code.
 * It returns the public display alias only, never the e-mail address (FR-20, NFR-04).
 */
public interface UserQuery {
    String getDisplayAlias(Long userId);
}
