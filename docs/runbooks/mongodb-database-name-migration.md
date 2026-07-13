# MongoDB Database Name Migration Runbook

This runbook moves one Justime deployment from the legacy MongoDB database
`justime-agent` to the canonical database `justime`. It implements the gates in
[`mongodb-database-name-compatibility.md`](../architecture/mongodb-database-name-compatibility.md).

It is an operator procedure, not an application startup feature. Never infer a
database from a URI path, a missing collection, or a failed connection. Before
migration, every writer must explicitly set:

```dotenv
MONGODB_DB_NAME=justime-agent
```

Only after copy and validation succeed may every writer explicitly set:

```dotenv
MONGODB_DB_NAME=justime
```

## Non-negotiable safety rules

- Use a maintenance window and a separately authorized migration operator.
- Keep exactly one writable database. Application dual-write is unsupported.
- Treat insufficient discovery permission as an unknown state and stop.
- Stop if both databases are nonempty. Do not merge, overwrite, or choose one.
- Do not put a password, credential-bearing URI, username, or `authSource` in a
  `mongodump` or `mongorestore` command line. Use a protected MongoDB Database
  Tools config file.
- Do not run `--drop` unless discovery proves the canonical target has zero
  documents and the change record names the exact empty target.
- Do not drop `justime-agent` as part of migration or automatic retention.
- Mixed-version and blue-green deployments must use the same one database for
  all write-capable processes.

## 1. Prepare the change record

Record the following before discovery:

- operator and cutover owner;
- maintenance start and approved rollback thresholds;
- application release and Git SHA;
- MongoDB Database Tools version;
- redacted environment checksum;
- backup location and free-space evidence;
- source `justime-agent` and target `justime` names;
- planned observation end, at least seven full days after cutover.

Inventory every possible writer: backend instances, workers, scheduled jobs,
admin scripts, maintenance containers, and both blue-green generations. The
maintenance plan must be able to stop all of them.

## 2. Select one backup entry point

A deployment must use one supported scheduled backup entry point, not both:

- Homelab uses `deployment/homelab/scripts/backup-mongodb.sh` and follows
  `deployment/homelab/MONGODB_BACKUP.md`. That flow is unchanged and protected
  by `deployment/homelab/tests/test-backup-mongodb.sh`.
- Other deployments may use `scripts/cron/backup_db.py`. It creates
  `backups/mongodb_<timestamp>.tar.gz` and retains successful archives for seven
  days.

Do not schedule the generic cron script on a Homelab deployment that already
runs the Homelab backup flow. Duplicate dumps consume storage and create
ambiguous recovery evidence.

For the generic script, create a MongoDB Database Tools config outside the
repository and shell history. It must be an existing regular file, must not be
a symlink, and on POSIX must grant no group or other permission bits:

```bash
chmod 600 /secure/path/mongodb-tools.yml
export MONGODB_TOOLS_CONFIG=/secure/path/mongodb-tools.yml
```

The script never reads or parses that file. It only passes the path as
`mongodump --config=<path>`.

## 3. Run read-only discovery

The read-only discovery interface owned by JUS-589 reads the operator connection
only from `MONGODB_MIGRATION_OPERATOR_URI`. Inject that value through the
deployment's secret manager or another protected process environment; do not put
the URI in a command-line argument or committed file. Verify the released
interface:

```bash
python justime_backend/scripts/mongodb_database_name_migration.py --help
python justime_backend/scripts/mongodb_database_name_migration.py discover --help
```

Then create the report with owner-only file permissions:

```bash
umask 077
test -n "${MONGODB_MIGRATION_OPERATOR_URI:-}"
python justime_backend/scripts/mongodb_database_name_migration.py discover \
  > mongodb-database-discovery.json
```

Do not proceed if JUS-589 is not merged into the deployed release,
`discover --help` differs from this contract, output is not deterministic JSON,
`mutation_allowed` is not `false`, or either database cannot be fully
inventoried. Discovery must finish before creating target users, collections,
indexes, or documents.

The report must cover presence, non-system collections and views, collection
options, exact `countDocuments({})` counts, critical-collection presence and
counts, normalized non-default indexes, total documents, classification, and
the exact next permitted action.

### Nine-state decision table

| Discovery result | Required decision |
| --- | --- |
| Neither database present | New deployment: initialize and authorize only `justime`; do not create or consult legacy. |
| Legacy only, empty | Initialize canonical, validate it as empty, and retain empty legacy through observation; no document copy. |
| Legacy only, nonempty | Run the full backup, fence, copy, validation, cutover, and observation sequence below. |
| Canonical only, empty | Treat canonical as the initialized target; start only after credential and index checks. |
| Canonical only, nonempty | Keep canonical authoritative; verify configuration and do not perform a name migration. |
| Both present, both empty | Select canonical, validate empty objects, retain legacy through observation, and do not merge. |
| Legacy nonempty, canonical empty | Run the full sequence below; `--drop` is allowed only after the empty target is named and reconfirmed. |
| Legacy empty, canonical nonempty | Keep canonical authoritative, verify access, and retain legacy through observation; no copy. |
| Both nonempty (`both-nonempty`) | **STOP.** Disable writers, preserve both reports and databases, and open a separate human reconciliation issue. |

