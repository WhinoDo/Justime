# ADR: Task Data Lifecycle, Retention, and Deletion

> **Date:** 2026-07-13
> **Status:** Proposed; authoritative for implementation after reviewer approval
> **Decision owner:** Justime architecture
> **Scope:** `TaskProcess`, `Evidence`, and `KnowledgeOutput`
> **Base SHA:** `d290cd73fe2611e62ac6c45a8a7fb112b6cfcc96` (`origin/dev`)

## 1. Decision Summary

Justime will model record lifecycle separately from operational workflow status.
`TaskProcess.status`, `TaskProcess.phase`, and `KnowledgeOutput.status` describe
business workflow. A new lifecycle dimension will describe whether a record is
active, archived, or soft-deleted. Hard deletion is a purge outcome, not a live
record state. Restore is a transition, not a fourth live state.

The authoritative policy is:

- Active records are retained until the owner takes an explicit lifecycle
  action.
- Archived records are hidden from default queries, retained indefinitely, and
  restorable without a deadline.
- A user delete request is always a soft-delete. The restore window is 30 days
  of unheld time.
- After the restore window, a purge worker may hard-delete content unless a
  legal or operator hold applies.
- Purge-related audit events and content-free tombstones are retained for 400
  days after purge completion, excluding time under hold.
- Hard deletion is irreversible through Justime.
- Parent archive is a visibility overlay. It never rewrites, archives, or
  deletes child records.
- Parent soft-delete uses an explicit deletion batch. Parent purge uses an
  explicit child-first, parent-last purge manifest. Database-level destructive
  cascade is forbidden.
- Archive, soft-delete, restore, and hard-delete never modify, delete, or
  recreate a Markdown file already published to a user's Vault.
- `TaskProcessBusiness` remains the authority for task lifecycle and progress.
  Only lifecycle-active Evidence can contribute to task metrics.

This ADR defines required behavior. It does not claim that the current models,
endpoints, indexes, or workers already implement it.

## 2. Context and Existing Behavior

At the baseline named above:

- `justime_backend/app/models/task_process.py` includes `"archived"` in
  `TaskStatus`, mixing retention lifecycle with draft/planned/active/completed
  workflow status. It has no archive metadata, deletion timestamp, restore
  deadline, hold, or purge state.
- `justime_backend/app/models/evidence.py` has no archive or delete lifecycle
  fields.
- `justime_backend/app/models/knowledge_output.py` includes `"archived"` in
  `KnowledgeStatus`, but has no deletion lifecycle metadata. Its embedded
  `version_history` stores complete Markdown snapshots.
- `TaskProcessBusiness._task_counts()` counts every Evidence and
  KnowledgeOutput with the matching `task_id`. It applies no lifecycle filter.
- `TaskProcessBusiness.list_task_processes()` includes archived tasks unless a
  caller supplies an operational status filter. Child list methods return all
  matching children.
- Evidence drives progress, `actual_hours`, phase advancement, and task
  completion. KnowledgeOutput does not drive task progress.
- `MarkdownExportService.publish()` writes a separate file to a user-selected
  local Vault. The database is not authoritative for that file after publish.
- There is no lifecycle audit ledger, deletion batch, purge manifest, hold,
  purge worker, idempotency contract, or partial-failure recovery contract.

These gaps make an implicit delete or a query optimization unsafe. In
particular, list/count work must not guess whether archived or deleted children
are visible or countable.

## 3. Terms and State Authority

### 3.1 Lifecycle state

Future persistence must expose a lifecycle state equivalent to:

```text
active | archived | soft_deleted
```

The field name is an implementation choice, but its semantics are not. A live
record has exactly one of these values.

- **Active:** available to ordinary owner workflows, subject to the parent's
  visibility.
- **Archived:** retained, read-only except for lifecycle operations and
  authorized export, and omitted from default queries.
- **Soft-deleted:** retained only for restore, hold, export, and purge; omitted
  from ordinary and archive queries.
- **Hard-deleted:** no live record or content remains in Justime. Only the
  content-free tombstone and permitted audit metadata may remain.
