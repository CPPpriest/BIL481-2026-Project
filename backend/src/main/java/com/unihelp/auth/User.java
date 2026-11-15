package com.unihelp.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Account record for FR-01–FR-05 and FR-28. Never serialize this entity as an API response.
 * email and passwordHash never leave the auth module; other modules receive only the
 * display alias through {@link UserQuery} (FR-04, FR-20, NFR-04).
 */
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Normalized (trimmed, lower-case) university e-mail address. */
    @Column(nullable = false, unique = true, length = 254)
    private String email;

    /** Salted BCrypt hash; the plain password is never stored or logged (NFR-02). */
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_alias", nullable = false, unique = true, length = 64)
    private String displayAlias;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AccountStatus status;

    /** Consecutive failed logins; reset to 0 by a successful login or when a lock expires. */
    @Column(name = "failed_login_attempts", nullable = false)
    private int failedAttempts;

    /** End of the 15-minute lock; null unless status is LOCKED. */
    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "notifications_enabled", nullable = false)
    private boolean notificationsEnabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected User() {
        // JPA
    }

    /** New self-registered student: PENDING until the e-mail address is verified (FR-03). */
    public User(String email, String passwordHash, String displayAlias) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayAlias = displayAlias;
        this.role = Role.STUDENT;
        this.status = AccountStatus.PENDING;
        this.failedAttempts = 0;
        this.notificationsEnabled = true;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayAlias() { return displayAlias; }
    public Role getRole() { return role; }
    public AccountStatus getStatus() { return status; }
    public int getFailedAttempts() { return failedAttempts; }
    public Instant getLockedUntil() { return lockedUntil; }
    public boolean isNotificationsEnabled() { return notificationsEnabled; }
    public Instant getCreatedAt() { return createdAt; }
}
