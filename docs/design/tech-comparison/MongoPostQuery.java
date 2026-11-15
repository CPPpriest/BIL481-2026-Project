package comparison.mongo;

import com.unihelp.post.PostCategory;
import com.unihelp.post.PostStatus;
import com.unihelp.post.PostSubtype;
import com.unihelp.post.dto.PostSearchCriteria;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

/** Documentation-only Spring Data MongoDB alternative; no Mongo dependency is added to the backend. */
public final class MongoPostQuery {
    @Document("posts")
    public record PostDocument(@Id Long id, Long authorId, PostCategory category, PostSubtype subtype,
                               String title, String description, PostStatus status, Instant createdAt) { }

    public static Page<PostDocument> search(MongoTemplate mongo, PostSearchCriteria input, int page) {
        PostStatus status = input.status() == null ? PostStatus.ACTIVE : input.status();
        if (status != PostStatus.ACTIVE && status != PostStatus.RESOLVED) {
            throw new IllegalArgumentException("Public search supports ACTIVE/RESOLVED only");
        }
        if (input.from() != null && input.to() != null && input.from().isAfter(input.to())) {
            throw new IllegalArgumentException("from must not exceed to");
        }
        List<Criteria> filters = new ArrayList<>();
        filters.add(Criteria.where("status").is(status));
        if (input.keyword() != null && !input.keyword().isBlank()) {
            Pattern literal = Pattern.compile(Pattern.quote(input.keyword()),
                    Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            filters.add(new Criteria().orOperator(Criteria.where("title").regex(literal),
                    Criteria.where("description").regex(literal)));
        }
        if (input.category() != null) filters.add(Criteria.where("category").is(input.category()));
        if (input.subtype() != null) filters.add(Criteria.where("subtype").is(input.subtype()));
        if (input.from() != null) filters.add(Criteria.where("createdAt").gte(input.from()));
        if (input.to() != null) filters.add(Criteria.where("createdAt").lte(input.to()));
        Criteria combined = new Criteria().andOperator(filters.toArray(Criteria[]::new));
        long total = mongo.count(new Query(combined), PostDocument.class);
        PageRequest paging = PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        List<PostDocument> content = mongo.find(new Query(combined).with(paging), PostDocument.class);
        return new PageImpl<>(content, paging, total);
    }
}