- **Restored:** a successful transition from `archived` or `soft_deleted` to
  the recorded pre-transition lifecycle state. It is not stored as a lifecycle
  state.

### 3.2 Operational state remains separate

Lifecycle transitions must not overload or infer business workflow:

- `TaskProcess.status` and `TaskProcess.phase` remain operational fields.
- `KnowledgeOutput.status` remains the draft/reviewed/published workflow field.
- Evidence has no operational status.

Archiving records the operational status at archive time and leaves that status
unchanged. Unarchive restores visibility without inventing a workflow
transition. Soft-delete records the prior lifecycle state and operational state
for deterministic restore.

After lifecycle schema migration, new writes must not use operational
`status="archived"`. Legacy records with that value are read as lifecycle
`archived`. Their one-time migration uses these deterministic operational
defaults when no prior status was recorded:

- Legacy archived TaskProcess: `completed` if `completed_at` is present or
  `progress == 1`; otherwise `paused`.
- Legacy archived KnowledgeOutput: `published` if `published_at` is present;
  otherwise `draft`.

This conservative mapping avoids automatically resuming old work and avoids
claiming that an unpublished output was reviewed.

### 3.3 Write authority

`TaskProcessBusiness`, or a future lifecycle service invoked by it, is the
single write authority for these lifecycle transitions. API handlers, workers,
frontend clients, migrations, and database triggers must not perform direct
ad hoc lifecycle mutations.

The record owner may request archive, unarchive, soft-delete, and restore for
owned records. Only an authorized legal/operator workflow may place or release
a hold. Only the purge worker may execute hard deletion. Support and admin
roles do not acquire owner-equivalent content access merely because they can
inspect lifecycle metadata.

## 4. Authoritative Decision Matrix

The retention periods below are minimum product policy, not a promise that
backups outside the application database disappear at the same instant. Backup
retention must be documented separately and must not make purged content
queryable through Justime.

| Record and lifecycle | Lifecycle owner / actor | Owner visibility | Retained data | Retention and purge eligibility | Restore behavior |
|---|---|---|---|---|---|
| TaskProcess active | Owner; writes through TaskProcessBusiness | Included in default list/detail | Full task record and active relationships | Indefinite until explicit archive or delete | Not applicable |
| TaskProcess archived | Owner; archive/unarchive through TaskProcessBusiness | Archive list/detail only; excluded from default and trash | Full task record; children are unchanged | Indefinite; archive alone never starts purge | Unarchive to active lifecycle with the same operational status; recompute metrics before returning it to active queries |
| TaskProcess soft-deleted | Owner initiates; lifecycle service owns deletion batch | Trash list/detail only during restore window; excluded from default/archive | Full task plus batch membership and prior state | Purge eligible after 30 days of unheld time | Restore the parent and only batch-owned children to their recorded prior lifecycle states |
| TaskProcess hard-deleted | Purge worker | Not visible or exportable through owner APIs | No task content; content-free tombstone and audit only | Tombstone/audit expire 400 days after purge completion, excluding held time | Impossible through Justime |
| Evidence active | Owner; writes through TaskProcessBusiness | Visible in an active parent; also visible through explicit archived-parent detail because parent archive is only an overlay | Full Evidence content and metadata | Indefinite until explicit child action or parent deletion batch | Not applicable |
| Evidence archived | Owner; child archive/unarchive through TaskProcessBusiness | Explicit child archive mode only; never in default child list | Full Evidence record | Indefinite; not purge eligible | Unarchive to active if the parent is not soft-deleted; parent archive may still hide it from ordinary views |
| Evidence soft-deleted | Owner directly or parent deletion batch | Explicit trash inventory only | Full Evidence plus deletion batch and prior state | Purge eligible after 30 days of unheld time | Direct delete restores only that Evidence; parent-batch restore follows batch ownership rules |
| Evidence hard-deleted | Purge worker | Not visible; references report the source as unavailable | No Evidence content; content-free tombstone and audit only | Tombstone/audit expire 400 days after purge completion, excluding held time | Impossible through Justime |
| KnowledgeOutput active | Owner; writes through TaskProcessBusiness | Visible in an active parent; also visible through explicit archived-parent detail | Current output, all version snapshots, publish metadata, and database path fields | Indefinite until explicit child action or parent deletion batch | Not applicable |
| KnowledgeOutput archived | Owner; child archive/unarchive through TaskProcessBusiness | Explicit child archive mode only; never in default child list | Current output and complete version history | Indefinite; not purge eligible | Unarchive to active lifecycle with the same draft/reviewed/published operational status |
| KnowledgeOutput soft-deleted | Owner directly or parent deletion batch | Explicit trash inventory only | Current output, complete version history, and deletion metadata | Purge eligible after 30 days of unheld time | Direct delete restores only that output; parent-batch restore follows batch ownership rules |
| KnowledgeOutput hard-deleted | Purge worker | Not visible or rollback-capable | No Markdown, version snapshot, prompt-derived content, or database path; content-free tombstone and audit only | Tombstone/audit expire 400 days after purge completion, excluding held time | Impossible through Justime |

