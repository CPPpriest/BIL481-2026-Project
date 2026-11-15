package com.unihelp.post.dto;

import com.unihelp.post.PostCategory;
import com.unihelp.post.PostSubtype;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** JSON part named "post"; the optional image is a separate multipart part. */
public record PostWriteRequest(
        @NotNull PostCategory category,
        @NotNull PostSubtype subtype,
        @NotBlank @Size(min = 5, max = 100) String title,
        @NotNull @Size(max = 2000) String description,
        String locationText) {
}
