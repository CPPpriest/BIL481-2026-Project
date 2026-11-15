package com.unihelp.post;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

/** Mapping/constraint checks only; business ownership and sanitization are still PA-2 contracts. */
@DataJpaTest
class PostPersistenceTest {
    @Autowired
    private TestEntityManager entityManager;
    @Autowired
    private PostRepository posts;

    @Test
    void persistedPostRetainsAuthorAndStringEnumValues() {
        Post post = posts.saveAndFlush(newPost());
        entityManager.clear();
        Post stored = posts.findById(post.getId()).orElseThrow();
        assertEquals(42L, stored.getAuthorId());
        assertEquals(PostCategory.LOST_FOUND, stored.getCategory());
        assertEquals(PostSubtype.LOST, stored.getSubtype());
        assertEquals(PostStatus.ACTIVE, stored.getStatus());
    }

    @Test
    void databaseRejectsASecondImageForTheSamePost() {
        Post post = posts.saveAndFlush(newPost());
        entityManager.persistAndFlush(new PostImage(post, "posts/one.jpg", "image/jpeg", 100));
        assertThrows(jakarta.persistence.PersistenceException.class, () ->
                entityManager.persistAndFlush(new PostImage(post, "posts/two.png", "image/png", 200)));
    }

    private Post newPost() {
        return new Post(42L, PostCategory.LOST_FOUND, PostSubtype.LOST,
                "Lost blue umbrella", "Left near the library entrance.", "Library");
    }
}