For all three record types, a successful restore clears the active deletion
markers but does not delete the audit history or reuse an old deletion batch.
A later delete creates a new operation and a new batch identifier.

## 5. Parent and Child Transition Contract

### 5.1 Parent-driven transitions

| TaskProcess transition | Evidence behavior | KnowledgeOutput behavior | Counts and metrics | Vault behavior |
|---|---|---|---|---|
| Active to archived | No child lifecycle field changes | No child lifecycle field changes; version history retained | Stored task metrics freeze. Archived task detail counts lifecycle-active children only | No file operation |
| Archived to active | No child lifecycle field changes | No child lifecycle field changes | Recompute progress, `actual_hours`, and visible counts before the task re-enters active queries | No file operation; missing files remain missing |
| Active or archived to soft-deleted | Create a deletion batch and mark every retained child not already soft-deleted as batch-owned; record each child's prior lifecycle state | Same; current output and every embedded version belong to the output's batch item | Normal response counts become zero. Do not recompute progress or `actual_hours` | No file operation |
| Soft-deleted to restored | Restore only children carrying the same deletion batch ID, each to its recorded prior lifecycle state | Same, including all retained versions | If parent restores to active, recompute metrics and visible counts before exposure. If it restores to archived, keep metrics frozen | No file operation; republish is explicit |
| Soft-deleted to hard-deleted | Purge eligible child records first according to manifest order | Purge output content and every version snapshot before the parent | No recomputation. Purged items never count | No file operation |

Parent soft-delete is an explicit application operation, not a MongoDB cascade.
Before any mutation, it creates an immutable deletion operation identity and a
batch inventory. The batch includes the parent and all currently retained
children that are not already soft-deleted. For every included record it stores
the prior lifecycle state needed for restore.

A child soft-deleted before the parent operation keeps its original deletion
batch and deadline. It is not adopted by the parent batch and is not restored
with the parent. A child independently archived before parent deletion is
included in the parent batch and restores to archived, not active.

No new Evidence or KnowledgeOutput may be created under an archived or
soft-deleted task. Lifecycle restore/export operations are allowed through
their explicit query modes. A child in trash cannot be independently restored
while its parent remains soft-deleted; restore the parent first or restore it as
part of the parent batch.

### 5.2 Independent child transitions

| Child action under an active task | Parent lifecycle | Count effect | Progress effect | Related records |
|---|---|---|---|---|
| Archive Evidence | Unchanged | Remove from `evidence_count` | Recompute metrics using remaining active Evidence | Do not archive or delete KnowledgeOutput |
| Unarchive Evidence | Unchanged | Add to `evidence_count` | Recompute metrics including restored active Evidence | Existing source references become available again |
| Soft-delete Evidence | Unchanged | Remove from `evidence_count` | Recompute metrics using remaining active Evidence | Do not delete outputs that cited it; expose the source reference as unavailable |
| Restore Evidence | Unchanged | Add to `evidence_count` | Recompute metrics including restored active Evidence | Restore content availability; do not rewrite outputs |
| Hard-delete Evidence after deadline | Unchanged | Never counts | No additional recomputation beyond the soft-delete transition | Do not cascade to outputs; retain only permitted object-ID provenance |
| Archive KnowledgeOutput | Unchanged | Remove from `knowledge_output_count` | None; KnowledgeOutput never drives task progress | Archive all embedded versions with the parent output lifecycle |
| Unarchive KnowledgeOutput | Unchanged | Add to `knowledge_output_count` | None | All retained versions become available again |
| Soft-delete KnowledgeOutput | Unchanged | Remove from `knowledge_output_count` | None | Keep versions during restore window; do not touch Vault file |
| Restore KnowledgeOutput | Unchanged | Add to `knowledge_output_count` | None | Restore database output and versions; do not recreate Vault file |
| Hard-delete KnowledgeOutput after deadline | Unchanged | Never counts | None | Purge current Markdown and all versions; do not touch Vault file |

