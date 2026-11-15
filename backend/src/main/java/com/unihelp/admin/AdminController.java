package com.unihelp.admin;

import com.unihelp.admin.dto.AccountStatusDto;
import com.unihelp.admin.dto.ModeratePostRequest;
import com.unihelp.admin.dto.ReportedPostDto;
import com.unihelp.admin.dto.SuspensionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * ADMIN-only REST contract for UC4 (Design Document §2.3.4); PA-2 stubs only.
 * Spring Security restricts /api/admin/** to ROLE_ADMIN in T3.1.
 */
@RestController
@RequestMapping("/api/admin")
@Validated
public class AdminController {
    private final AdminService adminService;

    public AdminController(AdminService adminService) { this.adminService = adminService; }

    @GetMapping("/reports")
    public Page<ReportedPostDto> listReports(@RequestParam(value = "page", defaultValue = "0") @Min(0) int page) {
        currentAdminId();
        return adminService.listReportedPosts(PageRequest.of(page, 20));
    }

    /** RESTORE → 200 with the updated entry; REMOVE → 204. */
    @PatchMapping("/posts/{id}")
    public ResponseEntity<ReportedPostDto> moderatePost(@PathVariable("id") Long postId,
                                                        @Valid @RequestBody ModeratePostRequest request) {
        ReportedPostDto result = adminService.moderatePost(postId, request.action(), currentAdminId());
        return result == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(result);
    }

    @PatchMapping("/users/{id}/suspension")
    public AccountStatusDto setSuspension(@PathVariable("id") Long userId,
                                          @Valid @RequestBody SuspensionRequest request) {
        return adminService.setSuspension(userId, request.suspended(), currentAdminId());
    }

    /** The acting administrator comes from the security context, never from the body. */
    private Long currentAdminId() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Authentication integration pending (T3.1)");
    }
}
