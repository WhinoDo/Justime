# ADR: Legacy Module Inventory — Compatibility / Deprecation Decisions

> **Date:** 2026-07-13
> **Status:** Proposed
> **Decision Makers:** 文档与配置管家 (agent 4d97c6a7)
> **Scope:** Repository inventory and lifecycle/security ownership decisions; no application or scanner changes
> **Base SHA:** 5410ddc4452c2f690cdaabd860d626bb879baacd (origin/dev)

---

## 1. Executive Summary

This ADR inventories six legacy module groups — **Study**, **Task Timing**, **Book Analysis**, **Review Schedule**, the **legacy Vue application**, and the **Desktop/Mobile surface apps** — to determine their real callers, whether they are superseded by TaskProcess, user-facing risk, and recommended disposition.

| Module | Observed Status | Proposed Disposition | Risk | Follow-up |
|---|---|---|---|---|
| Study (backend compat layer) | Shim over TaskProcess; reads/writes `study_profiles_compat` | **保留兼容层** until Phase 3 | Low | NEW ISSUE: Remove study compat endpoints |
| Study (frontend pages/hooks) | Isolated legacy surface; no cross-references from modern UIs; usage telemetry unknown | **废弃待清理** | Medium | NEW ISSUE: Remove study frontend |
| Task Timing | Actively called by `chat_business.py` | **保留并迁移** to Evidence time_log | Medium | NEW ISSUE: Task Timing → Evidence integration |
| Book Analysis | Partially integrated with TaskProcess; active, user-visible mobile workflow plus historical Web UI formerly stored in the removed `jushi_agent/` tree | **保留并迁移** to TaskProcess reading while preserving mobile parity | High | NEW ISSUE: Complete BookAnalysis integration |
| Review Schedule | Read-only on `review_schedules` collection; no write path found | **废弃待清理** | Low | NEW ISSUE: Remove review_schedules read path |
| `jushi_agent/` root directory | Removed from `dev` by JUS-516; it previously held 3 legacy source files with pre-rename branding | **已删除**; non-canonical and non-runnable; page parity is not a removal blocker | Low | JUS-516 / JUS-517 |
| `justime_agent_vue` | Preserved legacy/non-primary Vue application; current production build fails; no repository-managed release path found; repository-wide Trivy reports one blocking High finding | **保留并逻辑隔离** while the frontend/dependency-security maintenance lane owns compatibility and remediation; keep it in repository-wide scanning | High | NEW ISSUE: Repair Vue `form-data`; inventory deployment before decommissioning |
| `apps/desktop` (Electron) | Active production fallback | **保留** | Low | — |
| `apps/macos-native` (SwiftUI) | Phase 1 merged; Phase 2 pending | **保留** | Low | — |
| `mobile/jushi_mobile` | Active development; full Expo app; primary mobile codebase | **保留并迁移** to justime_mobile | Medium | NEW ISSUE: Migrate jushi_mobile → justime_mobile |
| `mobile/justime_mobile` | Minimal Expo scaffold | **保留** as migration target | Low | — |

---

## 2. Methodology

Read-only scans executed on fresh checkouts from `origin/dev`. The inventory was refreshed for the Vue ownership decision at SHA `5410ddc4452c2f690cdaabd860d626bb879baacd`:

```bash
# Backend module scan
rg -n "study|book_analysis|task_timing|review_schedule" \
  justime_backend/app --type py | head -150

# Frontend module scan
rg -n "study|book_analysis|task_timing|review_schedule" \
  justime_agent/src --type ts --type tsx | head -80

# File discovery
find . -path "*/study*" -type f | grep -v node_modules
find . -name "study_tools.py" -o -name "study_agent_business.py"
find . -path "*review_schedule*" -type f

# App surface verification
ls -la apps/desktop apps/macos-native mobile/
git log --oneline --all -- apps/desktop/ | head -10
git log --oneline --all -- apps/macos-native/ | head -10
git log --oneline --all -- mobile/jushi_mobile/ | head -10

# Historical jushi_agent evidence and current removal verification
git ls-tree -r --name-only 4bd7d628b529bb342c8bbe3cf2a43464093f1190 -- jushi_agent
git ls-files jushi_agent
test ! -e jushi_agent

# Active mobile Book Analysis callers
rg -n "book-analysis|bookAnalysisService|BOOK_ANALYSIS" mobile/jushi_mobile

# Legacy Vue routes, callers, and repository integration
find justime_agent_vue/src -type f | sort
rg -n "API_ENDPOINTS|createRouter|createApp" justime_agent_vue/src
rg -n "justime_agent_vue" .github deployment infrastructure apps docs
npm ls form-data --all --package-lock-only --prefix justime_agent_vue

# Repository security-scan scope and exact baseline finding
rg -n "scan-type|scan-ref|exit-code|severity" .github/workflows/ci.yml
gh run view 29218520965 --repo WhinoDo/Justime \
  --job 86719205007 --log-failed
```

