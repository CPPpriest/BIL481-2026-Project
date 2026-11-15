package com.unihelp.post;

import com.unihelp.post.dto.PostCardDto;
import com.unihelp.post.dto.PostDetailDto;
import com.unihelp.post.dto.PostSearchCriteria;
import com.unihelp.post.dto.PostWriteRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** REST contract for UC2 and the feed/search part of UC3; PA-2 stubs only. */
@RestController
@RequestMapping("/api/posts")
@Validated
public class PostController {
    private final PostService postService;

    public PostController(PostService postService) { this.postService = postService; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostDetailDto create(@Valid @RequestPart("post") PostWriteRequest request,
                               @RequestPart(value = "image", required = false) MultipartFile image) {
        return postService.create(currentUserId(), request, image);
    }

    @GetMapping("/{id}")
    public PostDetailDto getDetail(@PathVariable("id") Long postId) {
        return postService.getDetail(postId, currentUserId());
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PostDetailDto update(@PathVariable("id") Long postId,
                               @Valid @RequestPart("post") PostWriteRequest request,
                               @RequestPart(value = "image", required = false) MultipartFile image) {
        return postService.update(postId, currentUserId(), request, image);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") Long postId) { postService.delete(postId, currentUserId()); }

    @PatchMapping("/{id}/resolve")
    public PostDetailDto resolve(@PathVariable("id") Long postId) {
        return postService.resolve(postId, currentUserId());
    }

    @GetMapping
    public Page<PostCardDto> search(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "category", required = false) PostCategory category,
            @RequestParam(value = "subtype", required = false) PostSubtype subtype,
            @RequestParam(value = "status", defaultValue = "ACTIVE") PostStatus status,
            @RequestParam(value = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(value = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(value = "page", defaultValue = "0") @Min(0) int page) {
        currentUserId(); // Replace with the auth boundary in Sprint 1; no anonymous reads.
        return postService.search(new PostSearchCriteria(keyword, category, subtype, status, from, to),
                PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
    }

    /** No caller-supplied author id is accepted; Furkan integrates the authenticated principal. */
    private Long currentUserId() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Authentication integration pending (T3.1)");
    }
}
