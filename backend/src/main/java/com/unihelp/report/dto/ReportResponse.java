package com.unihelp.report.dto;

import com.unihelp.report.ReportReason;
import java.time.Instant;

/**
 * Confirmation to the reporter. The current report count and hidden state are deliberately
 * not returned, so reporters cannot probe the moderation threshold.
 */
public record ReportResponse(Long reportId, Long postId, ReportReason reason, Instant createdAt) {
}
