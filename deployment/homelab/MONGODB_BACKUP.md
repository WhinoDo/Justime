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