**Limitations:** This scan is based on repository code-reference, import, route, CI, deployment, and commit-history analysis. It does not include runtime telemetry, external API caller logs, app-distribution data, or infrastructure outside this repository. Where the ADR notes "no callers found in the codebase" or "repository integration not found," external callers, deployments, third-party integrations, and direct URL/bookmark usage may still exist.

---

## 3. Module-by-Module Inventory

### 3.1 Study Module

#### 3.1.1 Backend — Compatibility Shim

**File:** `justime_backend/app/api/v1/endpoints/study.py`
**Route registration:** `justime_backend/app/api/v1/api.py:40` → `prefix="/study", tags=["学习兼容"]`

The study endpoint file header explicitly states: *"The old study-specific model has been folded into TaskProcess."* Every endpoint internally reads from `task_processes` via `_task_process_business` and re-shapes the response with `_task_to_study_task()` (line 26-46). The compatibility layer maps:

| Compat Endpoint | Underlying Implementation |
|---|---|
| `POST /study/profile` | Writes to `study_profiles_compat` MongoDB collection |
| `GET /study/profile` | Reads from `study_profiles_compat` |
| `POST /study/plan` | Creates TaskProcess with `category="learning"` |
| `GET /study/plan` | Lists TaskProcess filtered by learning categories |
| `GET /study/tasks` | Lists learning-categorized TaskProcesses |
| `PATCH /study/tasks/{id}` | Updates TaskProcess status |
| `GET /study/progress` | Aggregates TaskProcess stats |
| `POST /study/chat` | Delegates to `chat_business.process_chat()` |
| `GET /study/report/weekly` | Wraps progress stats |
| `GET /study/report/monthly` | Wraps progress stats |
| `POST /study/exam/analyze` | Returns **HTTP 410 Gone** — explicitly deprecated |
| `POST /study/sprint-plan` | Lists learning tasks |

**Evidence of deprecation readiness:** The `/study/exam/analyze` endpoint already returns 410, confirming intent to deprecate.

**Missing files referenced in `agent_service.py`:**
- `study_tools.py` — does not exist on disk. `agent_service.py:55` attempts `from app.tools.study_tools import ...` inside a try/except block; the except branch (line 65-74) provides no-op fallbacks. The import call is present but the module has been removed; the fallback code path is the active path.
- `study_agent_business.py` — does not exist on disk. Referenced in `docs/plans/2026-06-16-remaining-task-process-refactor-items.md` §4 as not yet decided, but the file has already been removed.

**MongoDB collections accessed:**
- `study_profiles_compat` (study.py:23, 67, 72, 78, 87) — write + read
- `study_profiles` (scheduler_service.py:74, 147) — read only
- `study_tasks` (scheduler_service.py:83) — read only
- `study_notebooks` (notebooklm_tools.py, exam_analysis_service.py) — write + read

#### 3.1.2 Frontend — Study Pages and Hooks

**Frontend files:**

| File | Purpose |
|---|---|
| `justime_agent/src/app/study/page.tsx` | 考研学习 main page (imports `useStudyProfile`, `useStudyTasks`, `useProgressStats`) |
| `justime_agent/src/app/api/study/[...path]/route.ts` | API proxy forwarding `/api/study/*` → backend `/study/*` |
| `justime_agent/src/components/study/DailyTasks.tsx` | Task list by day |
| `justime_agent/src/components/study/ProgressOverview.tsx` | Progress stats display |
| `justime_agent/src/components/study/QuickActions.tsx` | Quick action buttons |
| `justime_agent/src/components/study/StudyQuickCommands.tsx` | Quick command shortcuts |
| `justime_agent/src/components/study/StudyTimeline.tsx` | Timeline view |
| `justime_agent/src/hooks/useStudyPlan.ts` | `useStudyProfile()`, `useStudyPlan()`, `useStudyTasks()` |
| `justime_agent/src/hooks/useProgress.ts` | `useProgressStats()` |
| `justime_agent/src/types/study.ts` | TypeScript types: `StudyProfile`, `StudyPlan`, `StudyTask`, `ReviewSchedule`, `StudyMaterial`, `ProgressStats` |
| `justime_agent/src/lib/api/endpoints.ts:68-75` | `API_ENDPOINTS.STUDY.*` constant definitions |

**Code-reference analysis:** In the codebase, only `useStudyPlan.ts` and `useProgress.ts` hooks consume `API_ENDPOINTS.STUDY.*`. No other frontend module imports from `@/hooks/useStudyPlan` or `@/hooks/useProgress` except `study/page.tsx`. The study frontend is an isolated legacy surface with no cross-references from the modern task, chat, calendar, or knowledge UIs. However, usage telemetry is unknown — the page may still be accessed directly by users via URL or bookmarks.

#### 3.1.3 Disposition: Study

