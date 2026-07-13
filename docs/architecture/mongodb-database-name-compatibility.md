# ADR: MongoDB Database Name Compatibility and Migration

> **Date:** 2026-07-14
> **Status:** Proposed; authoritative for implementation after reviewer approval
> **Decision owner:** Justime architecture
> **Scope:** MongoDB database-name selection, discovery, migration, cutover, and rollback
> **Base SHA:** `97fbe1f94c8b33ed82e9d1a8b00c2c06aac0f157` (`origin/dev`)

## 1. Decision Summary

The canonical MongoDB database name for new Justime deployments is `justime`.
The legacy database name is `justime-agent`.

This decision does not rename data merely by changing an environment default.
An existing `justime-agent` database must be discovered, backed up, copied,
validated, and deliberately cut over before that deployment uses `justime`.

The binding configuration rules are:

- An explicitly configured `MONGODB_DB_NAME` always selects the application
  data database and must remain supported long term.
- Before migration, an existing deployment must continue to set
  `MONGODB_DB_NAME=justime-agent` explicitly.
- Application startup must not list databases, guess between `justime-agent`
  and `justime`, copy data, merge data, or write to both databases.
- `MONGODB_URI` is connection and authentication configuration. Its path and
  `authSource` must be made consistent with the selected credential topology,
  but neither is a fallback database-selection algorithm.
- New-deployment defaults and templates may change to `justime` only after the
  migration tool, compatibility checks, and operations documentation are
  merged and at least one controlled migration has passed validation.
- A cutover has exactly one writable database. Mixed versions and blue-green
  deployments must never use `justime-agent` and `justime` as concurrent write
  targets.

The source `justime-agent` database is retained during an observation period
and denied routine application writes. It is not dropped by the migration.

## 2. Context and Current Evidence

At the baseline above, documentation and active configuration disagree:

- `AGENTS.md` describes the primary database as `justime`.
- `justime_backend/app/core/config.py:85-86` defaults both the URI path and
  `MONGODB_DB_NAME` to `justime-agent`.
- `justime_backend/.env.example:13-14` uses `justime-agent`.
- `deployment/homelab/.env.example:38,48` selects `justime-agent`, and its URI
  authenticates with `authSource=justime-agent`.
- `deployment/homelab/docker-compose.yml:175` defaults MongoDB initialization
  to `justime-agent`.
- `deployment/homelab/scripts/mongo-init.sh:15,63` creates `justime_app` in the
  selected application database with `readWrite` on that database. The user
  identity, its authentication database, and its role therefore all participate
  in the migration.
- `deployment/allinone/docker-compose.yml:29` embeds `justime-agent` in the URI.
- `scripts/cron/backup_db.py:27` independently defaults its backup database to
  `justime-agent` and must eventually follow the same explicit configuration.
- `justime_backend/app/database.py:58-64` constructs one Motor client and then
  selects exactly `settings.MONGODB_DB_NAME`. Index initialization operates on
  that one selected database.

No application startup discovery, automatic database migration, or dual-write
mechanism exists at this baseline. This ADR does not introduce one.

`justime_agent/package.json` uses `justime-agent` as an npm package name. That
identifier is unrelated to the MongoDB database name and is not migration
evidence.

## 3. Terminology and Authority

| Term | Meaning |
| --- | --- |
| canonical database | `justime`, the database name for new deployments after final rollout |
| legacy database | `justime-agent`, the database used by existing deployments before migration |
| present database | A name returned by privileged `listDatabases`; failure to list is an error, not absence |
| empty database | A present database whose non-system collections contain zero documents in total |
| nonempty database | A present database with at least one document in any non-system collection |
| selected database | The exact value of `MONGODB_DB_NAME` used by the application |
| writable database | The sole database to which active application writers are authorized and routed |
| migration operator | A separately authorized human or tool identity that can inspect, dump, restore, and administer users for both names |

An empty database may still contain empty collections or indexes. Those objects
must be reported, but zero documents makes it empty for the decision table.
MongoDB may omit a database with no durable objects from `listDatabases`; that
case is absent, not a special third state.