An independent child transition must never change the parent lifecycle. A hard
deleted child identifier may remain only as content-free provenance where a
retained record needs to explain a missing source. APIs must mark that source
unavailable and must not expose purged content through joins, caches, search
indexes, or version history.

## 6. Vault and Knowledge Version Contract

### 6.1 Published Vault files

A published Vault file is a user-owned external artifact. After publish, the
database record is not authority to delete or rewrite that file.

Therefore:

- TaskProcess, Evidence, and KnowledgeOutput archive performs no Vault file
  operation.
- Soft-delete performs no Vault file operation.
- Restore performs no Vault file operation and does not recreate a missing
  file.
- Hard-delete performs no Vault file operation, even if the database still has
  an `absolute_path` or `vault_relative_path` before purge.
- Restoring a published KnowledgeOutput restores only the retained database
  record. Republish is a separate, explicit user action and uses the normal
  conflict policy.
- A file edited or deleted outside Justime remains edited or deleted. Justime
  must not infer desired filesystem state from database lifecycle state.

A future command that deletes a Vault file must be a separate feature with its
own confirmation, owner authorization, canonical path validation against the
configured Vault root, symlink/path traversal defenses, idempotency key, and
audit event. It must not be bundled into record archive or deletion.

Absolute Vault paths and filesystem contents are prohibited from lifecycle
audit events and tombstones.

### 6.2 KnowledgeOutput version history

Embedded `KnowledgeOutput.version_history` is content, not audit metadata. Each
snapshot follows the lifecycle of its KnowledgeOutput:

- Archive retains and hides all snapshots with the output.
- Soft-delete retains all snapshots for the restore window.
- Restore makes all retained snapshots available again.
- Hard-delete purges the current Markdown and every historical Markdown
  snapshot in the same manifest item before the parent TaskProcess can purge.
- Rollback is unavailable while the output is archived or soft-deleted and is
  impossible after hard deletion.

Future persistence must give versions stable identifiers for audit and purge
inventory. Audit may store those identifiers and version numbers, but never the
Markdown snapshot itself.

## 7. Query, List, and Count Semantics

These rules are the direct implementation contract for JUS-528.

### 7.1 TaskProcess queries

- The default TaskProcess list filters lifecycle `active`. It excludes archived
  and soft-deleted tasks regardless of operational status.
- Archive and trash are explicit, mutually exclusive query modes. Archive mode
  filters lifecycle `archived`. Trash mode filters lifecycle `soft_deleted` and
  returns only records the caller may restore, hold, or export.
- Operational filters such as `status`, `phase`, `category`, and `priority` are
  applied after the lifecycle mode and never widen it.
- Pagination `total`, `total_pages`, and items use the identical parent
  lifecycle predicate. A page must not report records excluded from `items`.
- A hard-deleted task is absent from all owner list/detail modes.

During compatibility migration, a record with no lifecycle field and legacy
operational `status="archived"` is treated as lifecycle archived, never active.

### 7.2 Child queries and counts

- Default Evidence and KnowledgeOutput lists contain only lifecycle-active
  child records.
- `evidence_count` counts only Evidence whose own lifecycle is active and not
  soft-deleted.
- `knowledge_output_count` counts only KnowledgeOutput whose own lifecycle is
  active and not soft-deleted.
- An independently archived or soft-deleted child never contributes to a
  normal count.