| Component | Proposed Decision | Rationale |
|---|---|---|
| Backend `/study` endpoints | **保留兼容层** (short-term) | External API callers (mobile, third-party) may depend on these. The shim is low-maintenance and correctly delegates to TaskProcess. |
| Frontend `/study` page + components | **废弃待清理** | Isolated legacy surface with no code-level cross-references from modern UIs. Usage telemetry unknown. Recommend confirming via access logs before removal. |
| `study_tools.py` import in agent_service | **废弃待清理** | Module already removed. The try/except import block with no-op fallbacks is the active code path. |
| `study_profiles_compat` MongoDB collection | **保留兼容层** (short-term) | Written by `/study/profile` endpoint. Clean up when study endpoints are removed. |
| `study_profiles`, `study_tasks` collections | **废弃待清理** | Only `scheduler_service.py` reads these for Feishu daily reminders. The reminder logic should migrate to TaskProcess queries. |
| `study_notebooks` collection | **保留** | Actively used by `notebooklm_tools.py` and `exam_analysis_service.py` for NotebookLM integration. Not study-legacy-specific. |

---

### 3.2 Task Timing Module

**Service:** `justime_backend/app/services/task_timing_service.py`
**Model:** `TaskTimingService` class, singleton `task_timing_service`
**MongoDB collections:** `task_timing_profiles`, `task_timing_events`

**Real callers (active):**

| Caller | File:Line | Method | Purpose |
|---|---|---|---|
| `chat_business.process_chat()` | `chat_business.py:14,239,330` | `resolve_strategy()` | Infer task type, difficulty, urgency from message; compute interaction duration, timeout, context window |
| `chat_business.process_chat()` | `chat_business.py:618,634` | `record_execution()` | Record chat execution duration and success/failure |

**What it does:** Given a chat message, it infers task type (recitation/thinking/general), difficulty level (1-5), and urgency (low/medium/high) using keyword-based heuristics. It then computes timing parameters: interaction duration, retry interval, max steps, timeout, and context window size. Results are persisted to `task_timing_profiles` and logged to `task_timing_events`.

**Overlap with TaskProcess Evidence:** The plans document (`docs/plans/2026-06-16-remaining-task-process-refactor-items.md` §1) states: *"task_timing 旧能力与 Evidence(type='time_log') 的彻底收口仍未完成"*. The timing service captures session-level execution metadata, while Evidence time_logs capture task-level time investment. They are complementary, not redundant.

**Proposed Decision:** **保留并迁移** — Task Timing is actively used by the chat pipeline and provides real value (dynamic timeout and context window sizing). The migration path is to evolve it into a TaskProcess-aware timing strategy that integrates with Evidence time_logs, rather than removing it.

**Risk:** The keyword-based inference is fragile for non-Chinese messages and may produce suboptimal timing for complex queries. This is an existing limitation, not a new risk from this inventory.

---

### 3.3 Book Analysis Module

**Endpoint:** `justime_backend/app/api/v1/endpoints/book_analysis.py`
**Service:** `justime_backend/app/services/book_analysis_service.py` (1045 lines)
**Model:** `justime_backend/app/models/book_analysis.py`
**Route registration:** `api.py:38` → `prefix="/book-analysis", tags=["书籍分析"]`
**Test:** `justime_backend/tests/services/test_book_analysis_service.py`

**What it does:** Accepts PDF uploads, extracts chapters via PyMuPDF, creates a NotebookLM notebook, uploads each chapter as a source, asks NotebookLM to analyze each chapter, and generates an HTML reader with structured analysis (summary, key points, arguments, examples, evidence, open questions).

**Integration with TaskProcess (partial):**
- `book_analysis_service.py:116-127` — On project creation, automatically creates a `category="reading"` TaskProcess
- `book_analysis_service.py:140-144` — Maps detected chapters as TaskProcess milestones
- `book_analysis_service.py:260-271` — On analysis start, updates TaskProcess to `status="active", phase="during"`
- `book_analysis_service.py:424-461` — On chapter completion, marks milestone done and creates Evidence (type="note", source="book_analysis")
- `book_analysis_service.py:481-493` — On project completion, updates TaskProcess to `status="completed", phase="after"`
- `book_analysis_service.py:503-515` — On failure, updates TaskProcess to `status="blocked"`

**Web frontend presence:** No page for Book Analysis exists in `justime_agent/src/app/`. A historical page formerly existed at `jushi_agent/src/app/book-analysis/page.tsx` (pre-rename codebase with "聚时" branding), but JUS-516 removed that legacy tree without migrating its pages. The absence of a current Next.js Book Analysis page is a separate product gap and did not block removal of `jushi_agent/`.

