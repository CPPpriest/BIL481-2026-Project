package com.unihelp.auth;

import com.unihelp.auth.dto.AccountDto;
import com.unihelp.auth.dto.LoginRequest;
import com.unihelp.auth.dto.MessageResponse;
import com.unihelp.auth.dto.RegisterRequest;
import java.time.Duration;

/**
 * PA-2 contract for UC1; business logic is implemented in T3.1.
 * <ul>
 *   <li>register: e-mail domain must be on the allowed-domain list, otherwise 400
 *       "A verified university e-mail address is required" and no user row (FR-01);
 *       password policy and duplicate e-mail check (FR-02); BCrypt hash (NFR-02);
 *       unique generated alias (FR-04); PENDING account and 24-hour verification link (FR-03).</li>
 *   <li>verify: single-use token, expires 24 hours after registration; PENDING → ACTIVE.</li>
 *   <li>login: PENDING/SUSPENDED accounts cannot log in; 5 consecutive failures lock the
 *       account for 15 minutes (FR-05, FR-28).</li>
 * </ul>
 * Responses expose the e-mail address only in the caller's own {@link AccountDto}.
 */
public interface AuthService extends UserQuery {
    /** Lock threshold and duration for FR-05. */
    int MAX_FAILED_ATTEMPTS = 5;
    Duration LOCK_DURATION = Duration.ofMinutes(15);
    /** Verification link lifetime for FR-03. */
    Duration VERIFICATION_TOKEN_TTL = Duration.ofHours(24);

    MessageResponse register(RegisterRequest request);

    MessageResponse verify(String token);

    /** Returns the authenticated user's own profile; the controller then creates the session. */
    AccountDto login(LoginRequest request);

    /** Own profile of the authenticated user. */
    AccountDto getOwnAccount(Long currentUserId);

    /** Called by the admin module (FR-28): SUSPENDED accounts cannot log in. */
    AccountStatus setSuspended(Long userId, boolean suspended);
}
