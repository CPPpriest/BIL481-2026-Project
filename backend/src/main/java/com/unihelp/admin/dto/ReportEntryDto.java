package com.unihelp.admin.dto;

import com.unihelp.report.ReportReason;
import java.time.Instant;

/** One report as shown to an administrator; the reporter appears by alias only. */
public record ReportEntryDto(Long reportId, ReportReason reason, String comment,
                             String reporterAlias, boolean reviewed, Instant createdAt) {
}