The migration operator, not application startup, owns discovery and migration.
Insufficient permission to list databases, count documents, enumerate indexes,
or inspect users is a hard preflight failure.

## 4. Existing database discovery

Discovery is a read-only migration-tool or operations preflight. It must run
before creating the target user, target collections, or any target document so
that it records the original state.

### 4.1 Required inventory

The preflight must use an operator credential and produce machine-readable
output containing, for both `justime-agent` and `justime`:

1. Whether the name appears in `listDatabases`.
2. Every non-system collection or view, including its type and collection
   options.
3. Exact `countDocuments({})` counts for every collection. Estimated counts are
   insufficient for migration acceptance.
4. Explicit counts for the current critical baseline collections:
   `users`, `task_processes`, `evidence`, `knowledge_outputs`, `chat_sessions`,
   `chat_messages`, `calendar_events`, `system_llm_configs`, and
   `work_documents`. A missing critical collection is reported as missing, not
   silently converted to a zero-count existing collection.
5. Every non-default index with a normalized definition including collection,
   name, keys, `unique`, `sparse`, `expireAfterSeconds`,
   `partialFilterExpression`, and collation when present.
6. The total document count across all non-system collections and the resulting
   classification from the table below.

The critical list is a review aid, not a copy allowlist. Migration copies and
validates every discovered application collection so a newer or less common
collection cannot be silently omitted.

Discovery must not log URI credentials, passwords, or unmasked connection
strings. Its report may contain database names, collection names, counts, index
definitions, and timestamps.

### 4.2 Deterministic decision table

| Observed state | Required action | Automatic action forbidden |
| --- | --- | --- |
| Neither database present (`none`) | Treat as a new deployment. Create and authorize `justime_app` in `justime`, initialize `justime`, and configure only `justime`. | Creating or consulting `justime-agent` |
| Legacy only, empty | Create `justime`, validate it as empty, configure canonical credentials, and retain the empty legacy name until observation ends. No document copy is needed. | Starting the application on legacy merely because the name exists |
| Legacy only, nonempty (`legacy-only`) | Run the full backup, copy, validation, credential cutover, and smoke sequence in this ADR. | Changing defaults or starting against canonical before copy validation |
| Canonical only, empty | Treat canonical as the initialized new-deployment target and start only after credential and index checks pass. | Creating legacy or copying from an absent source |
| Canonical only, nonempty (`canonical-only`) | Keep canonical as authoritative, verify configuration and access, and do not perform a name migration. | Recreating legacy or replacing canonical from an absent source |
| Both present and both empty (`both-empty`) | Select canonical, verify or recreate only empty canonical objects as required, retain legacy for observation, and do not merge. | Choosing by timestamp, size, or startup order |
| Both present, legacy nonempty and canonical empty | Stop all writers, back up legacy, clear only verified-empty canonical application objects if the copy tool requires it, then run the full legacy-to-canonical copy and validation sequence. | Treating the empty canonical database as proof that migration already completed |
| Both present, legacy empty and canonical nonempty | Keep canonical as authoritative, verify configuration and access, and retain legacy for observation. No document copy is needed. | Copying empty legacy metadata over canonical |
| Both present and both nonempty (`both-nonempty`) | Stop. Preserve both databases and reports, keep writers disabled, and require a human reconciliation plan approved as a separate issue. | Automatic merge, overwrite, newest-wins, largest-wins, per-collection selection, or dual-write |

The tool must print the selected row and the exact next permitted operation. It
must require an explicit execution mode for mutations; discovery output alone
must never trigger a copy.

## 5. Backward-compatible configuration

### 5.1 Selection contract

`MONGODB_DB_NAME` is the application data-database selector. Current backend
code already indexes the Motor client with this explicit value. Future code
must preserve that behavior even after its default becomes `justime`.

The following configurations are valid during rollout:

```dotenv
# Existing deployment before migration
MONGODB_DB_NAME=justime-agent
MONGODB_URI=mongodb://justime_app:${MONGO_APP_PASSWORD}@mongodb:27017/justime-agent?authSource=justime-agent
```

