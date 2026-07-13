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
- Fence and prove all writers stopped before creating the production migration
  backup. A pre-fence dump is never a production copy source.
- Do not put a password, credential-bearing URI, username, or `authSource` in a
  `mongodump` or `mongorestore` command line. Use a protected MongoDB Database
  Tools config file.
- Keep dump, archive, digest, and extracted files owner-only on approved
  encrypted-at-rest storage. File mode is not a substitute for encryption.
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
- encryption policy or encrypted-volume identifier and an out-of-band key
  reference, never the key itself;
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

The generic script sets a private POSIX umask, hardens its `backups/` directory
and timestamped dump directory to mode `0700`, publishes the final archive with
mode `0600`, and restores the caller's prior umask. It does not itself encrypt
the archive. Therefore the repository `backups/` path must be backed by an
approved encrypted-at-rest filesystem before production use. Homelab operators
must likewise prove that `MONGODB_BACKUP_DIR` is encrypted at rest.

If policy uses approved artifact encryption instead of volume encryption, all
plaintext staging and extraction must still occur on approved encrypted
temporary storage, the retained artifact must be encrypted before it leaves
that storage, and decryption keys must be supplied out of band. `FENCED_BACKUP`
always identifies the plaintext post-fence archive that `tar` or
`mongorestore` will consume; keep it owner-only on encrypted temporary storage
through rehearsal and production restore. An encrypted retained copy is a
separate artifact and does not replace the plaintext identity. Record only the
encryption policy and key reference in the change record. Stop if encryption at
rest cannot be proved.

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
| Legacy only, nonempty | Fence writers, create the final post-fence backup, rehearse that exact artifact, then copy, validate, cut over, and observe as described below. |
| Canonical only, empty | Treat canonical as the initialized target; start only after credential and index checks. |
| Canonical only, nonempty | Keep canonical authoritative; verify configuration and do not perform a name migration. |
| Both present, both empty | Select canonical, validate empty objects, retain legacy through observation, and do not merge. |
| Legacy nonempty, canonical empty | Fence writers, create and rehearse the final post-fence backup, then copy and validate; `--drop` is allowed only after the empty target is named and reconfirmed. |
| Legacy empty, canonical nonempty | Keep canonical authoritative, verify access, and retain legacy through observation; no copy. |
| Both nonempty (`both-nonempty`) | **STOP.** Disable writers, preserve both reports and databases, and open a separate human reconciliation issue. |

The rest of this runbook applies only to `legacy-only` with data or `legacy
nonempty + canonical empty`.

## 4. Qualify tools before the maintenance window

Before disabling traffic, verify the selected backup entry point, encrypted
storage, free space, and installed Database Tools without creating the
production migration artifact:

```bash
mongodump --version
mongorestore --version
mongodump --help
mongorestore --help
```

An optional pre-window dump may qualify tooling and rehearse operator commands,
but label it `REHEARSAL_ONLY_PRE_FENCE`, keep it owner-only and encrypted at
rest, and use only a disposable rehearsal database. It must never be assigned to
`FENCED_BACKUP_TAR_GZ` or `FENCED_BACKUP_ARCHIVE_GZ`, restored into `justime`, or
cited as the production migration backup. It does not satisfy the exact fenced
artifact rehearsal below.

## 5. Fence and prove all writes stopped

1. Disable user traffic and pause scheduled backup execution.
2. Stop every backend, worker, administrative script, scheduled job,
   maintenance container, and old or new blue-green generation with
   write-capable credentials.
3. Capture service-manager or orchestrator evidence that every inventoried
   writer is stopped and that no automatic restart remains enabled during the
   window.
4. Start an approved database command/audit telemetry interval that can detect
   inserts, updates, replacements, deletes, bulk writes, `findAndModify`, and DDL
   against both database names. A point-in-time process snapshot alone is not
   sufficient.
5. Run read-only discovery twice across the approved quiet interval and save
   both fenced reports. Confirm the selected decision-table state remains safe.
6. Require both zero database-side write events during the interval and stopped
   process evidence. Any event, missing telemetry, or restarted process means
   the fence is unproved; find the writer and restart the entire fence gate.
7. Compare the initial and fenced exact counts as supplemental evidence. Count
   equality is not proof of a fence because an in-place update can preserve all
   counts.
