# MongoDB Pre-Deploy Backup

Every staging and production deployment creates a logical MongoDB archive before Docker image or container mutation. A failed or empty dump exits nonzero and stops deployment.

## Required host configuration

Add both values to `deployment/homelab/.env` on each deployment host:

```dotenv
MONGODB_BACKUP_DIR=/var/backups/justime/mongodb
MONGODB_BACKUP_RETENTION=7
```

- `MONGODB_BACKUP_DIR` must be an absolute host path. Empty, relative, and filesystem-root paths are rejected. The script creates the directory with mode `0700`.
- `MONGODB_BACKUP_RETENTION` is the number of complete archive/manifest pairs to retain and must be at least `2`.
- Store the directory on durable host storage with enough free space for the configured retention. Container-local paths are not supported.

## Artifact contract

The deployment workflow passes the checked-out Git commit as `JUSTIME_DEPLOY_SHA`. A successful run publishes:

```text
justime-mongodb-<UTC_TIMESTAMP>-<DEPLOY_SHA>.archive.gz
justime-mongodb-<UTC_TIMESTAMP>-<DEPLOY_SHA>.archive.gz.sha256
```

The `.sha256` file uses the standard `<sha256>  <archive-name>` format. Both files are written through temporary files and renamed only after `mongodump --archive --gzip` succeeds, the archive is nonempty, and its SHA-256 is available. Retention runs only after the new pair is published and removes only the oldest matching archive/manifest pairs.

The script prints the exact paths as `BACKUP_ARTIFACT` and `BACKUP_MANIFEST`. Preserve these values in deployment logs for recovery and rollback workflows.

## Manual verification

Run from the repository root on the deployment host:

```bash
JUSTIME_DEPLOY_SHA="$(git rev-parse HEAD)" \
  bash deployment/homelab/scripts/backup-mongodb.sh
```

Verify the newest pair:

```bash
cd /var/backups/justime/mongodb
sha256sum --check "$(ls -1t justime-mongodb-*.archive.gz.sha256 | head -n 1)"
```

To inspect an archive without restoring it:

```bash
docker compose \
  --env-file deployment/homelab/.env \
  -f deployment/homelab/docker-compose.yml \
  exec -T mongodb \
  mongorestore --archive --gzip --dryRun < /var/backups/justime/mongodb/<archive-name>
```

Do not delete the source database as part of backup verification. Restore procedures must use a separate target and are outside this pre-deploy gate.

## Manual database restore

Application image rollback does not restore MongoDB. A database restore is a separate destructive operation and requires all of the following before an operator proceeds:

1. An explicit approval recorded in the deployment incident or change ticket.
2. The exact backup archive and matching `.sha256` manifest selected by timestamp and deploy SHA.
3. A verified checksum and a successful `mongorestore --dryRun` against the archive.
4. A maintenance window with application writes stopped and a new safety backup of the current database retained.

Verify the approved artifact first:

```bash
cd /var/backups/justime/mongodb
sha256sum --check <archive-name>.sha256
```

After approval, stop the application services while leaving MongoDB running:

```bash
docker compose \
  --env-file deployment/homelab/.env \
  -f deployment/homelab/docker-compose.yml \
  stop frontend backend
```

Repeat the documented dry run, then perform the approved restore manually. `--drop` replaces collections present in the archive and is destructive:

```bash
docker compose \
  --env-file deployment/homelab/.env \
  -f deployment/homelab/docker-compose.yml \
  exec -T mongodb \
  sh -ec 'exec mongorestore --archive --gzip --drop --username "${MONGO_INITDB_ROOT_USERNAME:-root}" --password "${MONGO_INITDB_ROOT_PASSWORD:?MONGO_INITDB_ROOT_PASSWORD is required}" --authenticationDatabase admin' \
  < /var/backups/justime/mongodb/<archive-name>
```

Restart the application and run the normal compose readiness and business-smoke gates. No deployment or rollback script invokes `mongorestore`; the approved operator owns this procedure and its recovery decision.