- A child hidden only because its parent is archived is not independently
  archived. It still contributes to that archived parent's archive-detail
  count when the child's own lifecycle is active.
- An archived parent's explicit detail may list its lifecycle-active children.
  Independently archived children require child archive mode.
- A soft-deleted task's normal response counts are zero. Trash detail may expose
  a separately named retained-child inventory for restore review; that
  inventory must not be returned as `evidence_count` or
  `knowledge_output_count`.
- Hard-deleted children never count and never appear in child lists. A retained
  source reference may report only that the object is unavailable.

Counts must be computed with the same lifecycle predicate used by the relevant
child list. Cached or denormalized counts are permitted only if lifecycle
transitions update or invalidate them atomically enough that the API cannot
present archived/deleted children as active.

### 7.3 Owner, admin, support, and export access

| Actor / workflow | Active | Archive | Restore-window trash | Held data | Hard-deleted data |
|---|---|---|---|---|---|
| Owner default query | Full owned content | Excluded | Excluded | Excluded unless otherwise active and not hidden | None |
| Owner explicit lifecycle view | Full owned content | View/export/unarchive | View/export/restore while retained | Ordinary visibility remains based on lifecycle; hold details are not required | None |
| Admin/support default | Metadata needed for support only | Metadata only | Metadata only | Metadata only | Tombstone metadata only when authorized |
| Elevated content access/export | Requires scoped authorization, reason code, and audit | Same | Same while content remains | Authorized hold/export workflow only | Impossible |
| Purge worker | Metadata and manifest needed for eligibility | No purge authority | Content access only to execute manifest | Must skip held scope | Tombstone write/expiry only |

A hold does not silently expose data and does not change its lifecycle
visibility. Support access is not a bypass around owner or hold controls.

## 8. Progress and Metric Authority

`TaskProcessBusiness` remains the only authority that recalculates task
progress and `actual_hours` from child lifecycle changes.

- Only lifecycle-active Evidence contributes to Evidence-derived progress,
  evidence density, AI evidence input, or `actual_hours`.
- Archived, soft-deleted, and hard-deleted Evidence contributes zero.
- KnowledgeOutput never contributes to task progress or `actual_hours`.
- Archiving or soft-deleting Evidence under an active task triggers immediate
  metric recomputation using the remaining active Evidence.
- Unarchiving or restoring Evidence under an active task triggers immediate
  recomputation including that Evidence.
- These removal/restore recomputations update metrics only. They do not
  automatically reverse `TaskProcess.status`, `phase`, milestone status, or
  `completed_at`. Operational reversals require an explicit TaskProcess
  business action.
- Archiving a TaskProcess freezes its stored progress, progress source, and
  `actual_hours`; child records are not rewritten.
- Unarchiving a TaskProcess recomputes metrics from active Evidence before the
  task appears in an active response.
- Parent soft-delete and hard purge do not recompute metrics. A parent-batch
  restore to active recomputes before exposure; restore to archived keeps
  metrics frozen until unarchive.

Normal Evidence creation may continue to use existing TaskProcess business
rules for phase advancement and completion. Lifecycle-triggered removal must
not independently invent such workflow transitions.

## 9. Audit Contract

Lifecycle audit is append-only and separate from user content and
KnowledgeOutput version history. Every lifecycle request and worker result must
produce an event with these fields or equivalent typed fields:

| Field | Requirement |
|---|---|
| `event_id` | Globally unique event identifier |
| `operation_id` | Stable operation identifier and idempotency key |
| `actor_type`, `actor_id` | Owner, admin/support, legal/operator, system, or purge worker identity |
| `action` | Typed action such as archive, unarchive, soft_delete, restore, hold_place, hold_release, purge_start, item_purge, purge_complete, export, or elevated_content_access |
| `occurred_at` | Server timestamp in UTC |
| `reason_code` | Required bounded enum appropriate to the action |
| `reason_text` | Optional, sanitized, maximum 500 characters |
| `object_type`, `object_id` | TaskProcess, Evidence, KnowledgeOutput, version, deletion batch, or purge manifest identity |
| `version_ids` | Content-free stable version identifiers when affected |
| `prior_state`, `new_state` | Typed lifecycle and relevant operational state metadata; no content fields |
| `deletion_batch_id` | Required for parent deletion, batch restore, and batch purge events |
| `hold_id` | Required when a hold controls the action or outcome |
| `outcome` | Started, succeeded, failed, skipped, or conflict, with a bounded error code |

