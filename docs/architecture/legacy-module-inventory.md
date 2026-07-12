# ADR: Legacy Module Inventory — Compatibility / Deprecation Decisions

> **Date:** 2026-07-12
> **Status:** Proposed
> **Decision Makers:** 文档与配置管家 (agent 4d97c6a7)
> **Scope:** Read-only scan; no code changes
> **Base SHA:** 53244b9 (origin/dev)

---

## 1. Executive Summary

This ADR inventories five legacy module groups — **Study**, **Task Timing**, **Book Analysis**, **Review Schedule**, and the **Desktop/Mobile surface apps** — to determine their real callers, whether they are superseded by TaskProcess, user-facing risk, and recommended disposition.

| Module | Observed Status | Proposed Disposition | Risk | Follow-up |
|---|---|---|---|---|
| Study (backend compat layer) | Shim over TaskProcess; reads/writes `study_profiles_compat` | **保留兼容层** until Phase 3 | Low | NEW ISSUE: Remove study compat endpoints |
| Study (frontend pages/hooks) | Isolated legacy surface; no cross-references from modern UIs; usage telemetry unknown | **废弃待清理** | Medium | NEW ISSUE: Remove study frontend |
| Task Timing | Actively called by `chat_business.py` | **保留并迁移** to Evidence time_log | Medium | NEW ISSUE: Task Timing → Evidence integration |
| Book Analysis | Partially integrated with TaskProcess; frontend only in `jushi_agent/` | **保留并迁移** to TaskProcess reading | Medium | NEW ISSUE: Complete BookAnalysis integration |
| Review Schedule | Read-only on `review_schedules` collection; no write path found | **废弃待清理** | Low | NEW ISSUE: Remove review_schedules read path |
| `jushi_agent/` root directory | 3 legacy source files with pre-rename branding | **废弃待清理** | Low | NEW ISSUE: Remove jushi_agent directory |
| `apps/desktop` (Electron) | Active production fallback | **保留** | Low | — |
| `apps/macos-native` (SwiftUI) | Phase 1 merged; Phase 2 pending | **保留** | Low | — |
| `mobile/jushi_mobile` | Active development; full Expo app; primary mobile codebase | **保留并迁移** to justime_mobile | Medium | NEW ISSUE: Migrate jushi_mobile → justime_mobile |
| `mobile/justime_mobile` | Minimal Expo scaffold | **保留** as migration target | Low | — |

---

## 2. Methodology

Read-only scans executed on a fresh checkout from `origin/dev` at SHA `53244b9`:

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

# jushi_agent contents verification
find jushi_agent/ -type f | sort
```

**Limitations:** This scan is based on code-reference and import analysis only. It does not include runtime telemetry, external API caller logs, or user-facing usage data. Where the ADR notes "no callers found in the codebase," external callers (mobile apps, third-party integrations, bookmarks) may still exist.

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

**Frontend presence:** No frontend page for book analysis exists in `justime_agent/src/app/`. A legacy book-analysis frontend page exists in `jushi_agent/src/app/book-analysis/page.tsx` (pre-rename codebase with "聚时" branding), suggesting the feature was originally built for the older app and has not been ported to `justime_agent`.

**Proposed Decision:** **保留并迁移** — Book Analysis has significant value (PDF → NotebookLM → structured analysis) and is already partially integrated with TaskProcess. The migration path is to complete the TaskProcess integration (per plans doc §1: *"BookAnalysis -> category='reading' 的任务化收口仍未完成"*) and port the frontend page from `jushi_agent/` to `justime_agent/`.

**Risk:** Depends on NotebookLM CLI (`notebooklm-py`), which requires Google authentication. The `_validate_runtime_dependencies()` method (line 958-968) checks for CLI and auth at runtime. If NotebookLM API changes, this module breaks silently.

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

### 3.5 Desktop & Mobile Surface Apps

#### 3.5.1 `apps/desktop` (Electron)

**Status:** Active production fallback.
**Recent commits:** 3 commits, most recent `dcecb4c feat(desktop): extract URL policy into testable module`.
**Architecture:** Minimal Electron shell loading the Next.js frontend URL. Does not duplicate business logic.
**ADR reference:** `docs/architecture/2026-06-26-macos-native-migration.md` explicitly keeps Electron as fallback until macOS native passes all release gates.

**Proposed Decision:** **保留** — No action needed. Sunset plan is clear: remove when `apps/macos-native` passes Phase 2 release gates.

#### 3.5.2 `apps/macos-native` (SwiftUI)

**Status:** Phase 1 merged on dev. Phase 2 (native SwiftUI screens) pending.
**Recent commits:** 12 commits, most recent `ac6daeb fix(macos-native): restore swift build/test gate`.
**Build:** `swift build && swift test` (requires macOS 13+, Swift 5.9+).

**Proposed Decision:** **保留** — This is the target platform. Phase 2A-2D child issues are tracked separately.

#### 3.5.3 `mobile/jushi_mobile`

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

#### 3.5.4 `mobile/justime_mobile`

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
| Book Analysis | `book_analysis.py` endpoint; frontend only in `jushi_agent/` | Partially (creates TaskProcess) | Via `/book-analysis` API | 保留并迁移 |
| Review Schedule | `scheduler_service.py` (read-only; no write path found; runtime collection contents unknown) | Yes (planned SM-2 under KO) | None observed | 废弃待清理 (verify collection state) |
| `jushi_agent/` root directory | 3 legacy source files (home page, book-analysis page, auth shell) | N/A | No (pre-rename code) | 废弃待清理 |
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
| NEW ISSUE | [Migration] Complete BookAnalysis → TaskProcess reading integration + port frontend from jushi_agent | Medium | Backend service, frontend |
| NEW ISSUE | [Cleanup] Remove orphaned review_schedules read path from scheduler_service | Low | Backend service |
| NEW ISSUE | [Cleanup] Remove `jushi_agent/` root directory (3 legacy source files) | Low | Repo structure |
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

**book_analysis frontend (jushi_agent only — not ported to justime_agent):**
- `jushi_agent/src/app/book-analysis/page.tsx` — full book analysis UI with "聚时" branding

**Other jushi_agent legacy files:**
- `jushi_agent/src/app/page.tsx` — home page with "聚时" branding
- `jushi_agent/src/components/auth/AuthPageShell.tsx` — auth shell component

### 6.3 MongoDB Collections Affected

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