```dotenv
# Migrated deployment and final new-deployment template
MONGODB_DB_NAME=justime
MONGODB_URI=mongodb://justime_app:${MONGO_APP_PASSWORD}@mongodb:27017/justime?authSource=justime
```

These examples describe the current Homelab user topology. A deployment whose
application user is intentionally stored in `admin` may retain
`authSource=admin`, but the operator must prove that the authenticated identity
has the required role on the selected data database. The application must not
rewrite or infer `authSource`.

If the URI path and `MONGODB_DB_NAME` differ, `MONGODB_DB_NAME` still selects
application data. The migration preflight must flag the mismatch for operator
review because the URI path may also become the implicit authentication source
when `authSource` is omitted. Templates must keep the URI path,
`MONGODB_DB_NAME`, and the intended authentication topology visibly aligned.

Passwords embedded in a URI must be percent-encoded. Neither this ADR nor a
future migration report may contain real credentials.

### 5.2 Compatibility requirements

- Existing deployments must pin `MONGODB_DB_NAME=justime-agent` before
  installing any release whose code default is `justime`.
- New and old application versions must both honor an explicit legacy value.
- A release must not deprecate the explicit legacy value merely because new
  templates use canonical.
- No connection failure may cause fallback to the other database.
- No missing collection may cause fallback to the other database.
- No startup health check may create objects in both databases.
- Index creation must run only against the selected database.

Regression tests must cover explicit legacy selection, explicit canonical
selection, and the absence of list/copy/dual-write behavior during application
startup.

## 6. Migration/copy sequence

The sequence below applies to `legacy-only` with data and to the safe
`legacy nonempty + canonical empty` state. Every step is gated; a failed gate
keeps all writers stopped.

### 6.1 Prepare and fence writes

1. Announce a maintenance window and record the discovery report, application
   release, environment checksum with secrets redacted, and cutover owner.
2. Stop every application process capable of writing MongoDB, including backend
   instances, workers, administrative scripts, scheduled jobs, and both sides
   of a blue-green deployment.
3. Re-run exact counts after shutdown. Any count change between the initial and
   fenced reports means a writer remains active; find it and restart preflight.
4. Keep user traffic disabled until copy validation and the write smoke test
   complete.

Stopping only the visible Web process is insufficient. The gate concerns every
process holding write-capable credentials.

### 6.2 Back up legacy

Create a timestamped, encrypted-at-rest backup using MongoDB Database Tools and
a mode-`0600` tools configuration file supplied outside the repository and
shell history. The backup must contain all legacy application collections,
collection metadata, and indexes. Authentication users are handled separately
and must not be restored as application data.

An implementation may wrap commands equivalent to:

```bash
mongodump \
  --config="$MONGODB_TOOLS_CONFIG" \
  --db='justime-agent' \
  --archive="$BACKUP_ARCHIVE" \
  --gzip
```

The protected tools configuration contains the operator URI or password. The
implementation must delete any temporary copy after use and must not echo its
contents or pass a credential-bearing URI directly on the command line.

The operation must record command exit status, archive size, a SHA-256 digest,
tool version, source database name, and completion time. A restore rehearsal to
an isolated disposable database is required for the first production migration
and after any material tool-version change. A successful dump command without
digest and restore evidence is not a completed backup gate.

### 6.3 Create and authorize the target application identity

For the current Homelab topology, an administrator connects through `admin`,
switches to `justime`, and creates or verifies a database-scoped `justime_app`
identity with exactly `readWrite` on `justime`:

```javascript
db.getSiblingDB("justime").createUser({
  user: "justime_app",
  pwd: passwordSuppliedOutOfBand,
  roles: [{ role: "readWrite", db: "justime" }]
})
```

The password must come from secret management, not a script literal. If
`justime_app` already exists in the `justime` authentication database, the tool
must inspect and reconcile its roles explicitly instead of blindly calling
`createUser` again.

MongoDB users are scoped by their authentication database. Therefore the legacy
identity authenticated with `authSource=justime-agent` and the canonical
identity authenticated with `authSource=justime` are distinct even when their
username text is the same. The target URI must use the authentication database
where the target identity was actually created.

