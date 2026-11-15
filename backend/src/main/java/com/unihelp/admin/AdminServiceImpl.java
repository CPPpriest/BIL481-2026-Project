package com.unihelp.admin;

import com.unihelp.admin.dto.AccountStatusDto;
import com.unihelp.admin.dto.ReportedPostDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Wiring-only PA-2 stub; no operation writes data or claims to enforce business rules. */
@Service
public class AdminServiceImpl implements AdminService {
    @Override
    public Page<ReportedPostDto> listReportedPosts(Pageable page) { throw pending(); }

    @Override
    public ReportedPostDto moderatePost(Long postId, ModerationAction action, Long adminId) { throw pending(); }

    @Override
    public AccountStatusDto setSuspension(Long userId, boolean suspended, Long adminId) { throw pending(); }

    private ResponseStatusException pending() {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "PA-2 stub; implementation in T3.10");
    }
}