The rest of this runbook applies only to `legacy-only` with data or `legacy
nonempty + canonical empty`.

## 4. Create and verify the migration backup

Keep the application explicitly on legacy before the maintenance window:

```bash
export MONGODB_DB_NAME=justime-agent
export MONGODB_TOOLS_CONFIG=/secure/path/mongodb-tools.yml
python3 scripts/cron/backup_db.py
```

The expected `mongodump` argv contains only the config path, explicit database
name, timestamped output path, and `--quiet`. A nonzero exit or missing config
is a failed gate. The script removes this run's partial directory/archive and
does not prune historical valid backups after a failure. If another invocation
owns the same second-resolution timestamp, or either timestamped artifact
already exists, the script fails without running `mongodump` or changing the
existing artifact.

Identify the newly produced archive, move or copy it to protected storage that
is exempt from routine seven-day pruning, then create and verify a digest:

```bash
sha256sum backups/mongodb_<timestamp>.tar.gz \
  > backups/mongodb_<timestamp>.tar.gz.sha256
sha256sum --check backups/mongodb_<timestamp>.tar.gz.sha256
mongodump --version
```

On macOS, use `shasum -a 256` to create the digest and
`shasum -a 256 -c` to verify it. Record archive size, digest, tool version,
source database, command exit status, and completion time.

Before the first production migration, and after a material Database Tools
version change, perform a restore rehearsal into an isolated disposable
database. Extract the tar archive in protected temporary storage; the extracted
directory contains the `justime-agent/` dump directory. Restore that directory
with the protected config and namespace remapping:

```bash
mkdir -m 700 "$REHEARSAL_DIR"
tar -xzf "$BACKUP_TAR_GZ" -C "$REHEARSAL_DIR"
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --dir="$REHEARSAL_DIR" \
  --nsInclude='justime-agent.*' \
  --nsFrom='justime-agent.*' \
  --nsTo='justime-rehearsal.*'
```

Use an approved, unique rehearsal database name and confirm these options
against the installed `mongorestore --help`. Validate the same collection
metadata, indexes, exact counts, and content checks required below. Remove the
rehearsal database only under its own approved cleanup step. A dump without a
verified digest and successful rehearsal is not a completed backup gate.

## 5. Fence all writes

1. Disable user traffic.
2. Stop every application and job with write-capable credentials.
3. Confirm no old or new blue-green generation remains write-capable.
4. Run read-only discovery again and save a fenced report.
5. Compare initial and fenced exact counts. Any change means a writer remains;
   find it, restart discovery, and do not copy.
6. Keep writers stopped until copy validation and smoke tests finish.

Stopping only the Web frontend is insufficient.

## 6. Prepare canonical authentication

For the current database-scoped topology, an administrator authenticates via
`admin`, creates or verifies `justime_app` in the `justime` authentication
database, and grants exactly:

```javascript
roles: [{ role: "readWrite", db: "justime" }]
```

Supply the password out of band. If `justime_app` already exists, inspect and
reconcile its roles instead of blindly recreating it.

MongoDB users are scoped by authentication database. A user named
`justime_app` in `justime-agent` is distinct from one in `justime`. The target
URI must therefore use `authSource=justime` for this topology. If the deployment
intentionally uses an `admin`-scoped application identity, keep
`authSource=admin` and prove that identity has `readWrite` only where required,
including `justime`.

## 7. Copy the fenced snapshot

If the approved source is a direct `mongodump --archive --gzip` artifact, use the
protected config and namespace remapping equivalent to:

```bash
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --archive="$BACKUP_ARCHIVE" \
  --gzip \
  --nsFrom='justime-agent.*' \
  --nsTo='justime.*' \
  --drop
```

When the generic cron tar archive is the approved source, use its actual
directory-dump format instead:

```bash
mkdir -m 700 "$RESTORE_DIR"
tar -xzf "$BACKUP_TAR_GZ" -C "$RESTORE_DIR"
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --dir="$RESTORE_DIR" \
  --nsInclude='justime-agent.*' \
  --nsFrom='justime-agent.*' \
  --nsTo='justime.*' \
  --drop
```

Confirm the exact command against the installed `mongorestore --help` and
record it in the change ticket before execution. The protected extraction
directory must be removed after successful validation or retained under the
same restricted access as the migration evidence.

`--drop` is forbidden unless the fenced discovery report proves canonical has
zero documents and the operator names `justime` as the exact target. Never use
it against a nonempty canonical database. Copy every application collection,
view, option, and index; do not copy MongoDB user metadata, transform IDs,
deduplicate, or merge collections.

## 8. Validate before startup