Deployments using an `admin`-scoped application identity must grant that
identity `readWrite` on `justime` and keep `authSource=admin`; they must not also
create an unused database-scoped identity.

### 6.4 Copy collections and indexes

Copy the fenced legacy snapshot into canonical with namespace remapping. A
future tool may wrap MongoDB Database Tools behavior equivalent to:

```bash
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --archive="$BACKUP_ARCHIVE" \
  --gzip \
  --nsFrom='justime-agent.*' \
  --nsTo='justime.*' \
  --drop
```

`--drop` is permitted only after the decision table proves canonical has zero
documents and the tool records the exact target collections it will replace.
It must never be used against a nonempty canonical database.

The copy must include every application collection, collection option, and
index contained in the archive. It must not copy MongoDB user metadata into the
application namespace. No transformation, deduplication, ID rewrite, or
per-collection merge is part of this migration.

### 6.5 Validate the copy

Before any application starts, compare legacy and canonical and require all of
the following:

- Identical discovered application collection and view names and types.
- Identical collection options after normalizing database-qualified namespace
  fields.
- Exact document-count equality for every collection and for the total.
- Exact count equality for every critical collection listed in section 4.1.
- Equivalent normalized index definitions for every collection, including
  unique, sparse, TTL, partial-filter, and collation options.
- A deterministic content check for every collection. At minimum this is a
  stable digest over sorted `_id` plus canonicalized documents; for collections
  too large for a full digest, an approved implementation may combine chunked
  range digests with a complete `_id` inventory, but sampling alone is not
  acceptance evidence.
- Successful authentication as the target `justime_app`, a read from canonical,
  and denial of access not granted by the intended least-privilege role.

Any mismatch stops the cutover. Do not repair a mismatch by running the live
application and allowing index startup code or new writes to obscure the copy
state. Correct the tool or repeat restore from the fenced backup.

### 6.6 Cut over configuration and smoke test

After validation:

1. Save the rollback environment values with secrets stored securely.
2. Set `MONGODB_DB_NAME=justime`.
3. Change the URI database path to `/justime`.
4. Set `authSource=justime` for the current database-scoped Homelab identity,
   or preserve the explicitly verified authentication database for another
   credential topology.
5. Start exactly one writer generation. Keep all other versions stopped.
6. Run health checks, authenticated critical reads, and one traceable create,
   read, update, and delete smoke cycle against a disposable test record.
7. Confirm from MongoDB audit or command telemetry that smoke writes reached
   only `justime` and that the disposable record was removed.
8. Re-run critical collection counts, accounting explicitly for the temporary
   smoke record so final persistent counts equal the validated copy.
9. Restore user traffic only after all checks pass.

For Homelab, `deployment/homelab/scripts/business-smoke.sh` may be used for the
HTTP portion after its test data and cleanup behavior are verified for the
release. It does not replace database count, index, credential, or single-write-
target validation.

### 6.7 Retain legacy read-only

During the observation period:

- Keep the legacy backup and `justime-agent` database.
- Remove routine write capability from the legacy application identity. In the
  current database-scoped topology, change its role from `readWrite` to `read`
  on `justime-agent` using an administrator identity.
- Keep all active application configuration pointed only at canonical.
- Alert on any write attempt to legacy.
- Do not drop legacy, remove its backup, or reuse its name for tests.

The observation period length is set by the operations runbook and change
policy. Its end requires explicit approval and a fresh backup-retention check;
expiry must never trigger automatic deletion.

## 7. Rollback

### 7.1 Rollback triggers

Rollback evaluation begins when any of the following occurs after cutover:

- Target authentication or authorization fails for `justime_app`.
- A collection, exact count, content digest, collection option, or index differs
  from validated legacy evidence.
- Critical reads return missing or inconsistent user data.
- The write smoke test fails or any write reaches `justime-agent`.
- Application error rate, latency, or data-integrity alerts exceed the approved
  deployment threshold.
- A mixed-version writer is detected with different database configuration.

Before rollback, stop all writers and capture both databases' counts and
diagnostic evidence. Do not destroy canonical evidence.

