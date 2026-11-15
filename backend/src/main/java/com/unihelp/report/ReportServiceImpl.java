package com.unihelp.report;

import com.unihelp.report.dto.CreateReportRequest;
import com.unihelp.report.dto.ReportResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Wiring-only PA-2 stub; no operation writes data or claims to enforce business rules. */
@Service
public class ReportServiceImpl implements ReportService {
    private final ReportRepository reportRepository;

    public ReportServiceImpl(ReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    @Override
    public ReportResponse submitReport(Long postId, Long reporterId, CreateReportRequest request) {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "PA-2 stub; implementation in T3.9");
    }
}