**Active mobile callers and user entry:**
- `mobile/jushi_mobile/app/_layout.tsx:51-52` registers the Book Analysis list and detail routes.
- `mobile/jushi_mobile/app/(tabs)/profile.tsx:472-480` exposes a visible "书籍分析" button; line 477 navigates to `/book-analysis/index`.
- `mobile/jushi_mobile/app/book-analysis/index.tsx:24,111,182,238,270,526` imports the service and supports listing projects, PDF project creation, chapter updates, analysis start, and detail navigation.
- `mobile/jushi_mobile/app/book-analysis/[id].tsx:21,93-104` imports the service and loads a project detail view.
- `mobile/jushi_mobile/services/bookAnalysisService.ts:14-128` calls list, detail, status, create, chapter-update, and run APIs.
- `mobile/jushi_mobile/constants/api-endpoints.ts:40-45` maps those calls to `/api/v1/book-analysis/projects*`.
- Commit `869a233` introduced the mobile Book Analysis workflow, including its navigation, screens, service, and types.

**Observed status:** Book Analysis is an active, user-visible mobile workflow, not a backend-only feature or a frontend that depended on the now-removed `jushi_agent` tree. The current Next.js Web app lacks parity, but `mobile/jushi_mobile` already exercises the complete project lifecycle.

**Proposed Decision:** **保留并迁移** — Complete the TaskProcess integration (per plans doc §1: *"BookAnalysis -> category='reading' 的任务化收口仍未完成"*) and preserve the active mobile route/service/API contract during the `jushi_mobile` to `justime_mobile` migration. `mobile/jushi_mobile` must not be deprecated until the target mobile application passes Book Analysis list, upload, chapter-edit, run, status, and detail parity checks. Any future Web implementation should be specified independently and must not restore or migrate files from the removed `jushi_agent/` tree as part of this ADR.

**Risk:** High. Removing or changing Book Analysis without mobile parity would break a visible profile workflow and its persisted projects. The backend also depends on NotebookLM CLI (`notebooklm-py`), which requires Google authentication. The `_validate_runtime_dependencies()` method (line 958-968) checks for CLI and auth at runtime; NotebookLM contract changes remain an operational risk.

---

### 3.4 Review Schedule

**MongoDB collection:** `review_schedules`
**Write paths:** None found in the current codebase. No endpoint creates review schedule documents.
**Read paths:**
- `scheduler_service.py:136` — Queries `review_schedules` for due reviews in `send_review_reminder()`
- `scheduler_service.py:152` — Queries pending reviews per user

**Agent service references:** `agent_service.py` maps `"review_scheduled"` observation type to `"schedule_review"` tool name (lines 598, 657, 673, 708, 724). However, `study_tools.py` (which would have contained `schedule_review`) no longer exists.

**Frontend types:** `ReviewSchedule` interface defined in `justime_agent/src/types/study.ts` but not imported or used anywhere else in the frontend.

**Observed evidence:** The `review_schedules` collection has no active write path in the scanned codebase. The read path in `scheduler_service.py` queries a collection that, based on code analysis, nothing populates. However, documents may have been created by previous code versions or external processes; runtime collection contents were not inspected.

**Proposed Decision:** **废弃待清理** — No active write path found; the read path appears to be orphaned. The SM-2 spaced repetition mechanism was planned (plans doc §1: *"ReviewSchedule -> KnowledgeOutput 的复习维度和 SM-2 机制仍未实现"*) but never implemented.

**Risk:** Low. The scheduler's `send_review_reminder()` will silently find no documents and do nothing if the collection is empty. If legacy documents exist, the reminder logic still functions but references outdated data.

**Follow-up:** Implement the planned SM-2 review scheduling as a new feature under the TaskProcess / KnowledgeOutput model, not as a revival of the legacy `review_schedules` collection.

---

### 3.5 Root Legacy Web Surface (`jushi_agent`)

**Observed evidence:** At the ADR baseline, the root directory contained only three tracked source files: `src/app/page.tsx`, `src/app/book-analysis/page.tsx`, and `src/components/auth/AuthPageShell.tsx`. They retained pre-rename "聚时" branding and were never the canonical `justime_agent` application. JUS-516 removed all three files and the resulting empty root directory from `dev` in Reviewer merge `e12aaf461230fa83fa1055c1050f90ebdb978d9e`; `git ls-files jushi_agent` is now empty and the path does not exist. The Book Analysis page remains historical evidence of an earlier Web workflow; active Book Analysis callers are independently present in `mobile/jushi_mobile` as documented in section 3.3.

**Authoritative disposition:** **Removed, non-canonical, and non-runnable.** JUS-516 completed the approved removal tracked by JUS-515. Missing Book Analysis, authentication, or Home parity in `justime_agent` remains an independent product gap; those gaps did not block removal and this ADR does not migrate or restore the historical pages. The only formal Web frontend is `justime_agent/`.

**Risk:** Low. JUS-516 independently verified that `justime_agent` had no runtime dependency on the removed tree: lint, all 554 Jest tests, and the production build passed before and after the deletion-only merge. Any future work on missing Web pages must be tracked as product development against `justime_agent/`, not as restoration of `jushi_agent/`.

---

### 3.6 Legacy Vue Application (`justime_agent_vue`)

