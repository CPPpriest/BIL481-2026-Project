# UniHelp — Quality Assurance (QA) Plan

| | |
|---|---|
| **Course** | BIL 481 Software Engineering — Project Assignment 2 |
| **Project** | UniHelp — Campus Helping Platform |
| **Document** | Quality Assurance Plan |
| **Version** | 0.1 (draft) |
| **Due date** | 15-11-2026 |

## Contributors

<!-- TODO: Taha — finalize the contributors list (name, role, sections written) for the first page. -->

| Name | Role |
|---|---|
| Furkan Yılmaz | |
| Efe Deniz Kahvecioğlu | QA / Test Lead |
| Enis Talha Öztepe | |
| Muhammed Taha Kaya | |

## Table of Contents

<!-- TODO: Taha — finalize the table of contents after all sections are written. -->

1. [Quality Assurance Strategy](#1-quality-assurance-strategy)
   1. [Overview](#11-overview)
   2. [Testing Methodologies](#12-testing-methodologies)
   3. [Automated vs. Manual Testing](#13-automated-vs-manual-testing)
   4. [Continuous Integration](#14-continuous-integration)
2. [Quality Factors & Metrics](#2-quality-factors--metrics)
   1. [Performance](#21-performance)
   2. [Security](#22-security)
   3. [Usability](#23-usability)
   4. [Maintainability](#24-maintainability)
3. [Test Plan](#3-test-plan)
   1. [Test Cases](#31-test-cases)
   2. [Bug Tracking](#32-bug-tracking)
4. [Task Matrix](#task-matrix)

---

## 1. Quality Assurance Strategy

### 1.1 Overview

Quality assurance in UniHelp is continuous and requirement-driven:

- **Traceable.** Every test case refers to a use case (UC1–UC4) and to the requirement IDs (FR-xx, NFR-xx) of the Requirements Document. Every requirement in the Requirements Document has a “How it will be verified” method, and this plan turns those methods into concrete tests.
- **Shift-left.** Unit tests are written in the same sprint as the code they test (Project Plan T3.4, T3.6, T3.11); nothing is merged into `main` without passing CI and at least one review from another team member (NFR-10).
- **Test pyramid.** Most checks are fast automated unit tests on the service layer, a smaller set of integration and API tests covers the REST endpoints with a real database schema, and a few manual sessions cover usability, accessibility and cross-browser behaviour.
- **Risk-based.** Security and privacy (authentication, access control, e-mail privacy, message encryption) get the most test effort because they have the highest impact in the Project Plan risk table.
- **Release gate.** A release candidate (milestone M6, 03-01-2027) is accepted only when all automated tests pass, the four quality metrics in §2 meet their targets and there is no open critical/high bug (§3.2).

Roles: Efe (QA / Test Lead) owns this plan, unit/integration tests and the test report; Furkan leads security testing; Enis leads performance testing; Taha leads usability, accessibility and cross-browser testing (Project Plan §11).

### 1.2 Testing Methodologies

| Level / type | Technique and tools | Scope | Owner | Related requirements |
|---|---|---|---|---|
| Unit testing | **JUnit 5** + **Mockito**; repositories and collaborators are mocked; boundary-value and equivalence-class inputs (e.g. title 4/5/100/101 characters, message 1,000/1,001 characters) | Service-layer business rules of every module | Module owner, reviewed by Efe | NFR-10, all FRs |
| Integration testing | **Spring Boot Test** (`@SpringBootTest`, `@DataJpaTest`, MockMvc) with **H2** in PostgreSQL mode for fast runs and **Testcontainers** (PostgreSQL) for database-specific behaviour | Controller → service → repository → database; JPA mappings, queries, constraints | Efe | FR-01 – FR-28 |
| API testing | **Postman** collection (shared with the frontend) with assertions on status codes, response schemas and absence of personal data | All REST endpoints of the four use cases | Efe, Enis | FR-11, FR-19, FR-20, NFR-04 |
| Security testing | **OWASP ZAP** baseline scan; manual access-control tests (other user's post/conversation → 403); XSS and SQL injection payloads; HTTPS/TLS check | Whole application | Furkan | NFR-01, NFR-02, NFR-03, FR-13 |
| Performance testing | **k6** load scripts (50 concurrent users, seeded with 5,000 users / 20,000 posts) | Feed and search endpoints | Enis | NFR-05, NFR-11 |
| Usability testing | Moderated task-based sessions with at least 10 students (register, create a post, send a message) + short satisfaction survey | Main user flows | Taha | NFR-06 |
| Accessibility testing | **Lighthouse** audit and manual keyboard / screen-width checks (360–1920 px) | Main pages | Taha | NFR-07 |
| Cross-browser testing | Manual checklist on the latest two versions of Chrome, Firefox, Safari and Edge | Main user flows | Taha | NFR-08 |
| Frontend component testing | **React Testing Library** | Forms, validation messages, conditional UI (e.g. disabled “Send message” on Resolved posts) | Taha | FR-12, FR-17 |
| Static checks / code review | Pull-request review by another member; JaCoCo coverage and complexity report | Every change | All | NFR-10 |

### 1.3 Automated vs. Manual Testing

| Area | Automated | Manual | Reason |
|---|:-:|:-:|---|
| Service-layer business rules (validation, lockout, report threshold, permissions) | ✔ | | Deterministic, run on every PR |
| REST API contracts and status codes | ✔ (Spring Boot Test / MockMvc, Postman/Newman) | ✔ (exploratory with Postman) | Regressions must be caught automatically; exploratory testing finds missing cases |
| Database mappings, queries, constraints | ✔ (H2 / Testcontainers) | | Repeatable with a clean schema |
| E-mail privacy in API responses (FR-20, NFR-04) | ✔ (DTO unit test + API test, TC-04) | | Must never regress |
| Message encryption at rest (NFR-02) | ✔ (encrypt/decrypt unit tests) | ✔ (database inspection) | Inspection confirms no plain text is stored |
| E-mail verification / notification delivery | ✔ (mocked mail sender) | ✔ (real inbox on staging) | Delivery through the real SMTP provider can only be checked by hand |
| Security scan | ✔ (OWASP ZAP baseline) | ✔ (access-control and XSS attempts) | Tool finds common issues; logic flaws need a human |
| Performance | ✔ (k6 scripts) | | Load cannot be produced by hand |
| Usability | | ✔ | Requires real users and their judgement |
| Accessibility | ✔ (Lighthouse) | ✔ (keyboard, screen widths) | Lighthouse does not cover all WCAG 2.1 AA criteria |
| Cross-browser compatibility | | ✔ | Small number of browsers; manual checklist is cheaper |
| Scheduled jobs (archiving / deletion) | ✔ (job logic with a fixed clock) | | Time-based logic is tested by injecting the time |

### 1.4 Continuous Integration

- The GitHub Actions workflow `.github/workflows/ci.yml` runs on **every pull request** and on every push to `main`.
- It builds the backend with Java 21 and runs `mvn -B verify`, which compiles the code, runs all unit and integration tests and creates the JaCoCo coverage report (uploaded as the `jacoco-report` build artifact).
- A pull request can be merged only when the CI check is green and at least one other team member has approved it (branch protection on `main`, NFR-10).
- Frontend build and test steps are added to the workflow when the frontend views are implemented (Sprint 1).

---

## 2. Quality Factors & Metrics

| Quality factor | Description | Measurement metric | Target | Owner |
|---|---|---|---|---|
| Performance | Feed/search responsiveness under representative campus load | p95 HTTP response time per feed and search scenario, with 50 concurrent users and seeded data | p95 < 2,000 ms for each scenario; support 5,000 users / 20,000 posts | Enis |
| Security | Resistance to the OWASP Top 10 risks relevant to UniHelp (XSS, injection, broken authentication/access control) | (S1) number of **High**-risk alerts in the OWASP ZAP baseline scan; (S2) number of **open critical/high security bugs** | S1 = 0 and S2 = 0 before release (NFR-03) | Furkan |
| Usability | <!-- TODO: Taha --> | | | Taha |
| Maintainability | Ease of understanding, changing and testing the codebase | Service-layer line coverage (JaCoCo) and cyclomatic complexity per method | Coverage ≥ 70 %; complexity ≤ 10 per method | Efe |

### 2.1 Performance

**Related requirements:** NFR-05 (95% of feed/search responses under 2 seconds with 50 concurrent users), NFR-11 (5,000 registered users and 20,000 posts at that latency). Owner: Enis Talha Öztepe.

| Metric | Target / measurement | Tool |
|---|---|---|
| Feed response latency | `p(95) < 2000` ms for `GET /api/posts?page=...`, measured separately from search | k6 `http_req_duration` tagged `operation:feed` |
| Search response latency | `p(95) < 2000` ms for keyword and combined-filter requests, measured separately from feed | k6 `http_req_duration` tagged `operation:search` |
| Concurrent workload | 50 active, verified, authenticated users at steady load | k6 constant 50 VUs; not 50 requests total |
| Data volume | At least 5,000 registered users and 20,000 realistic posts, with related image/conversation/report metadata | Seeded PostgreSQL fixture; row counts recorded before run |
| Correct responses | Expected HTTP 200, correct status/filter matches, ≤ 20 records per page; unauthorized/errors cannot count as fast successes | k6 `check`, `checks: rate==1`, `http_req_failed: rate==0` on this controlled workload |

**Repeatable procedure (planned for T4.4):**

1. Deploy the implemented API against PostgreSQL with the same schema/indexes and resource limits as the test environment. Record commit SHA, server/DB versions, CPU/RAM, hosting tier, location and whether TLS is used. Run k6 on a separate machine; include authentication and network cost in observed API timing, not UI rendering.
2. Seed 5,000 users and 20,000 posts with mixed categories/subtypes, ACTIVE/RESOLVED/HIDDEN/ARCHIVED states and varied creation dates. Record distribution and row counts. Use common, rare and absent keywords; include punctuation as literal substring input. The default feed must never contain hidden/archived/resolved records.
3. Prepare 50 valid test sessions for verified active accounts (one per VU), outside the timed workload. Do not place session secrets in Git or published reports. Avoid session expiry during the measurement; it is tested separately.
4. Warm up for 1 minute. Then run a mixed feed/search workload for 5 minutes at constant 50 VUs with a short, fixed think time (1 second) between requests. Alternate feed pages (including a later page) and searches with keyword-only, category/subtype, date/status and combined filters. Tag each request as feed/search so one cannot mask the other. Run 3 times with unchanged fixtures/configuration.
5. Check correctness and `p(95) < 2000` separately for both endpoint tags in every steady-state run. Record counts, p50/p95/max, throughput, failed requests and assertion failures. Report any slow query or resource saturation and rerun after a recorded fix. Warm-up data is excluded from the acceptance summary.
6. Save the k6 script, seed description, environment manifest and machine-readable result summary with the test report. Capture no personal e-mail or credentials. If a free-tier instance sleeps, report the cold-start result separately and describe preconditioning; do not silently mix it into or remove it from the steady-state sample.

Example threshold configuration for the future load script:

```javascript
thresholds: {
  'http_req_duration{operation:feed}': ['p(95)<2000'],
  'http_req_duration{operation:search}': ['p(95)<2000'],
  http_req_failed: ['rate==0'],
  checks: ['rate==1'],
}
```

**Acceptance:** every measured run meets both p95 thresholds and all correctness checks with the required concurrency/data volume. These are API performance tests; browser page-loading and rendering can be observed separately. The PA-2 endpoints are stubs, so no load result or performance compliance is claimed at this stage.

### 2.2 Security

**Related requirements:** NFR-03 (protection against the relevant OWASP Top 10 risks; ZAP baseline with no high-risk alerts before release), supported by NFR-01, NFR-02, NFR-04, FR-01–FR-05, FR-11, FR-13 and FR-25–FR-28. Owner: Furkan Yılmaz (Project Plan T4.3).

| Metric | Definition | Target | Tool / how measured | When |
|---|---|---|---|---|
| S1 — ZAP high-risk alerts | Number of distinct alerts with risk **High** (`riskcode = 3`) in the OWASP ZAP baseline report of the release candidate | **0** | OWASP ZAP baseline scan (`zap-baseline.py`, official ZAP Docker image) against the HTTPS staging deployment; count read from the JSON report | End of every sprint from Sprint 1 (after T3.1), and as the release gate before M6 |
| S2 — Open critical/high security bugs | Number of open GitHub Issues with labels `bug` + `security` + (`severity:critical` or `severity:high`) | **0** | GitHub Issues query `is:issue is:open label:security label:"severity:critical"` and the same for `severity:high` (§3.2) | Weekly meeting; release gate before M6 |

**Procedure for S1:**

1. Deploy the release candidate to the staging environment over HTTPS, with seeded test accounts and data only (no real student data). Record commit SHA, ZAP version and target URL.
2. Run the baseline scan against the SPA and API base URLs: `zap-baseline.py -t <staging-url> -J zap-report.json -r zap-report.html`. The baseline scan spiders the site and applies passive rules; it does not attack the server.
3. Count alerts with `riskcode = 3`. Every High alert opens a `severity:high` (or `severity:critical`) issue with the `security` label. Medium alerts are also opened as issues and triaged; they do not block the release by themselves.
4. A High alert may be closed as a false positive only with a written reason in the issue, reviewed by a second team member. The ZAP rule is then marked as ignored in the committed rules file. False positives are never removed from the report silently.
5. Re-run the scan after fixes. S1 is met when the latest scan of the release candidate has 0 High alerts. Store both reports with the test report.

**Rule for S2:** every bug that breaks authentication, access control, e-mail privacy, encryption at rest or input sanitization gets the `security` label. Its severity follows §3.2; for example, an e-mail address in an API response is critical. The fix must include a regression test (§3.2 rules). S2 is counted with the GitHub query above; the release needs S2 = 0.

**Supporting security tests** (not metrics, but they find problems the passive scan cannot see):

| Check | Test | Requirement |
|---|---|---|
| Campus-only registration | TC-01 | FR-01 |
| Brute-force protection | TC-02 | FR-05 |
| Access control on other users' posts | TC-03 | FR-11, NFR-03 |
| No e-mail in responses | TC-04, `AuthDtoPrivacyTest` | FR-20, NFR-04 |
| Report abuse limits and moderation | TC-05 | FR-25, FR-26 |
| XSS / SQL injection payloads in post, report and message text; HTTP → HTTPS redirect and TLS ≥ 1.2; BCrypt hashes and message ciphertext in the database | Manual security session with Postman and database inspection (T4.3) | FR-13, NFR-01, NFR-02, NFR-03 |

The PA-2 endpoints are stubs, so no scan result or security compliance is claimed at this stage.

### 2.3 Usability

<!-- TODO: Taha -->

### 2.4 Maintainability

**Related requirement:** NFR-10 (layered architecture, ≥ 70 % service-layer test coverage, all code merged through reviewed pull requests).

| Metric | Definition | Target | Tool / how measured | When |
|---|---|---|---|---|
| M1 — Service-layer line coverage | Covered lines ÷ total lines of all `*Service*` classes in `com.unihelp.*` | **≥ 70 %** | JaCoCo report produced by `mvn verify` (`backend/target/site/jacoco/`), uploaded by CI | Every PR; checked in review from Sprint 1, enforced as a build rule before M6 |
| M2 — Cyclomatic complexity | McCabe cyclomatic complexity of each method (number of independent paths) | **≤ 10 per method** | JaCoCo “Cxty” counter per method in the same report | Every PR; a method above 10 must be refactored or justified in the PR |
| M3 — Reviewed merges | Share of commits on `main` that arrived through an approved pull request | **100 %** | GitHub branch protection and PR history | Continuous |

Interpretation:

- Coverage below 70 % on the service layer means business rules are not protected against regressions; the PR author adds tests before merge.
- High complexity makes code hard to test and review; keeping methods at or below 10 keeps each rule testable with a small number of cases.
- Layering is checked in review: controllers do not call repositories directly, and entities are not returned from controllers (DTOs only).

---

## 3. Test Plan

### 3.1 Test Cases

#### 3.1.1 Test Case Template

Every test case uses the following fields:

| Field | Description |
|---|---|
| **ID** | `TC-xx`, unique |
| **Title** | Short description of what is verified |
| **Related UC / FR** | Use case (UC1–UC4) and requirement IDs (FR-xx, NFR-xx) |
| **Preconditions** | System state and data needed before the test |
| **Steps** | Numbered actions |
| **Test Data** | Concrete input values |
| **Expected Result** | Observable result that decides pass/fail |
| **Type** | Auto (JUnit / Spring Boot Test / Postman / k6 / ZAP / Lighthouse) or Manual |
| **Owner** | Team member responsible for writing and running it |

#### TC-01 — Reject registration with a non-university e-mail address

| Field | Value |
|---|---|
| **ID** | TC-01 |
| **Title** | Registration with `@gmail.com` is rejected with the FR-01 message and creates no user record |
| **Related UC / FR** | UC1 · FR-01; NFR-03, NFR-04 |
| **Preconditions** | 1. `allowed_domains` contains only `etu.edu.tr`. 2. No user exists with any of the test e-mail addresses. 3. The mail sender is a mock that records calls. 4. Record the row counts of `users` and `verification_tokens`. |
| **Steps** | 1. Send `POST /api/auth/register` with the main test data. 2. Check the status code and the response body. 3. Query `users` for `ali.test@gmail.com` and compare both row counts with step 4 of the preconditions. 4. Check that the mail sender mock was not called. 5. Repeat steps 1–4 for each variant e-mail. 6. Positive control: register `tc01.student@etu.edu.tr` with the same password and check that it returns 201 and creates one PENDING user, so the rejection in steps 1–5 is caused by the domain only. 7. In the SPA, submit the register form with `ali.test@gmail.com` and check the message shown. |
| **Test Data** | Main: `{ "email": "ali.test@gmail.com", "password": "Secret123" }` (valid password, so only the domain is wrong). Variants: `Ali.Test@GMAIL.com`, `x@etu.edu.tr.gmail.com`, `x@mail.etu.edu.tr`, `x@gmail.com@etu.edu.tr` (invalid format → 400 from validation). Positive control: `tc01.student@etu.edu.tr` / `Secret123`. |
| **Expected Result** | 1. Every rejected request returns **HTTP 400** with the message **"A verified university e-mail address is required"** (the invalid-format variant may return the validation message instead). 2. No row with the test e-mail exists; the `users` and `verification_tokens` counts are unchanged after each rejected request. 3. No verification e-mail is sent. 4. The positive control returns 201 and creates exactly one PENDING user. 5. The SPA shows "A verified university e-mail address is required" at the e-mail field and stays on the register page. |
| **Type** | Auto — Spring Boot Test + MockMvc (H2, mocked mail sender) for steps 1–6; the same API assertions in the Postman collection; React Testing Library for step 7. Becomes executable with T3.1; the PA-2 stub returns 501. |
| **Owner** | Furkan Yılmaz |

#### TC-02 — Lock the account for 15 minutes after 5 failed logins

| Field | Value |
|---|---|
| **ID** | TC-02 |
| **Title** | After 5 consecutive failed logins the account is locked for 15 minutes, even for the correct password |
| **Related UC / FR** | UC1 · FR-05; NFR-03 (broken authentication) |
| **Preconditions** | 1. ACTIVE student `tc02.student@etu.edu.tr`, password `Secret123`, `failedAttempts = 0`, `lockedUntil = null`. 2. The application uses an injectable clock fixed at `2026-12-01T10:00:00Z` that the test can move forward. 3. No session exists for this user. |
| **Steps** | 1. Send `POST /api/auth/login` with the wrong password 4 times. 2. Send it with the wrong password a 5th time. 3. Immediately log in with the **correct** password. 4. Move the clock to 10:14:59 and log in with the correct password. 5. Move the clock to 10:15:00 and log in with the correct password. 6. Consecutive-count check: 4 wrong, 1 correct, then 4 wrong attempts. |
| **Test Data** | E-mail `tc02.student@etu.edu.tr`; wrong password `Wrong1234`; correct password `Secret123`; lock start 10:00:00Z, expected `lockedUntil` 10:15:00Z. |
| **Expected Result** | 1. Attempts 1–4 return **401** "Invalid e-mail or password"; `failedAttempts` is 1, 2, 3, 4; status stays ACTIVE. 2. Attempt 5 returns **423**; status LOCKED, `lockedUntil = 10:15:00Z`. 3. The correct password returns **423** and no session cookie. 4. At 10:14:59 still **423**. 5. At 10:15:00 **200** with the user's `AccountDto` and a session cookie; status ACTIVE, `failedAttempts = 0`, `lockedUntil = null`. 6. The account is not locked, because the correct login reset the counter; `failedAttempts = 4`. No response contains the password or its hash. |
| **Type** | Auto — Spring Boot Test + MockMvc with the injected clock (no real waiting), plus an `AuthService` unit test with Mockito for the counter rules; the API steps in Postman without step 4–5 timing. Becomes executable with T3.1. |
| **Owner** | Furkan Yılmaz |

#### TC-03 — Reject edits and deletion by another student

| Field | Value |
|---|---|
| **ID** | TC-03 |
| **Title** | A non-author cannot edit or delete another student's post |
| **Related UC / FR** | UC2 · FR-11; NFR-03 (access control) |
| **Preconditions** | Two distinct verified, active students A (alias `BlueOwl482`) and B (alias `GreenFox107`) have valid independent sessions. A owns ACTIVE post P=42 with one image and a related conversation/message. B is not an administrator. Record a DB snapshot of the post, image metadata, related conversation/messages, reports and their timestamps. |
| **Steps** | 1. As B, send `PUT /api/posts/42` with a valid multipart JSON `post` part and optional replacement JPEG. 2. Assert 403 and inspect the DB against the snapshot, including author/status/text/timestamps and image reference; verify no new stored image remains. 3. As B, send `DELETE /api/posts/42` and assert 403. 4. Compare DB and image storage against the same snapshot; confirm post and dependent records/files still exist and are unchanged. 5. As A, call `GET /api/posts/42` to verify the original detail remains visible. |
| **Test Data** | Original: category `LOST_FOUND`, subtype `LOST`, title `Lost blue umbrella`, description `Left near the library entrance.`, location `Library`, status `ACTIVE`. Attempted replacement: same valid category/subtype, title `Changed by another student`, description `Unauthorized edit attempt.`, location `Cafeteria`, valid JPEG below 5 MB. Use B's session with a valid CSRF token if session security requires it, so rejection tests ownership rather than malformed input or CSRF. |
| **Expected Result** | Both B requests return **HTTP 403 Forbidden** for the existing post. After each attempt, the original row, ownership, state, text, timestamps, image and related data remain unchanged; no image is replaced/deleted or orphaned. A's final detail read returns 200 and original content with only A's display alias. |
| **Type** | Auto — Spring Boot Test + MockMvc with real authentication and PostgreSQL fixture (Testcontainers) when T3.1/T3.2 are implemented; repeat endpoint assertions in Postman. Service-level test separately verifies rejection before any repository mutation or storage write. Not an implemented PA-2 test: stubs currently return 501. |
| **Owner** | Enis Talha Öztepe |

#### TC-04 — No e-mail address in conversation and message API responses

| Field | Value |
|---|---|
| **ID** | TC-04 |
| **Title** | Conversation and message API responses contain only display aliases, never an e-mail address |
| **Related UC / FR** | UC3 · FR-19, FR-20, NFR-04 |
| **Preconditions** | 1. Two verified, active students exist: **A** (`a.student@etu.edu.tr`, alias `BlueOwl482`) and **B** (`b.student@etu.edu.tr`, alias `GreenFox107`). 2. A has an Active post (id = P). 3. B is logged in and has a valid session. |
| **Steps** | 1. As B, call `POST /api/posts/{P}/conversations` with the test message. 2. Record the conversation id C from the response. 3. As B, call `POST /api/conversations/{C}/messages` with a second message. 4. As B, call `GET /api/conversations`. 5. Log in as A and call `GET /api/conversations`. 6. For every response body of steps 1–5, search all keys and values recursively. |
| **Test Data** | Message 1: `"Hi, I think I found your umbrella."` · Message 2: `"I can bring it to the library at 14:00."` · E-mail regex: `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` |
| **Expected Result** | 1. Steps 1 and 3 return `201 Created`; steps 4 and 5 return `200 OK`. 2. No JSON key contains `email` or `mail` (case-insensitive). 3. No JSON value matches the e-mail regex; in particular `a.student@etu.edu.tr` and `b.student@etu.edu.tr` do not appear. 4. The other participant is shown only by alias: B sees `counterpartAlias = "BlueOwl482"`, A sees `counterpartAlias = "GreenFox107"`; `senderAlias` in message responses is an alias. 5. No user id of the other participant's account or other personal contact data is returned beyond the alias. |
| **Type** | Auto — (a) unit: `MessageDtoPrivacyTest` checks that no response DTO has an e-mail field (already in CI); (b) integration: Spring Boot Test + MockMvc scenario above (Sprint 2); (c) API: same checks as assertions in the Postman collection |
| **Owner** | Efe Deniz Kahvecioğlu |

#### TC-05 — Hide a post after more than 3 unique reports and reject a duplicate report

| Field | Value |
|---|---|
| **ID** | TC-05 |
| **Title** | The 4th unique report hides the post, removes it from feed/search and raises an admin alert; a second report by the same student is rejected |
| **Related UC / FR** | UC4 · FR-25, FR-26; NFR-04 |
| **Preconditions** | 1. Verified, active student A (alias `BlueOwl482`) owns ACTIVE post P = 42, title `Lost blue umbrella`, with no reports. 2. Five other verified, active students R1–R5 and one administrator ADM have their own valid sessions and CSRF tokens. 3. R5 is used only to read the feed. |
| **Steps** | 1. R1, R2 and R3 each send `POST /api/posts/42/reports`. After each request, check the status of P in the database, and as R5 call `GET /api/posts` and `GET /api/posts?keyword=umbrella`. 2. R1 sends a second report for P. 3. Count the report rows of P in the database. 4. ADM calls `GET /api/admin/reports`. 5. R4 sends a report for P. 6. Check the status of P in the database. 7. As R5, call `GET /api/posts`, `GET /api/posts?keyword=umbrella` and `GET /api/posts/42`. 8. ADM calls `GET /api/admin/reports` again. |
| **Test Data** | R1: `FRAUD`, comment `Asks for a deposit before returning the item.` · R2: `SPAM` · R3: `OFFENSIVE_CONTENT` · R4: `OTHER`, comment `Same text posted many times.` · R1 duplicate: `SPAM`. |
| **Expected Result** | 1. Each of the first three reports returns **201**; P stays ACTIVE and appears in both feed and keyword search, so 3 reports do **not** hide the post. 2. The duplicate returns **409** with **"You have already reported this post."** 3. P has exactly 3 report rows. 4. P is listed with `openReportCount = 3`, `alert = false`. 5. R4's report returns **201**; the response contains no report count or hidden flag. 6. P is **HIDDEN**. 7. Post 42 is absent from the feed and from the keyword search; the detail read returns **404**. 8. P is the first entry with `status = HIDDEN`, `alert = true`, `openReportCount = 4` and 4 reports listed by reporter alias. No JSON key contains `email` and no value matches the e-mail regex of TC-04. |
| **Type** | Auto — Spring Boot Test + MockMvc against PostgreSQL (Testcontainers, needed for the row lock) when T3.9/T3.10 are implemented. Concurrency variant, run separately on a fresh post with 3 reports: two new students report at the same moment → exactly one HIDDEN transition, 5 report rows, no 500 error. The API steps are repeated in Postman; the step-2 message in the report dialog is checked with React Testing Library. Not an implemented PA-2 test: stubs return 501. |
| **Owner** | Furkan Yılmaz |

#### TC-06

<!-- TODO: owner to be assigned -->

### 3.2 Bug Tracking

**Tool.** Bugs are tracked as **GitHub Issues** in the project repository and shown on the GitHub Projects board, together with the development tasks.

**Reporting.** Anyone who finds a bug (team member, test user, course staff feedback) opens an issue with the **Bug report** template (`.github/ISSUE_TEMPLATE/bug_report.md`). The template asks for: summary, related UC / requirement / test case, environment, steps to reproduce, expected result, actual result, severity and attachments (screenshots, logs).

**Labels.** Every bug has the `bug` label and exactly one severity label:

| Label | Meaning | Example | Target fix time |
|---|---|---|---|
| `severity:critical` | Security/privacy breach, data loss, or the application cannot be used | E-mail address visible in an API response; login impossible for everyone | Immediately (same day) |
| `severity:high` | A Must requirement or a demo use case is broken, no workaround | Cannot start a conversation; reported post is not hidden after 4 reports | Within the current sprint (≤ 3 days) |
| `severity:medium` | Feature works incorrectly but a workaround exists | Wrong unread counter; filter combination ignored | Within the current or next sprint |
| `severity:low` | Cosmetic or minor issue | Typo, misaligned button | When capacity allows |

**Life cycle.**

```mermaid
stateDiagram-v2
    [*] --> Open: issue created with template, bug + severity labels
    Open --> InProgress: assignee set, branch created
    InProgress --> InReview: PR opened with "Fixes #id"
    InReview --> InProgress: review requests changes / CI fails
    InReview --> Closed: PR merged (issue closed automatically)
    Closed --> Open: bug reappears (reopened)
    Closed --> [*]
```

| State | Meaning | Who moves it |
|---|---|---|
| Open | Reported, triaged, severity set | Reporter; QA lead checks severity in the weekly meeting |
| In Progress | Assigned developer is working on it | Assignee |
| In Review | Fix is in a pull request | Assignee |
| Closed | Fix merged into `main` and verified by the reporter or QA lead | Automatic on merge |

**Rules.**

- The fix PR description contains `Fixes #<issue-id>` so that GitHub links the PR and closes the issue on merge.
- Every critical/high bug fix includes a regression test (unit, integration or API) that fails without the fix.
- **No release while a `severity:critical` or `severity:high` bug is open** (Project Plan objective 5, milestone M6).
- Open bugs per severity are reviewed in every weekly meeting and reported in the test report.

---

## Task Matrix

R = Responsible (wrote the section), C = Contributed / reviewed.

| Section / task | Furkan Yılmaz | Efe Deniz Kahvecioğlu | Enis Talha Öztepe | Muhammed Taha Kaya |
|---|:-:|:-:|:-:|:-:|
| Document skeleton and structure | | R | C | |
| Contributors list and Table of Contents | | | | |
| 1 QA Strategy (overview, methodologies, automated vs. manual, CI) | | R | C | |
| 2.1 Performance | | | R | |
| 2.2 Security | R | | | |
| 2.3 Usability | | | | |
| 2.4 Maintainability | | R | | |
| 3.1 Test case template | | R | C | |
| TC-01 | R | | | |
| TC-02 | R | | | |
| TC-03 | | | R | |
| TC-04 | | R | | |
| TC-05 | R | | | |
| TC-06 | | | | |
| 3.2 Bug Tracking (+ issue template) | | R | | |
