package com.unihelp.post;

import com.unihelp.post.dto.PostCardDto;
import com.unihelp.post.dto.PostDetailDto;
import com.unihelp.post.dto.PostSearchCriteria;
import com.unihelp.post.dto.PostWriteRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

/**
 * PA-2 contract; business logic is implemented in T3.2/T3.5.
 * All operations require a verified, active user from the security context.
 * Mutations sanitize all text (FR-13), validate category/subtype and image (FR-09/10).
 * Update/delete/resolve reject a non-author with HTTP 403 before writing (FR-11/12).
 * Public reads never expose HIDDEN/ARCHIVED posts; authors may read their own detail.
 * Responses expose authorAlias only, never authorId or e-mail (NFR-04).
 */
public interface PostService extends PostQuery {
    PostDetailDto create(Long currentUserId, PostWriteRequest request, MultipartFile image);
    PostDetailDto getDetail(Long postId, Long currentUserId);
    PostDetailDto update(Long postId, Long currentUserId, PostWriteRequest request, MultipartFile image);
    void delete(Long postId, Long currentUserId);
    PostDetailDto resolve(Long postId, Long currentUserId);

    /** ACTIVE by default; only ACTIVE/RESOLVED may be requested in the public feed. */
    Page<PostCardDto> search(PostSearchCriteria criteria, Pageable page);
}