Audit events and tombstones must never store:

- Evidence `content` or content-bearing metadata;
- current or historical KnowledgeOutput Markdown;
- prompts, model inputs/outputs, tokens, credentials, cookies, or secrets;
- absolute Vault paths, Vault file contents, or filesystem snapshots;
- unsanitized exception text or request bodies.

Audit for a live record is retained for at least the life of that record. Once
the record is purged, its lifecycle audit and tombstone are retained until 400
days after `purge_completed_at`, excluding time under hold, then become eligible
for metadata deletion. Events covering elevated content access or export follow
the same minimum and may be retained longer if a separately approved security
policy requires it.

## 10. Retention, Holds, and Purge

### 10.1 Retention clocks

Soft-delete records `soft_deleted_at` and an initial
`purge_eligible_at = soft_deleted_at + 30 days`. The clock measures unheld time.
If a hold is active for any interval, `purge_eligible_at` moves forward by the
duration of that interval. Releasing a hold resumes the remaining interval; it
does not make the record immediately purgeable unless no restore time remained
when the hold began.

Archive has no purge clock. Unarchive has no retention deadline. Restoring a
soft-deleted record cancels eligibility for that deletion batch. A later delete
starts a new 30-day clock and new operation.

The purge worker must recheck ownership, lifecycle state, deletion batch,
deadline, and holds immediately before each destructive step. A stale queued
job is not authority to purge.

### 10.2 Legal and operator holds

A hold is an independently authorized record containing a stable hold ID,
scope, issuer, reason code, start time, and optional release metadata. Its scope
may cover an object, deletion batch, or owner account.

- Holds pause content purge and tombstone/audit expiry clocks within scope.
- Holds do not change active/archive/trash visibility.
- Holds do not grant ordinary admin/support content access.
- A held child blocks parent-last purge. The manifest remains incomplete until
  the hold is released or the operation is lawfully superseded.
- Releasing a hold is audited and resumes the remaining retention time.
- A hold placed after partial purge cannot restore content already purged. It
  protects only remaining content and preserves partial-operation evidence.

### 10.3 Purge manifest and ordering

Before hard deletion, the lifecycle service creates an immutable purge
manifest for the deletion batch. It contains no user content or Vault path. It
records:

- manifest and operation IDs;
- deletion batch ID and owner ID;
- each object type and ID, including KnowledgeOutput version IDs;
- expected lifecycle state and concurrency/version token;
- child-before-parent ordering;
- per-item status, attempt count, bounded error code, and completion time;
- hold checks and final operation outcome.

The required order is:

1. Validate the manifest, deadline, owner scope, and holds.
2. Purge Evidence content and its content-bearing secondary copies, search
   documents, caches, and generated indexes named by the manifest.
3. Purge KnowledgeOutput current content, all version snapshots, and its
   content-bearing secondary copies and indexes.
4. Confirm every retained child item is purged or is explicitly blocking the
   operation under hold.
5. Purge the TaskProcess content last.
6. Write or finalize content-free tombstones and a purge-complete audit event.

Database foreign-key or collection cascade, if introduced later, must not be
used as the deletion mechanism because it cannot provide this inventory,
ordering, hold check, or recovery evidence.

### 10.4 Idempotency and partial-failure recovery

Every archive, delete, restore, hold, and purge request requires a stable
operation ID/idempotency key.

- Repeating the same operation ID with the same actor, target, action, and
  parameters returns the recorded result and does not repeat side effects.
- Reusing an operation ID with different parameters returns a conflict and is
  audited.
- Each mutation uses an expected lifecycle state and concurrency/version token.
  A mismatch fails closed instead of overwriting a newer action.
- Purge retries resume the existing manifest. They do not construct a new
  inventory from whatever children happen to remain.
- A manifest item is considered complete only after its primary content and
  every declared content-bearing secondary copy are deleted and the item result
  is durably recorded.
