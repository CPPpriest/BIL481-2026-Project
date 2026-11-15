package com.unihelp.report.dto;

import com.unihelp.report.ReportReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** FR-25 input: required reason, optional comment. No reporter id is writable. */
public record CreateReportRequest(@NotNull ReportReason reason, @Size(max = 500) String comment) {
}
