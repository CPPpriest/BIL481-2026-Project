package com.unihelp.report;

import com.unihelp.report.dto.CreateReportRequest;
import com.unihelp.report.dto.ReportResponse;

/**
 * PA-2 contract for the reporting part of UC4; business logic is implemented in T3.9.
 * In one transaction, under a lock on the post row:
 * <ol>
 *   <li>reject a reporter who already reported the post with 409
 *       "You have already reported this post." (FR-25);</li>
 *   <li>store the report and count the post's unreviewed unique reports;</li>
 *   <li>if count &gt; {@link #HIDE_THRESHOLD}, set the post HIDDEN through the post module
 *       and raise an admin alert (FR-26).</li>
 * </ol>
 */
public interface ReportService {
    /** A post is hidden when it has MORE than this many unique reports, i.e. on the 4th. */
    int HIDE_THRESHOLD = 3;

    ReportResponse submitReport(Long postId, Long reporterId, CreateReportRequest request);
}
