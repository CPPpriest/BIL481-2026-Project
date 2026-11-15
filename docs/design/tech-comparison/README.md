# Technology Comparison Snippets

Design Document §4.1 compares PostgreSQL with MongoDB for the same PA-1 feed/search operation.

| Artifact | Approach | Use |
|---|---|---|
| [JpaPostQuery.java](JpaPostQuery.java) | Spring Data JPA specifications on PostgreSQL | Selected approach; uses the backend Post entity and PostRepository |
| [MongoPostQuery.java](MongoPostQuery.java) | Spring Data MongoDB / MongoTemplate | Rejected alternative; uses a document with the same query fields |

Both snippets accept `PostSearchCriteria` and a zero-based page: default ACTIVE, optional
category/subtype, inclusive UTC `from`/`to`, and literal case-insensitive substring matching
on title OR description. `%`, `_` and regex punctuation are treated as literal keyword
characters. Results are ordered by `createdAt DESC, id DESC`, with 20 records per page and
a total count. HIDDEN/ARCHIVED statuses and reversed date ranges are rejected in both.

Example input: `keyword=umbrella`, `category=LOST_FOUND`, `subtype=LOST`, `status=ACTIVE`,
`from=2026-11-01T00:00:00Z`, `to=2026-11-15T23:59:59Z`, `page=0`.
Expected logical predicate: ACTIVE AND LOST_FOUND AND LOST AND creation time in range
AND (title contains umbrella OR description contains umbrella), ignoring case.

These are comparison source artifacts, outside Maven's `src` roots; they are **not run by
`backend/mvn verify`**, benchmarks or a second production database. To experiment, copy
one into a separate Java 21 / Spring Boot project with the backend post types and either
`spring-boot-starter-data-jpa` + PostgreSQL or `spring-boot-starter-data-mongodb` + MongoDB.
Keep MongoDB dependencies out of the UniHelp backend. Map results to alias-only response
DTOs in either version; raw entities/documents are never returned by the real API.

The comparison is about relational integrity, query expression and operational cost;
no latency advantage has been measured. Substring queries can scan in either store and
must be checked against NFR-05/NFR-11 with the QA Plan workload. Unicode case behaviour
also depends on the database locale/collation and needs integration verification.