- A missing item is treated as success only when the same operation already
  recorded completion or a matching tombstone proves the purge. Otherwise the
  worker records a failure and does not purge the parent.
- Partial failure leaves the parent and remaining children soft-deleted and
  hidden. It never restores them automatically and never exposes partially
  purged data through normal APIs.
- Worker restart, timeout, or duplicate delivery resumes by operation ID. The
  final purge-complete event is emitted once after all required items succeed.

## 11. Future Implementation Boundaries

Reviewer approval of this ADR permits separate implementation issues. It does
not authorize implementation in this issue.

### 11.1 Backend schema, business, API, and audit

This boundary owns lifecycle fields, deletion batch schema, stable version IDs,
legacy archived-status migration, authorization, explicit list modes,
TaskProcessBusiness transitions, count predicates, metric recomputation,
content-access/export controls, and append-only audit events. It must include
tests for every matrix transition and must not directly delete Vault files.

### 11.2 Purge worker, indexes, idempotency, and recovery

This boundary owns retention indexes, hold-aware eligibility, immutable purge
manifests, secondary-copy inventory, child-first ordering, tombstones,
idempotent retries, concurrency checks, and partial-failure recovery. It must
prove that search indexes, caches, and version snapshots cannot return purged
content. It must not rely on implicit database cascade.

### 11.3 Frontend archive, trash, restore, and hold presentation

This boundary owns explicit archive and trash views, restore deadline display,
confirmation and reason collection, retained-child inventory, unavailable
source presentation, restore/unarchive actions, and authorized hold/export
presentation. Default task and child views must remain lifecycle-active only.
The frontend must not imply that database deletion removed a Vault file.

These boundaries must remain separate so schema/API correctness, destructive
worker safety, and user presentation can be independently reviewed and rolled
out.

## 12. Rejected Alternatives

### 12.1 Reuse operational `status="archived"` as deletion state

Rejected because workflow status and retention state have different owners,
query defaults, restore rules, and purge clocks. Overloading status makes it
impossible to preserve a completed/published state across archive and restore.

### 12.2 Immediate hard-delete from the user-facing delete action

Rejected because it removes the restore window, prevents reliable audit and
hold checks, and makes transient client retries destructive. The owner-facing
delete action is always soft-delete under this policy.

### 12.3 Destructive implicit cascade

Rejected. Database cascade, `delete_many({task_id: ...})`, or equivalent
untracked fan-out cannot preserve independently deleted children, restore only
one deletion batch, honor per-scope holds, purge child-first, or recover safely
after partial failure.

### 12.4 Archive every child when the parent is archived

Rejected because parent archive is a visibility decision, not a rewrite of
child ownership or retention state. Rewriting children would lose the
difference between independently archived children and children hidden only by
their parent.

### 12.5 Delete or recreate published Vault files with database lifecycle

Rejected because Vault files are user-owned external artifacts and may have
been edited, moved, or deleted outside Justime. A database transition cannot
infer filesystem intent.

### 12.6 Count all retained children

Rejected because retained does not mean active. Including archived or
soft-deleted children would make default list counts disagree with child lists
and would let hidden Evidence continue to affect progress.

## 13. Consequences

Positive consequences:

- JUS-528 can implement list and count filters without additional product
  judgment.
- Archive remains reversible and non-destructive.
- Soft-delete has a deterministic restore boundary and deadline.
- Hard deletion can be audited, held, retried, and recovered without treating a
  partial operation as success.
- Vault ownership remains clear.
- Evidence-derived metrics cannot silently include hidden records.

Costs and risks:

- Lifecycle implementation requires schema changes, migration, indexes, audit
  storage, worker infrastructure, and frontend modes.
- Parent deletion is more complex than a database cascade because it must
  inventory children and preserve independent deletion history.
- Purge completeness depends on maintaining an explicit inventory of every
  content-bearing secondary store.
- The 30-day and 400-day policies must be reconciled with deployment backup
  retention before hard deletion is advertised as complete outside Justime's
  queryable systems.

No production code, schema, API, migration, worker, or frontend behavior is
changed by this ADR alone.
