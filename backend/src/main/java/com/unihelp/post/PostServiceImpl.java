package com.unihelp.post;

import com.unihelp.post.dto.PostCardDto;
import com.unihelp.post.dto.PostDetailDto;
import com.unihelp.post.dto.PostSearchCriteria;
import com.unihelp.post.dto.PostWriteRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Wiring-only PA-2 stub; no operation writes data or claims to enforce business rules. */
@Service
public class PostServiceImpl implements PostService {
    @Override
    public PostDetailDto create(Long currentUserId, PostWriteRequest request, MultipartFile image) {
        throw pending();
    }
    @Override
    public PostDetailDto getDetail(Long postId, Long currentUserId) { throw pending(); }
    @Override
    public PostDetailDto update(Long postId, Long currentUserId, PostWriteRequest request, MultipartFile image) {
        throw pending();
    }
    @Override
    public void delete(Long postId, Long currentUserId) { throw pending(); }
    @Override
    public PostDetailDto resolve(Long postId, Long currentUserId) { throw pending(); }
    @Override
    public Page<PostCardDto> search(PostSearchCriteria criteria, Pageable page) { throw pending(); }
    @Override
    public PostSummary getPostSummary(Long postId) { throw pending(); }

    private ResponseStatusException pending() {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "PA-2 stub; implementation in T3.2/T3.5");
    }
}