8. Keep writers stopped until copy validation and smoke tests finish.

Stopping only the Web frontend is insufficient. Do not create the production
migration backup until this gate is complete.

## 6. Create and identify the final fenced backup

With the proved fence still active, run exactly the backup entry point selected
in section 2. Other deployments using the generic script run:

```bash
umask 077
export MONGODB_DB_NAME=justime-agent
export MONGODB_TOOLS_CONFIG=/secure/path/mongodb-tools.yml
python3 scripts/cron/backup_db.py
export FENCED_BACKUP_TAR_GZ=/absolute/encrypted/path/mongodb_<timestamp>.tar.gz
unset FENCED_BACKUP_ARCHIVE_GZ
export FENCED_BACKUP="$FENCED_BACKUP_TAR_GZ"
```

Homelab runs its documented backup entry point only after the same fence, sets
`FENCED_BACKUP_ARCHIVE_GZ` to the exact `BACKUP_ARTIFACT` it printed, unsets
`FENCED_BACKUP_TAR_GZ`, and sets `FENCED_BACKUP` to that archive. Do not run both
entry points.

The generic script's expected `mongodump` argv contains only the config path,
explicit database name, timestamped output path, and `--quiet`. A nonzero exit or
missing config is a failed gate. The script removes this run's partial artifacts
and does not prune historical valid backups after a failure. A timestamp claim
or output collision fails without overwriting the existing artifact.

The selected variable must name the newly completed post-fence artifact. Never
assign a pre-fence or tooling-rehearsal archive. Under a volume-encryption
policy, if routine retention could prune the artifact, make a byte-for-byte copy
into retention-exempt encrypted storage, verify that its SHA-256 is unchanged,
and reset the variables to that retained plaintext copy before continuing. Under
an artifact-encryption policy, keep the selected plaintext working archive on
encrypted temporary storage and create the separate retained copy as described
below.

Create and verify a digest from the directory containing the exact artifact:

```bash
test -f "$FENCED_BACKUP"
FENCED_BACKUP_DIR="$(dirname "$FENCED_BACKUP")"
FENCED_BACKUP_NAME="$(basename "$FENCED_BACKUP")"
(
  cd "$FENCED_BACKUP_DIR"
  sha256sum "$FENCED_BACKUP_NAME" > "$FENCED_BACKUP_NAME.sha256"
  chmod 600 "$FENCED_BACKUP_NAME.sha256"
  sha256sum --check "$FENCED_BACKUP_NAME.sha256"
)
```

On macOS, use `shasum -a 256` and `shasum -a 256 -c` in the same subshell.
Verify owner-only modes. Linux operators expect directory `700`, archive `600`,
and digest `600`:

```bash
stat -c '%a %n' \
  "$FENCED_BACKUP_DIR" "$FENCED_BACKUP" "${FENCED_BACKUP}.sha256"
```

On macOS:

```bash
stat -f '%Lp %N' \
  "$FENCED_BACKUP_DIR" "$FENCED_BACKUP" "${FENCED_BACKUP}.sha256"
```

Record archive format, exact absolute path, size, SHA-256, tool version, source
database, command exit status, completion time, modes, encrypted-storage policy
or volume identifier, and out-of-band key reference. A file mode alone does not
prove encryption at rest.

If artifact encryption is the approved retention policy, create the encrypted
retained copy only after recording the plaintext SHA-256 above. Record the
encrypted artifact's absolute path, encryption policy, retention policy, and
out-of-band key reference. Keep the plaintext `FENCED_BACKUP` on encrypted
owner-only temporary storage until both restores complete. Any decrypted
working copy created for rehearsal or production restore must also be on that
class of storage, must be mode `0600`, and must match the recorded plaintext
SHA-256 before use. A digest of the encrypted container alone does not prove
that the restored plaintext is the fenced artifact.

## 7. Rehearse the exact fenced artifact

Every production database-name migration must rehearse the exact post-fence
artifact selected above while the fence remains active. Re-run its SHA-256 check
immediately before rehearsal. Use an approved, unique disposable database name
and confirm the installed `mongorestore --help` matches the command. If the
working archive was recreated by decrypting the retained copy, verify its
plaintext SHA-256 against the original fenced digest before continuing.