### 7.2 Rollback before any canonical write

If telemetry proves canonical received no application write after the copied
snapshot:

1. Stop the canonical application generation.
2. Restore the legacy `justime_app` role from `read` to `readWrite` on
   `justime-agent`.
3. Restore the saved legacy values:

   ```dotenv
   MONGODB_DB_NAME=justime-agent
   MONGODB_URI=mongodb://justime_app:${MONGO_APP_PASSWORD}@mongodb:27017/justime-agent?authSource=justime-agent
   ```

4. Start exactly one legacy-configured writer generation.
5. Run authenticated reads and a disposable write smoke cycle against legacy.
6. Keep canonical intact for investigation; do not automatically retry the
   migration.

### 7.3 Rollback after canonical writes

If canonical received any write after cutover, including a later-deleted smoke
record, changing environment variables back is not by itself a valid rollback.
The write must first be reconciled or proven to have left no authoritative
delta. Otherwise an environment-only rollback could silently discard the
canonical delta and create two divergent histories.

The required response is:

1. Stop all writers.
2. Preserve fresh backups and inventories of both databases.
3. Identify canonical changes since the fenced snapshot using audit evidence,
   an operation ledger, or complete database comparison.
4. Choose and approve one reconciliation method: apply the canonical delta to a
   restored legacy copy, restore the latest authoritative backup and replay a
   proven operation log, or promote canonical after fixing the application
   fault. If the only writes were traceable disposable smoke records, complete
   comparison may prove that no authoritative delta remains. This is still a
   recorded, human-reviewed recovery decision, not an automatic merge.
5. Validate the reconciled database with the same collection, count, index, and
   content gates used for migration.
6. Only then restore the selected database's URI, `MONGODB_DB_NAME`,
   `authSource`, and `justime_app` write role and restart one writer generation.

If complete delta evidence is unavailable, remain in maintenance and restore
from the last proven backup according to the incident decision. Data loss must
be declared and approved; it must not be hidden behind an environment rollback.

## 8. Deployment ordering

The mandatory rollout order is:

1. Approve this ADR and complete JUS-581 and JUS-582.
2. Merge the migration discovery/copy tool, its tests, explicit-configuration
   compatibility regression tests, and any compatibility code required by
   those tests. Keep application and deployment defaults on `justime-agent` in
   this step.
3. Merge the operations runbook aligned to the released tool.
4. Deploy the tool and compatibility-capable application release while every
   existing environment still explicitly selects `justime-agent`.
5. Execute discovery, backup, migration, validation, credential cutover, and
   smoke testing for the selected deployment.
6. After controlled migration evidence is accepted, update backend,
   Homelab, and All-in-One new-deployment defaults to `justime` in scoped,
   independently reviewable changes.
7. Verify every pre-existing deployment still has an explicit database name
   before it receives a release with the canonical code default.

Changing a default first and copying data later is forbidden. A release or
template must never silently make an existing installation appear empty by
pointing it at a newly created canonical database.

## 9. Mixed-version behavior

Old and new application versions may participate in the rollout only under an
explicit single-database contract:

- Before migration, all versions set `MONGODB_DB_NAME=justime-agent` and use
  credentials authorized for legacy.
- During the maintenance copy, all write-capable versions are stopped.
- After cutover, every active writer sets `MONGODB_DB_NAME=justime` and uses
  credentials authorized for canonical.
- A new version must continue to accept an explicit legacy value for an
  environment that has not migrated.
- An old version may be used after migration only if it respects the explicit
  canonical value and has passed its normal compatibility checks.
- Blue-green warm-up may run health checks without user writes, but traffic
  switching must not leave one color writing legacy while the other writes
  canonical.
- Scheduled jobs, one-off admin commands, and maintenance containers count as
  versions for this rule.

There is no supported phase where replication is implemented by application
dual-write. MongoDB-native replication of one database name to another is also
not a substitute for the fenced migration and validation contract defined here.

## 10. Implementation breakdown

The paths below are proposed write sets for future issues. They do not claim
that the new migration or test files already exist. Each issue must be created
from then-current `origin/dev`, define its own exact allowed scope, and wait for
this ADR, JUS-581, and JUS-582 to be reviewed and merged before production work
starts.