Re-run read-only discovery and compare source and target. All gates must pass:

- identical application collection/view names and types;
- equivalent normalized collection options;
- exact per-collection and total document counts;
- exact critical collection counts, with missing distinct from existing zero;
- equivalent normalized indexes, including unique, sparse, TTL, partial filter,
  and collation options;
- deterministic content verification for every collection, using a stable full
  digest or approved chunked range digests plus a complete `_id` inventory;
- successful canonical authentication as `justime_app` and successful read;
- denial of access outside the intended least-privilege role.

Sampling alone is not acceptance. Any mismatch keeps writers stopped. Correct
the copy procedure or restore again from the fenced backup; do not start the
application to repair indexes or obscure evidence.

## 9. Single-writer cutover and smoke

Save the rollback environment securely, then configure every process in the
one selected generation:

```dotenv
MONGODB_DB_NAME=justime
MONGODB_URI=mongodb://justime_app:${MONGO_APP_PASSWORD}@mongodb:27017/justime?authSource=justime
```

For an approved non-Homelab credential topology, preserve its verified
`authSource`; never infer or rewrite it.

Start exactly one writer generation. Keep other versions and scheduled jobs
stopped. Run:

1. liveness/readiness and authenticated critical reads;
2. one traceable create, read, update, and delete cycle on a disposable record;
3. audit or command telemetry proving all smoke writes reached only `justime`;
4. cleanup proof for the disposable record;
5. fresh critical counts reconciled with the temporary smoke operation.

Homelab may use `deployment/homelab/scripts/business-smoke.sh` for the HTTP
portion after verifying its cleanup behavior. It does not replace database
count, index, credential, or write-target validation. Restore user traffic only
after every gate passes.

## 10. Observation

Observe for at least seven full days and until the approved change window ends:

- retain the migration backup, digest, reports, and `justime-agent` database;
- keep all active application configuration explicitly on `justime`;
- reduce the legacy database-scoped `justime_app` role from `readWrite` to
  `read`, using an administrator identity;
- alert on any attempted write to legacy;
- monitor authentication failures, critical reads, error rate, latency, counts,
  and data-integrity checks;
- do not let routine retention delete the migration backup or digest.

Observation expiry never authorizes automatic deletion.

## 11. Rollback

Rollback evaluation begins for target auth failure, metadata/count/index/content
mismatch, missing critical data, failed smoke, any legacy write, threshold
breach, or mixed-version writers with different database selections.

First stop all writers and preserve fresh reports and backups of both databases.
Do not destroy canonical evidence.

### Before any canonical application write

If telemetry proves canonical received no application write:

1. stop the canonical generation;
2. restore legacy `justime_app` to `readWrite` on `justime-agent`;
3. restore the saved explicit legacy configuration;
4. start exactly one legacy-configured generation;
5. run authenticated reads and a disposable legacy write smoke;
6. keep canonical intact for investigation.

```dotenv
MONGODB_DB_NAME=justime-agent
MONGODB_URI=mongodb://justime_app:${MONGO_APP_PASSWORD}@mongodb:27017/justime-agent?authSource=justime-agent
```

### After any canonical write

An environment-only rollback is forbidden. Stop all writers, inventory and
back up both databases, identify every canonical delta, and approve one
reconciliation method. Validate the reconciled authority with the same full
metadata, count, index, content, and credential gates before restarting one
writer. If complete delta evidence is unavailable, remain in maintenance and
make any data-loss decision explicit.

## 12. Retirement

Retirement is a separate approved change after observation. It requires:

- accepted observation evidence and no legacy writes;
- a fresh canonical backup and verified digest;
- canonical metadata/count/index/content validation;
- confirmation that all versions, jobs, and secrets explicitly select
  `justime`;
- removal of routine legacy application access;
- an explicit decision for backup retention and any destructive database
  removal.

This migration does not drop `justime-agent`. Do not automate retirement based
on elapsed time.

## 13. Mixed versions and blue-green deployments

- Before migration, every version explicitly writes only `justime-agent`.
- During fence/copy, no version writes either database.
- After cutover, every active writer explicitly writes only `justime`.
- A blue-green warm-up may perform non-writing health checks, but traffic must
  not leave one color writing legacy while the other writes canonical.
- Old versions are allowed only if they honor the explicit selected database.
- Scheduled jobs, admin scripts, and maintenance containers count as versions.

## 14. Required evidence

Attach or link the following to the change record:

- initial, fenced, and post-copy discovery JSON;
- selected decision-table row and `mutation_allowed=false` proof;
- backup path, size, SHA-256, tool version, and restore-rehearsal result;
- writer inventory and fence evidence;
- source/target collection, option, exact-count, index, and content comparison;
- `justime_app` authentication database and least-privilege role evidence;
- exact copy command and target-empty confirmation;
- cutover environment checksum with secrets redacted;
- smoke and single-write-target evidence;
- observation results and the rollback or retirement decision.
