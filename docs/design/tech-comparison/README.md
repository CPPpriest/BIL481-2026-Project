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

## Authentication: server-side session vs. JWT (Furkan)

Design Document §4.1.3 compares the two ways of keeping a UniHelp user logged in.

| Artifact | Approach | Use |
|---|---|---|
| [SessionAuthConfig.java](SessionAuthConfig.java) | Spring Security server-side session, stored with Spring Session JDBC in the existing PostgreSQL | Selected approach |
| [JwtAuthConfig.java](JwtAuthConfig.java) | Stateless JWT bearer token (Spring Security OAuth2 resource server, HS256) | Rejected alternative |

Both snippets protect the same routes: `POST /api/auth/register`, `POST /api/auth/login` and
`GET /api/auth/verify` are public, `/api/admin/**` needs the ADMIN role, everything else needs
an authenticated account. Both hash passwords with BCrypt; that part is identical and only
shown once.

What differs:

- **Logout / suspension (FR-05, FR-28).** The session version deletes the session on the server,
  so the cookie stops working on the next request; `SessionRevocation.revokeAll` ends every
  session of a suspended user. The JWT version cannot withdraw an issued token before `exp`
  without adding a server-side denylist, which removes its main advantage.
- **Inactivity timeout (FR-07).** A session has a sliding 60-minute idle timeout through one
  property. JWT needs short access tokens plus refresh-token rotation to get the same effect.
- **Browser storage.** The session id is an opaque HttpOnly cookie that JavaScript cannot read.
  A bearer token must be readable by the SPA, so an XSS bug can steal it. In exchange, the
  cookie version needs CSRF protection (`CookieCsrfTokenRepository`), the header version does not.
- **Privacy.** A JWT payload is only Base64-encoded; it must carry the user id, never the e-mail.

These are comparison source artifacts outside Maven's `src` roots; they are **not compiled by
`backend/mvn verify`** and add no dependency to the backend. The real `SecurityConfig` is
written in T3.1. No latency was measured; at the NFR-05/NFR-11 load (50 concurrent users,
one instance) the session look-up cost is not expected to matter, and the QA load test will
confirm it.
## Frontend framework: React vs. Vue (Taha)

Design Document §4.1.4 compares **React 18** and **Vue 3** on the same `PostCard` feed card (`PostCardDto` from §2.3.2: `id`, `title`, `descriptionSnippet`, `category`, `subtype`, `status`, `createdAt`, `authorAlias`).

| Artifact | Approach | Use |
|---|---|---|
| [PostCard.jsx](PostCard.jsx) | React 18 function component with JSX | Selected approach; aligns with `frontend/src/components/PostCard.jsx` |
| [PostCard.vue](PostCard.vue) | Vue 3 Single-File Component (`<script setup>`) | Rejected alternative; comparison artifact only |

Both components render post text strictly as escaped text nodes (supporting FR-13 XSS prevention), display only `authorAlias` (FR-14, FR-20, NFR-04), show a `Resolved` badge when `status === 'RESOLVED'` (FR-12), and expose `open` and `report` actions.

What differs:

- **Component contract & syntax.** React expresses props (`{ post, onOpen, onReport }`) and conditional rendering (`&&`) as plain JavaScript function parameters and expressions. Vue splits logic and markup across `<script setup>` compiler macros (`defineProps`, `defineEmits`) and custom template directives (`v-if`, `@click`).
- **Testing & PA-1 stack alignment.** PA-1 Project Definition §8.2 and QA Plan §1.2 standardize on React.js with React Testing Library (`frontend/`), avoiding Vue SFC compiler plugins (`@vitejs/plugin-vue`) and extra onboarding cost (Risk R1).

Neither file is imported by the production Vite bundle; `PostCard.vue` adds no Vue dependency to `frontend/package.json`.