**Application and build evidence:**
- `justime_agent_vue/package.json:7-10` defines Vite development, type-checked production build, preview, and lint scripts.
- `justime_agent_vue/package.json:13-16` identifies Vue 3, Vue Router, Pinia, and Axios as runtime dependencies.
- `justime_agent_vue/src/main.ts:1-12` creates the Vue application, installs Pinia and the router, and mounts it to `#app`.
- `justime_agent_vue/src/App.vue:1-7` renders the active route through `RouterView`.
- `npm ci` succeeds, but `npm run build` fails during `vue-tsc` with eight unused-symbol errors in admin components/pages, registration, and the router. The current tree is therefore not release-build clean.

**Routes and user-visible surfaces:** `justime_agent_vue/src/router/index.ts:6-66` declares public home, login, and registration routes; an authenticated dashboard; an authenticated, admin-only layout with dashboard, users, models, API keys, and settings children; and a catch-all not-found page. The guard at lines 69-91 checks authentication and admin role before protected navigation.

**API callers:**
- `justime_agent_vue/src/stores/auth.ts:22-99` calls the auth status, refresh, login, and logout endpoints with cookies.
- `justime_agent_vue/src/stores/admin.ts:45-285` calls user, model, API-key, and statistics endpoints for the admin pages.
- `justime_agent_vue/src/api/endpoints.ts:1-75` also defines chat, calendar, documents, knowledge, Book Analysis, and speech endpoint constants. Definitions alone do not prove that each feature has a routed Vue page.

**CI, deployment, and activity evidence:**
- Commit `3392781` recently changed Vue package metadata, knowledge endpoint constants, admin components, and degraded-state types. The application therefore has recent source activity and must not be classified as dead solely from its legacy stack.
- `.github/workflows/ci.yml:59-113` installs, lints, type-checks, tests, and builds `justime_agent`; it does not run a `justime_agent_vue` job.
- `.github/workflows/ci.yml:174-204` runs Trivy as a filesystem scan with `scan-ref: '.'`, `exit-code: '1'`, and `CRITICAL,HIGH` severity. Unlike the Web build jobs, this security gate covers tracked dependency locks across the checkout, including `justime_agent_vue/package-lock.json`.
- `.github/workflows/deploy.yml:66-83` builds images from `justime_agent` and `justime_backend` only.
- `deployment/homelab/docker-compose.yml:48-60` builds the production frontend from `justime_agent`.
- Outside this inventory, no `justime_agent_vue` build, deployment, or runtime integration reference was found under `.github`, `deployment`, `infrastructure`, `apps`, or `docs`. This proves only that repository-managed integration was not found; external deployment and runtime usage remain unknown.

