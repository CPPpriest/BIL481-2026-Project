package com.unihelp.admin;

import com.unihelp.admin.dto.AccountStatusDto;
import com.unihelp.admin.dto.ReportedPostDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * PA-2 contract for the administrator part of UC4 (FR-27, FR-28); implemented in T3.10.
 * Every method requires an ADMIN caller and repeats that check for non-HTTP callers.
 * adminId comes from the security context and is recorded in the audit log (FR-29).
 * Responses contain display aliases and ids only, never e-mail addresses (NFR-04).
 */
public interface AdminService {
    /** Reported and hidden posts with their reports; HIDDEN posts with open reports first. */
    Page<ReportedPostDto> listReportedPosts(Pageable page);

    /**
     * RESTORE: HIDDEN → ACTIVE and reports reviewed, returns the updated entry.
     * REMOVE: permanent deletion, returns null (controller answers 204).
     */
    ReportedPostDto moderatePost(Long postId, ModerationAction action, Long adminId);

    /** Suspends (ACTIVE/LOCKED → SUSPENDED) or unsuspends (SUSPENDED → ACTIVE) an account. */
    AccountStatusDto setSuspension(Long userId, boolean suspended, Long adminId);
}