For the generic tar archive, extract only on approved encrypted temporary
storage and remove group/other access after extraction:

```bash
umask 077
mkdir -m 700 "$REHEARSAL_DIR"
tar -xzf "$FENCED_BACKUP_TAR_GZ" -C "$REHEARSAL_DIR"
chmod -R go-rwx "$REHEARSAL_DIR"
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --dir="$REHEARSAL_DIR" \
  --nsInclude='justime-agent.*' \
  --nsFrom='justime-agent.*' \
  --nsTo='justime-rehearsal.*'
```

For the selected direct archive, use the exact
`FENCED_BACKUP_ARCHIVE_GZ` instead:

```bash
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --archive="$FENCED_BACKUP_ARCHIVE_GZ" \
  --gzip \
  --nsFrom='justime-agent.*' \
  --nsTo='justime-rehearsal.*'
```

Validate the same collection metadata, indexes, exact counts, and deterministic
content checks required below. Remove the rehearsal database only under its own
approved cleanup step, and securely remove the extracted plaintext when no
longer needed. A dump without a verified digest and successful exact-artifact
rehearsal is not a completed backup gate.

## 8. Prepare canonical authentication

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

## 9. Copy the exact fenced snapshot

Re-run the exact fenced artifact's SHA-256 check immediately before the
production restore. A pre-fence or differently digested artifact is forbidden.
If the working archive was recreated by decrypting the retained copy, keep it
owner-only on encrypted temporary storage and verify its plaintext SHA-256
against the original fenced digest; the encrypted container's digest is not a
substitute.
If `FENCED_BACKUP_ARCHIVE_GZ` is selected, use:

```bash
mongorestore \
  --config="$MONGODB_TOOLS_CONFIG" \
  --archive="$FENCED_BACKUP_ARCHIVE_GZ" \
  --gzip \
  --nsFrom='justime-agent.*' \
  --nsTo='justime.*' \
  --drop
```

If `FENCED_BACKUP_TAR_GZ` is selected, use its directory-dump format and
owner-only encrypted extraction storage:

```bash
umask 077
mkdir -m 700 "$RESTORE_DIR"
tar -xzf "$FENCED_BACKUP_TAR_GZ" -C "$RESTORE_DIR"
chmod -R go-rwx "$RESTORE_DIR"
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
directory must be securely removed after successful validation or retained on
the same encrypted-at-rest storage with the same owner-only access as the
migration evidence.

`--drop` is forbidden unless the fenced discovery report proves canonical has
zero documents and the operator names `justime` as the exact target. Never use
it against a nonempty canonical database. Copy every application collection,
view, option, and index; do not copy MongoDB user metadata, transform IDs,
deduplicate, or merge collections.

## 10. Validate before startup

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

## 11. Single-writer cutover and smoke

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

## 12. Observation

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

## 13. Rollback

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

## 14. Retirement

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

## 15. Mixed versions and blue-green deployments

- Before migration, every version explicitly writes only `justime-agent`.
- During fence/copy, no version writes either database.
- After cutover, every active writer explicitly writes only `justime`.
- A blue-green warm-up may perform non-writing health checks, but traffic must
  not leave one color writing legacy while the other writes canonical.
- Old versions are allowed only if they honor the explicit selected database.
- Scheduled jobs, admin scripts, and maintenance containers count as versions.

## 16. Required evidence

Attach or link the following to the change record:

- initial, fenced, and post-copy discovery JSON;
- selected decision-table row and `mutation_allowed=false` proof;
- exact post-fence archive path and format, size, SHA-256, modes, tool version,
  and exact-artifact restore-rehearsal result;
- encrypted-at-rest policy or volume evidence and out-of-band key reference;
  when artifact encryption is used, include the encrypted retained-copy path
  and proof that each decrypted working copy matched the original plaintext
  fenced SHA-256;
- writer inventory, stopped-process evidence, database-side quiet telemetry, and
  both fenced discovery reports;
- source/target collection, option, exact-count, index, and content comparison;
- `justime_app` authentication database and least-privilege role evidence;
- exact copy command and target-empty confirmation;
- cutover environment checksum with secrets redacted;
- smoke and single-write-target evidence;
- observation results and the rollback or retirement decision.
