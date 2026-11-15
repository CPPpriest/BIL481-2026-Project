package com.unihelp.report;

import com.unihelp.report.dto.CreateReportRequest;
import com.unihelp.report.dto.ReportResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** REST contract for reporting a post (UC4, Design Document §2.3.4); PA-2 stub only. */
@RestController
public class ReportController {
    private final ReportService reportService;

    public ReportController(ReportService reportService) { this.reportService = reportService; }

    @PostMapping("/api/posts/{id}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public ReportResponse report(@PathVariable("id") Long postId,
                                 @Valid @RequestBody CreateReportRequest request) {
        return reportService.submitReport(postId, currentUserId(), request);
    }

    /** The reporter id comes from the security context, never from the request body. */
    private Long currentUserId() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Authentication integration pending (T3.1)");
    }
}