**Security finding evidence:** GitHub Actions run [`29218520965`](https://github.com/WhinoDo/Justime/actions/runs/29218520965), Security Scan job `86719205007`, scanned baseline `5410ddc4452c2f690cdaabd860d626bb879baacd`. Trivy attributed exactly one finding to `justime_agent_vue/package-lock.json`: `form-data` `CVE-2026-12143`, severity High, installed version `4.0.5`, with fixed versions `2.5.6`, `3.0.5`, and `4.0.6`. The lockfile resolves `axios@1.16.1 -> form-data@4.0.5`, which is also confirmed by `npm ls form-data --all --package-lock-only`. This Trivy result is the repository security-gate evidence; the separate `npm ci` audit totals are not used to classify this finding.

**Observed status:** A Vue 3/Vite application with concrete auth, dashboard, and admin routes exists and has recent commits, but its current production build fails type checking. It has no proven repository-managed release/deployment path and is therefore a **preserved legacy, non-primary surface**, not an established active release surface. Runtime telemetry and external hosting remain unknown. Its tracked lockfile is still inside the repository security boundary.

**Accountable ownership:** While `justime_agent_vue` remains tracked, the **Justime frontend/dependency-security maintenance lane** owns Vue compatibility, lockfile hygiene, vulnerability triage, and remediation. Repository CI/security maintainers own continued enforcement of the whole-tree Trivy gate. Architecture/docs maintainers own this lifecycle decision and its evidence, but do not own package repair. Absence from the primary Web build/deploy jobs does not remove maintenance accountability.

**Decision:** **保留并逻辑隔离 (preserve and logically isolate).** Freeze new feature work except compatibility and security maintenance, identify any external deployment and traffic, compare routed auth/dashboard/admin capabilities with `justime_agent`, and migrate any missing behavior before archival. **Logical lifecycle isolation does not mean security scan exclusion.** The repository-wide Trivy scan remains responsible for every tracked Vue dependency lock until an approved removal or security-responsibility transfer satisfies the gates below.

**Current vulnerability disposition:** `CVE-2026-12143` remains visible and CI-blocking; this ADR grants no ignore, severity downgrade, scanner exclusion, or risk acceptance. A separate implementation issue must update only `justime_agent_vue/package.json` if dependency resolution requires it and `justime_agent_vue/package-lock.json`, then verify that the resolved dependency path uses `form-data >= 4.0.6`, report install and production-build status, and run targeted plus repository-wide Trivy checks. Existing unrelated build failures must be reported accurately and must not be concealed by the dependency repair.

**Removal gates:**
1. Inventory the accountable owner and every deployed Vue URL/environment, or document independently reviewable evidence that no deployment exists.
2. Collect traffic/usage telemetry for an approved observation period; migrate and notify any remaining users before shutdown.
3. Verify `justime_agent` parity for every routed Vue surface and required auth/admin API flow, with regression coverage for migrated behavior.
4. Define an archive/removal and rollback plan that preserves history, deployment findings, and recovery instructions.
5. Obtain approval and execute deletion only through a dedicated implementation issue with explicit file scope and verification.

**Future scan-isolation gates:** Scan isolation is stricter than lifecycle isolation. Repository-wide scanning must continue unless either (a) the Vue tree is removed through the approved deletion path above, or (b) it is moved to a separately governed repository/archive with a named owner and its own blocking dependency scanner. Before responsibility can transfer, evidence must show that no Justime release or deployment artifact consumes the moved tree, the destination scanner and owner must be documented, and the transfer must be independently verified. Merely labeling the tree legacy, non-primary, frozen, or logically isolated is insufficient.

**Risk:** High while the fixed High vulnerability remains in the tracked lockfile and blocks the repository security gate. Immediate deletion could also remove an externally deployed admin/auth surface that repository-only analysis cannot see. After remediation, indefinite retention without a Vue build gate still permits compatibility and API drift, so ownership and removal evidence remain required.

---

### 3.7 Desktop & Mobile Surface Apps

#### 3.7.1 `apps/desktop` (Electron)

**Status:** Active production fallback.
**Recent commits:** 3 commits, most recent `dcecb4c feat(desktop): extract URL policy into testable module`.
**Architecture:** Minimal Electron shell loading the Next.js frontend URL. Does not duplicate business logic.
**ADR reference:** `docs/architecture/2026-06-26-macos-native-migration.md` explicitly keeps Electron as fallback until macOS native passes all release gates.

**Proposed Decision:** **保留** as the production fallback. Electron removal is allowed only when all of these gates pass:
1. The native signed application has been in production for at least two release cycles.
2. Native acceptance gates pass for authentication, SSE, task workspace, signing/notarization, and auto-update.
3. A tested rollback runbook can republish the Electron DMG within 24 hours after a native blocker is found.
4. User telemetry shows Electron below 5% of macOS desktop sessions.
5. `apps/desktop` is archived with its history and rollback instructions rather than silently deleted.

**Native replacement sequence:** Complete the native capability gates, ship and observe two signed native release cycles, validate the 24-hour fallback procedure, verify the telemetry threshold, then archive Electron in the dedicated location defined by `docs/architecture/2026-06-26-macos-native-migration.md:134-146`. Until every gate passes, Electron remains supported for fallback and macOS versions below the native target.

#### 3.7.2 `apps/macos-native` (SwiftUI)

**Status:** Phase 1 merged on dev. Phase 2 (native SwiftUI screens) pending.
**Recent commits:** 12 commits, most recent `ac6daeb fix(macos-native): restore swift build/test gate`.
**Build:** `swift build && swift test` (requires macOS 13+, Swift 5.9+).

**Proposed Decision:** **保留** — This is the target platform. Phase 2A-2D child issues are tracked separately.

#### 3.7.3 `mobile/jushi_mobile`

**Status:** Active development. Full Expo/React Native app with chat, calendar, auth, book analysis, SSE streaming, and cloud RAG sync.
**Recent commits:** 10 commits, most recent `fdd04d0 feat(mobile): cloud RAG sync semantics and degradation handling for knowledge settings`.
**Contains:** Complete mobile application — this is currently the primary mobile codebase.

**Proposed Decision:** **保留并迁移** — This is the active mobile codebase and should continue development until `mobile/justime_mobile` reaches feature parity. The rename from Jushi to Justime was completed in code (commit `e423152`) but the directory name persists.

**Exit criteria for migration completion:**
1. `mobile/justime_mobile` reaches feature parity with `jushi_mobile` (chat, calendar, auth, book analysis, SSE, RAG sync)
2. CI/CD pipeline for `justime_mobile` is operational
3. `justime_mobile` passes integration smoke tests on iOS and Android
4. All active development branches rebased onto `justime_mobile`
5. `jushi_mobile` archived with a final deprecation notice in its README

**Risk:** Medium. While both mobile directories exist, active development splits effort. The `justime_mobile` scaffold needs significant investment to reach parity.

#### 3.7.4 `mobile/justime_mobile`

**Status:** Minimal Expo scaffold.
**Contents:** `android/`, `expo-env.d.ts` — minimal setup.
**Recent commits:** 2 commits, most recent `24fd60d chore(mobile): track .env.local.example`.

**Proposed Decision:** **保留** as the migration target for `jushi_mobile`. Currently a scaffold only.

---

## 4. Decision Matrix Summary

| Module | Real Callers (code-level) | Superseded by TaskProcess? | User-Visible? | Proposed Decision |
|---|---|---|---|---|
| Study backend (compat endpoints) | Frontend study page; potential external callers unknown | Yes (reads task_processes) | Via `/study` page | 保留兼容层 → Phase 3 remove |
| Study frontend (pages, hooks, types) | Only `/study` page; isolated legacy surface; usage telemetry unknown | Yes (TaskProcess UI supersedes) | 考研学习 page | 废弃待清理 (confirm via access logs) |
| Study tools import (agent_service) | No active callers (fallback path used) | N/A | No | 废弃待清理 |
| Task Timing | `chat_business.py` (active) | Partially (needs Evidence integration) | Indirectly via chat | 保留并迁移 |
| Book Analysis | Backend service; historical Web page from the removed legacy tree; active `mobile/jushi_mobile` routes, screens, and service | Partially (creates TaskProcess) | Mobile profile/list/detail workflow; historical Web UI was not retained | 保留并迁移; preserve mobile parity |
| Review Schedule | `scheduler_service.py` (read-only; no write path found; runtime collection contents unknown) | Yes (planned SM-2 under KO) | None observed | 废弃待清理 (verify collection state) |
| `jushi_agent/` root directory | Removed from `dev`; historically contained home, book-analysis, and auth source fragments | N/A | Historical legacy Web UI only; no runnable surface remains | 已删除; non-canonical and non-runnable; no parity blocker |
| `justime_agent_vue` | Vue router, auth store, admin store; current build fails; no repository-managed release caller found; whole-tree Trivy scans its lockfile | Functionality overlaps current Web app; parity not yet proven | Home/auth/dashboard/admin routes; external usage unknown | 保留并逻辑隔离; frontend/dependency-security lane owns maintenance; keep repository-wide scanning |
| `apps/desktop` (Electron) | Production fallback | No (complementary) | Desktop app | 保留 |
| `apps/macos-native` (SwiftUI) | Target platform | No (complementary) | Desktop app | 保留 |
| `mobile/jushi_mobile` | Active mobile users | Being replaced by justime_mobile (in progress) | Mobile app | 保留并迁移 (with exit criteria) |
| `mobile/justime_mobile` | Scaffold | N/A | Not yet | 保留 |

---

## 5. Follow-up Issue Recommendations

Each proposed action requires a dedicated issue to avoid a single monolithic cleanup PR. Issue keys below are placeholders — actual Multica issues should be created before work begins.

| Placeholder | Proposed Title | Priority | Scope |
|---|---|---|---|
| NEW ISSUE | [Cleanup] Remove study compatibility endpoints + `study_profiles_compat` collection | Medium | Backend API, MongoDB |
| NEW ISSUE | [Cleanup] Remove study frontend pages, hooks, types, and API proxy | Medium | Frontend only |
| NEW ISSUE | [Migration] Task Timing → Evidence time_log integration | High | Backend service, chat_business |
| NEW ISSUE | [Migration] Complete BookAnalysis → TaskProcess reading integration while preserving mobile parity | High | Backend service, mobile contract |
| NEW ISSUE | [Cleanup] Remove orphaned review_schedules read path from scheduler_service | Low | Backend service |
| JUS-515 / JUS-516 / JUS-517 | [Cleanup] Remove `jushi_agent/` and finalize its historical references | High | Completed code removal plus documentation finalization |
| NEW ISSUE | [Security] Repair legacy Vue `form-data` High finding | High | Only `justime_agent_vue/package.json` if needed and `justime_agent_vue/package-lock.json`; verify `form-data >= 4.0.6`, dependency path, install/build status, and targeted/full Trivy |
| NEW ISSUE | [Inventory] Inventory/decommission legacy Vue deployment after parity and telemetry verification | Medium | Ownership/deployment evidence, maintained Web parity, user migration, archive/rollback plan; no deletion without approved implementation scope |
| NEW ISSUE | [Migration] Consolidate jushi_mobile → justime_mobile with feature parity exit criteria | High | Mobile codebase |

---

## 6. Appendix: File-Level Evidence

### 6.1 Backend Files by Module

**study:**
- `justime_backend/app/api/v1/endpoints/study.py` (246 lines) — compat endpoints
- `justime_backend/app/api/v1/api.py:40` — route registration

**task_timing:**
- `justime_backend/app/services/task_timing_service.py` (301 lines) — full service
- `justime_backend/app/business/chat_business.py:14,239,330,618,634` — caller

**book_analysis:**
- `justime_backend/app/api/v1/endpoints/book_analysis.py` (124 lines) — REST API
- `justime_backend/app/services/book_analysis_service.py` (1045 lines) — full service
- `justime_backend/app/models/book_analysis.py` (57 lines) — Pydantic models
- `justime_backend/tests/services/test_book_analysis_service.py` — unit tests

**review_schedule (read-only):**
- `justime_backend/app/services/scheduler_service.py:136,152` — reads `review_schedules`

**study_tools (removed module, fallback import):**
- `justime_backend/app/services/agent_service.py:55-74` — try/except import with no-op fallbacks (active code path since module was removed)

### 6.2 Frontend Files by Module

**study (justime_agent):**
- `justime_agent/src/app/study/page.tsx`
- `justime_agent/src/app/api/study/[...path]/route.ts`
- `justime_agent/src/components/study/DailyTasks.tsx`
- `justime_agent/src/components/study/ProgressOverview.tsx`
- `justime_agent/src/components/study/QuickActions.tsx`
- `justime_agent/src/components/study/StudyQuickCommands.tsx`
- `justime_agent/src/components/study/StudyTimeline.tsx`
- `justime_agent/src/hooks/useStudyPlan.ts`
- `justime_agent/src/hooks/useProgress.ts`
- `justime_agent/src/types/study.ts`
- `justime_agent/src/lib/api/endpoints.ts:68-75`

**book_analysis historical Web frontend (removed by JUS-516; path retained here as evidence only):**
- `jushi_agent/src/app/book-analysis/page.tsx` — removed historical book analysis UI with "聚时" branding; not a migration or deletion blocker

**book_analysis active mobile callers:**
- `mobile/jushi_mobile/app/_layout.tsx:51-52` — list and detail route registration
- `mobile/jushi_mobile/app/(tabs)/profile.tsx:472-480` — visible profile entry and navigation
- `mobile/jushi_mobile/app/book-analysis/index.tsx:24,111,182,238,270,526` — project list/create/update/run/detail workflow
- `mobile/jushi_mobile/app/book-analysis/[id].tsx:21,93-104` — detail loading
- `mobile/jushi_mobile/services/bookAnalysisService.ts:14-128` — API calls
- `mobile/jushi_mobile/constants/api-endpoints.ts:40-45` — `/api/v1/book-analysis` endpoint mapping

**Other removed jushi_agent legacy files (historical paths only):**
- `jushi_agent/src/app/page.tsx` — removed historical home page with "聚时" branding
- `jushi_agent/src/components/auth/AuthPageShell.tsx` — removed historical auth shell component

### 6.3 Legacy Vue Evidence

- `justime_agent_vue/package.json:7-16` — Vite scripts and Vue/Router/Pinia/Axios dependencies
- `justime_agent_vue/src/main.ts:1-12` — application bootstrap
- `justime_agent_vue/src/App.vue:1-7` — route rendering
- `justime_agent_vue/src/router/index.ts:6-91` — public, authenticated, admin, and not-found routes plus guards
- `justime_agent_vue/src/stores/auth.ts:22-99` — auth API callers
- `justime_agent_vue/src/stores/admin.ts:45-285` — admin API callers
- `.github/workflows/ci.yml:59-113` — current Web CI targets `justime_agent`
- `.github/workflows/ci.yml:174-204` — blocking Trivy filesystem scan covers `.` for Critical/High library findings
- `.github/workflows/deploy.yml:66-83` — image builds target `justime_agent` and `justime_backend`
- `deployment/homelab/docker-compose.yml:48-60` — deployed frontend build context is `justime_agent`
- `justime_agent_vue/package-lock.json:1744-1753,2775-2789` — `axios@1.16.1` resolves `form-data@4.0.5`
- GitHub Actions run `29218520965`, job `86719205007` — Trivy reports `CVE-2026-12143` High for `form-data@4.0.5`, fixed in `4.0.6` on the 4.x line
- `npm ls form-data --all --package-lock-only` — confirms `axios@1.16.1 -> form-data@4.0.5`
- `npm ci` — passed; its audit output is separate from the exact Trivy gate evidence above
- `npm run build` — failed in `vue-tsc` on eight unused-symbol errors

### 6.4 MongoDB Collections Affected

| Collection | Used By | Read/Write | Proposed Disposition |
|---|---|---|---|
| `study_profiles_compat` | study.py | R/W | Remove with study endpoints |
| `study_profiles` | scheduler_service.py | R only | Remove with scheduler cleanup |
| `study_tasks` | scheduler_service.py | R only | Remove with scheduler cleanup |
| `study_notebooks` | notebooklm_tools.py, exam_analysis_service.py | R/W | Keep (active) |
| `task_timing_profiles` | task_timing_service.py | R/W | Keep, migrate to Evidence |
| `task_timing_events` | task_timing_service.py | W only | Keep, migrate to Evidence |
| `book_analysis_projects` | book_analysis_service.py | R/W | Keep, complete TaskProcess integration |
| `review_schedules` | scheduler_service.py | R only | Remove (verify collection state first) |