### 10.1 Migration tool and tests

**Minimum write set:** a new operational tool such as
`justime_backend/scripts/mongodb_database_name_migration.py`, a focused test such
as `justime_backend/tests/test_mongodb_database_name_migration.py`, and only the
smallest configuration-contract test needed to prove explicit selection.

**Responsibility:** read-only discovery, deterministic classification, guarded
backup/restore orchestration, namespace remapping, exact validation reports,
credential-topology checks, secret redaction, and explicit confirmation gates.
It must not run from application startup.

**Dependency:** first implementation task after the three prerequisite issues.
It may proceed in parallel with the runbook, but the runbook cannot finalize
commands until the tool interface is stable.

**Acceptance commands:**

```bash
cd justime_backend
pytest tests/test_mongodb_database_name_migration.py -q
python scripts/mongodb_database_name_migration.py --help
python scripts/mongodb_database_name_migration.py discover --help
cd ..
git diff --check
```

Tests must cover all decision-table rows, refusal of `both-nonempty`, failure on
insufficient privileges, no secret leakage, no mutation in discovery mode,
index normalization, and exact-count mismatch failure.

### 10.2 Backend default and `.env` example

**Minimum write set:** `justime_backend/app/core/config.py`,
`justime_backend/.env.example`, and a focused configuration test if one is not
already supplied by the migration-tool issue.

**Responsibility:** change only the unconfigured new-deployment defaults to
`justime`; preserve explicit `MONGODB_DB_NAME`; prove startup selects one
database and performs no discovery or dual-write.

**Dependency:** blocked until a controlled migration using the merged tool and
runbook has passed. It must not be bundled into the tool issue.

**Acceptance commands:**

```bash
cd justime_backend
pytest tests/test_conftest_mongodb_env.py -q
pytest tests/test_mongodb_database_name_config.py -q
cd ..
rg -n 'MONGODB_URI|MONGODB_DB_NAME' justime_backend/app/core/config.py justime_backend/.env.example
git diff --check
```

### 10.3 Homelab init and templates

**Minimum write set:** `deployment/homelab/.env.example`,
`deployment/homelab/docker-compose.yml`,
`deployment/homelab/scripts/mongo-init.sh`, and a focused shell test under
`deployment/homelab/tests/` if needed.

**Responsibility:** make `justime` the new-install default, create
`justime_app` in the intended authentication database with `readWrite` on
`justime`, and keep URI path, `MONGODB_DB_NAME`, and `authSource` aligned.
Existing `.env` files remain explicit and are never rewritten by Compose.

**Dependency:** same post-migration gate as section 10.2. May proceed in
parallel with sections 10.2 and 10.4 after that gate.

**Acceptance commands:**

```bash
bash -n deployment/homelab/scripts/mongo-init.sh
MONGO_ROOT_PASSWORD=test MONGO_APP_PASSWORD=test MONGODB_DB_NAME=justime \
  docker compose -f deployment/homelab/docker-compose.yml config >/dev/null
rg -n 'justime|authSource|justime_app|readWrite' \
  deployment/homelab/.env.example \
  deployment/homelab/docker-compose.yml \
  deployment/homelab/scripts/mongo-init.sh
git diff --check
```

### 10.4 All-in-One configuration

**Minimum write set:** `deployment/allinone/docker-compose.yml` and only the
focused deployment test required to parse and assert its environment.

**Responsibility:** change the new All-in-One database URI/default to
`justime`, explicitly expose `MONGODB_DB_NAME` if required by the final design,
and preserve the single-database contract.

**Dependency:** same post-migration gate as section 10.2. It must not edit
Homelab files.

**Acceptance commands:**

```bash
docker compose -f deployment/allinone/docker-compose.yml config >/dev/null
rg -n 'MONGODB_URI|MONGODB_DB_NAME|justime' deployment/allinone/docker-compose.yml
! rg -n '27017/justime-agent([?[:space:]]|$)' deployment/allinone/docker-compose.yml
git diff --check
```

