package com.unihelp.admin.dto;

import com.unihelp.post.PostStatus;
import java.util.List;

/**
 * Admin queue entry (FR-27). authorId is returned only on this ADMIN-only endpoint so that
 * the administrator can suspend the author; no e-mail is returned (NFR-04).
 * alert is true for a post that was auto-hidden and still has unreviewed reports (FR-26).
 */
public record ReportedPostDto(Long postId, String title, PostStatus status, Long authorId,
                              String authorAlias, long openReportCount, boolean alert,
                              List<ReportEntryDto> reports) {
}
