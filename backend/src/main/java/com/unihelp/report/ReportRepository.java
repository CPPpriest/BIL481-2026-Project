package com.unihelp.report;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Each row is already unique per (post, reporter), so a row count is a unique-report count. */
public interface ReportRepository extends JpaRepository<Report, Long> {
    boolean existsByPostIdAndReporterId(Long postId, Long reporterId);

    /** Unique reports not yet reviewed by an administrator; compared with the FR-26 threshold. */
    long countByPostIdAndReviewedFalse(Long postId);

    List<Report> findByPostIdOrderByCreatedAtAsc(Long postId);
}