### 10.5 Operations runbook and backup alignment

**Minimum write set:** a dedicated runbook such as
`docs/runbooks/mongodb-database-name-migration.md`, the active MongoDB sections
of `DEPLOYMENT.md`, and `scripts/cron/backup_db.py` because its current fallback
still names legacy. Other active documentation may be added only after an
issue-specific scan proves it is operational rather than historical.

**Responsibility:** publish maintenance, backup, discovery, copy, validation,
cutover, observation, rollback, and retirement commands using the released
tool. Keep existing deployments explicit and distinguish database names from
package names, service names, and historical records.

**Dependency:** draft in parallel with the tool, finalize after its CLI is
stable, and merge before the first controlled migration.

**Acceptance commands:**

```bash
test -f docs/runbooks/mongodb-database-name-migration.md
rg -n 'discovery|backup|authSource|justime_app|rollback|observation|both-nonempty' \
  docs/runbooks/mongodb-database-name-migration.md DEPLOYMENT.md
python -m py_compile scripts/cron/backup_db.py
rg -n 'MONGODB_URI|MONGODB_DB_NAME' scripts/cron/backup_db.py
git diff --check
```

## 11. Security and observability requirements

- Use a dedicated migration operator credential. Do not give the application
  user database-administration or cross-database restore privileges.
- Supply secrets through protected environment or file descriptors. Do not put
  passwords in committed files, process arguments visible to other users, logs,
  reports, or shell history.
- Redact MongoDB URI credentials while preserving host, selected database, and
  `authSource` needed for diagnosis.
- Record tool versions, source and target names, counts, index fingerprints,
  archive digest, base application release, start/end times, operator identity,
  and every gate result.
- Treat a permission-denied discovery result as unknown state and stop.
- Require an explicit destructive confirmation naming the empty target before
  any `--drop` behavior.
- Keep backup retention and access controls at least through the observation
  period and any unresolved incident.

## 12. Rejected alternatives

### Change defaults without copying data

Rejected because an existing installation would connect to an empty `justime`
database and silently hide its `justime-agent` data.

### Application startup auto-detection

Rejected because permissions and MongoDB's lazy database creation make absence
ambiguous, and a transient failure could select the wrong database. Startup is
not an operations migration boundary.

### Automatic merge when both databases contain data

Rejected because object IDs, unique indexes, independent updates, and deletion
history cannot be reconciled by a generic newest-wins rule. Both nonempty is a
human recovery state.

### Temporary application dual-write

Rejected because partial failures create divergent databases and make rollback
authority unclear. The maintenance-window copy is accepted instead.

### Keep authenticating in legacy after canonical cutover by default

Rejected for the current Homelab topology because it leaves canonical access
dependent on the legacy authentication database. A deliberate `admin`-scoped
identity remains valid when explicitly configured and authorized.

### Rename every `justime-agent` string in the repository

Rejected because the same text is used by unrelated package names, service
names, historical documents, and paths. This migration concerns MongoDB data
and authentication configuration only.

## 13. Out of scope

This ADR does not:

- Execute a database migration or connect to a live MongoDB server.
- Modify production code, environment templates, Compose, scripts, tests, or
  lock files.
- Rename the npm package `justime-agent` in `justime_agent/package.json`.
- Rename the valid `justime_agent` source directory.
- Restore or redefine the deleted root `jushi_agent` tree or the removed
  `mobile/jushi_mobile` migration source.
- Rewrite historical archive evidence merely because it mentions an old
  database or product name.
- Define database retirement timing beyond requiring an explicit post-
  observation decision.
- Resolve two independently modified nonempty databases. That requires a
  separate, evidence-specific reconciliation plan.

## 14. Consequences

The migration requires a maintenance window, operator credentials, verified
backup storage, and more validation than a configuration-only rename. That cost
is accepted because it prevents silent data hiding, accidental overwrite,
authentication failure, and unrecoverable divergent writes.

After rollout, new deployments consistently use `justime`, while existing
deployments can remain on `justime-agent` for as long as they explicitly select
it. Operational evidence, not application heuristics, determines when a given
deployment changes names.
