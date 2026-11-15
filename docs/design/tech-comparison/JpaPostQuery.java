package comparison.jpa;

import com.unihelp.post.Post;
import com.unihelp.post.PostRepository;
import com.unihelp.post.PostStatus;
import com.unihelp.post.dto.PostSearchCriteria;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/** Documentation-only JPA/PostgreSQL alternative; not part of the application build. */
public final class JpaPostQuery {
    public static Page<Post> search(PostRepository repository, PostSearchCriteria input, int page) {
        PostStatus status = input.status() == null ? PostStatus.ACTIVE : input.status();
        if (status != PostStatus.ACTIVE && status != PostStatus.RESOLVED) {
            throw new IllegalArgumentException("Public search supports ACTIVE/RESOLVED only");
        }
        if (input.from() != null && input.to() != null && input.from().isAfter(input.to())) {
            throw new IllegalArgumentException("from must not exceed to");
        }
        Specification<Post> specification = (root, query, cb) -> {
            List<Predicate> filters = new ArrayList<>();
            filters.add(cb.equal(root.get("status"), status));
            if (input.keyword() != null && !input.keyword().isBlank()) {
                String escaped = input.keyword().toLowerCase(java.util.Locale.ROOT)
                        .replace("!", "!!").replace("%", "!%").replace("_", "!_");
                String pattern = "%" + escaped + "%";
                filters.add(cb.or(cb.like(cb.lower(root.get("title")), pattern, '!'),
                        cb.like(cb.lower(root.get("description")), pattern, '!')));
            }
            if (input.category() != null) filters.add(cb.equal(root.get("category"), input.category()));
            if (input.subtype() != null) filters.add(cb.equal(root.get("subtype"), input.subtype()));
            if (input.from() != null) filters.add(cb.greaterThanOrEqualTo(root.get("createdAt"), input.from()));
            if (input.to() != null) filters.add(cb.lessThanOrEqualTo(root.get("createdAt"), input.to()));
            return cb.and(filters.toArray(Predicate[]::new));
        };
        return repository.findAll(specification,
                PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
    }
}
