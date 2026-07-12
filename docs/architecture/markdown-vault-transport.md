# Markdown Vault Transport and Security Contract

Status: Proposed for review

Date: 2026-07-13

Decision owners: Justime architecture and security

## Context

Justime can generate Markdown knowledge outputs that users may publish into a
Vault. The current backend implementation stores an absolute `vault_root_path`
and writes directly to the backend host filesystem. That behavior is valid only
when the configured path is server-owned storage. It cannot represent a path on
a user's Mac when the backend is remote, and a standalone browser cannot obtain
or exercise arbitrary local filesystem authority.

The macOS native application can obtain a user-approved, security-scoped
directory grant. A remote backend can write only within storage configured for
the authenticated tenant. These are distinct trust boundaries and require
distinct transport modes. A shared but ambiguous "publish to this path"
contract would allow one component to claim a filesystem result that only
another component could actually commit.

This ADR defines the product, security, consistency, and ownership contract. It
does not add an API, schema, route, workflow, or implementation.

Where this ADR conflicts with the Vault publication guidance in
`macos-native-api-contract.md`, this ADR governs transport ownership and local
filesystem claims. Existing endpoint names remain unchanged until an approved
implementation issue changes them.

## Decision

Justime supports two explicit transport modes:

- `local_native`: an authorized native client owns the final filesystem write
  under a user-selected security-scoped directory grant.
- `remote_server`: the backend owns the final filesystem write under configured,
  tenant-scoped server storage.

The backend may authenticate the request, authorize the Task and KnowledgeOutput,
and provide canonical output data in either mode. It must not claim that it
wrote native-local bytes. The component that commits the bytes to the target
filesystem is the only component permitted to issue the final publish receipt.

A standalone Web browser may use `remote_server`. It may request
`local_native` only through an authenticated, versioned native bridge that owns
the directory grant and performs the write. Without that bridge, Web must not
offer or report arbitrary local-path publication as successful.

## Decision Matrix

| Contract | `local_native` | `remote_server` |
| --- | --- | --- |
| Byte-writing owner | macOS native transport | Backend remote transport |
| Authorization | Authenticated user and Task/KnowledgeOutput ownership, plus a valid native directory grant | Authenticated user and Task/KnowledgeOutput ownership, plus tenant storage configuration |
| Filesystem root | User-selected security-scoped directory represented by a native-held grant | Administrator-configured tenant-scoped server root |
| Path interpretation | Native resolves the logical relative path beneath the granted root | Backend resolves the logical relative path beneath the tenant root |
| Atomic commit | Native temp write, flush as supported, then atomic rename/replace | Backend temp write, flush/fsync as supported, then atomic rename/replace |
| Conflict authority | Native evaluates target filesystem state after the version precondition is authorized | Backend evaluates version and target filesystem state |
| Receipt issuer | Native writer after commit; backend may record the authenticated result | Backend writer after commit |
| Retry owner | Native durable offline queue, ordered at least per output and granted root | Calling client retries the backend request using the same idempotency key |
| Cancellation boundary | Effective only before native atomic commit | Effective only before backend atomic commit |
| Browser behavior | Available only through the authenticated native bridge; no direct browser write claim | Available through the normal authenticated Web/BFF path |

Neither mode is an implicit fallback for the other. A request naming one mode
must fail with a typed, non-success result if that mode is unavailable.

## Publish Request Contract

Every publication request must carry the following fields, regardless of the
transport envelope used by a later implementation:

| Field | Contract |
| --- | --- |
| `transport_mode` | Exactly `local_native` or `remote_server`; never inferred from a path string |
| `output_id` | Stable KnowledgeOutput identifier owned by the authenticated user |
| `version` | Optimistic precondition for the source output version to publish |
| `content_digest` | Digest of the exact canonical bytes to commit, including the algorithm identifier |
| `logical_relative_path` | Normalized path relative to the authorized root; never a client-supplied server absolute path |
| `conflict_policy` | One of `overwrite`, `skip`, `backup`, or `rename` |
| `idempotency_key` | Caller-generated key stable across retries of the same logical publication |

The canonical content digest must be computed over the exact byte sequence the
writer will commit. Line-ending conversion, encoding conversion, frontmatter
generation, or any other transformation must happen before the digest is
finalized. A writer must reject bytes that do not match the authorized digest.

The backend must authorize the named `output_id` and `version` before releasing
canonical bytes or permission to publish. Native possession of a directory
grant does not replace application-level authorization.

## Publish Receipt Contract

The byte-writing component issues a final receipt only after either an atomic
commit or a deterministic no-write outcome. The receipt must contain:

| Field | Contract |
| --- | --- |
| Request identity | `output_id`, `idempotency_key`, and `transport_mode` |
| `status` | `committed`, `skipped`, `conflict`, `cancelled`, or `failed` |
| Resulting version | Authorized output version associated with the result |
| Resulting path | Logical relative path, or an opaque display-safe locator |
| Resulting digest | Digest of committed bytes, when bytes exist as a result of this request |
| Conflict outcome | Applied policy and whether the target was overwritten, skipped, backed up, or renamed |
| Commit time | Writer-recorded timestamp for a committed result |
| Retry contract | `retryable` boolean and a stable error code when not committed |

For `local_native`, the backend may receive and persist the receipt, but must not
replace it with a backend-authored filesystem success. Web-facing responses
should expose logical paths or opaque locators and must avoid raw native absolute
paths. Receipts and errors must not contain directory-grant material.

A response that only authorizes or prepares a native write is not a publish
receipt and must use a distinct non-success status such as `prepared` or
`awaiting_native_commit` in any future protocol.

## Authentication and Trust Boundaries

All publication attempts must authenticate the user and verify that the user
owns or may publish the referenced Task and KnowledgeOutput. Authorization must
be rechecked at execution time, including replay from an offline queue.

### Native Local Trust

`local_native` requires a security-scoped directory grant selected through the
native operating-system picker. The native app owns grant storage, renewal,
activation, and revocation handling. The backend receives neither the raw grant
nor authority to interpret a client-local absolute path.

The native bridge must be authenticated to the same user context as the Web or
native UI initiating publication. Its protocol must be versioned so an
unsupported bridge cannot silently degrade to a different transport.

Grant absence, expiration, revocation, or a root identity change is a typed
failure. It never triggers `remote_server` automatically.

### Remote Server Trust

`remote_server` requires an administrator-configured storage root mapped to the
authenticated tenant. The backend must derive the root from trusted server
configuration, not from a client absolute path. A tenant must not be able to
select, inspect, or traverse another tenant's root.

Existing backend-host paths are not evidence that a path belongs to a user's
local computer. Server configuration and deployment ownership remain part of
the remote trust boundary.

### Web Trust

A standalone browser has no contract for arbitrary local filesystem access. It
must not submit an arbitrary local absolute path, receive a backend-only
authorization response, and display that response as local publication success.

Web may:

- publish through `remote_server`; or
- coordinate `local_native` through the authenticated native bridge and display
  success only after receiving the native writer's final receipt.

## Path and Filesystem Security

The actual byte writer must apply all rules below to its own authorized root.
Validation performed by a non-writing component is advisory and does not replace
validation at commit time.

1. Normalize path text to Unicode NFC before collision checks and persistence.
2. Reject empty paths, absolute paths, drive-qualified paths, UNC paths, parent
   traversal, NUL bytes, and control characters that are unsafe for the target
   platform.
3. Treat path separators according to the target platform while rejecting
   alternate-separator forms that could bypass validation.
4. Resolve and inspect symlinks for every existing component and the target
   parent. Reject any resolution outside the authorized root.
5. Create missing directories without following an attacker-controlled link and
   recheck root containment immediately before the atomic commit.
6. Use a temporary file in the target filesystem, write the exact authorized
   bytes, flush and fsync when supported by the platform, then perform atomic
   rename or replace according to the conflict policy.
7. Apply restrictive defaults: directories `0700` and files `0600`, subject to
   a stricter platform or administrator policy. Do not broaden existing
   permissions as a side effect of overwrite.
8. Remove abandoned temporary files without deleting a pre-existing target.

Containment is a commit-time invariant. A lexical prefix check alone is
insufficient because symlinks and concurrent filesystem changes can redirect a
previously checked path.

## Collision and Conflict Semantics

Conflict processing is deterministic and occurs after authorization, version,
digest, path, and idempotency validation.

| Policy | Required result when the target exists |
| --- | --- |
| `overwrite` | Atomically replace the target with authorized bytes; preserve no implicit backup |
| `skip` | Perform no write and return a `skipped` receipt describing the existing-target outcome |
| `backup` | Atomically preserve the prior target under a deterministic collision-safe backup name, then commit the new target; failure to preserve the backup prevents the new commit |
| `rename` | Commit to a deterministic collision-safe alternate filename and return that logical relative path |

The naming algorithm for `backup` and `rename` must be stable within an
implementation version and must perform collision checks under the same Unicode
normalization and target-filesystem case rules. It must not overwrite an
unrelated collision candidate.

A source `version` mismatch returns `conflict` without writing bytes. Filesystem
changes between validation and commit also return a typed conflict unless the
selected policy can be completed atomically under the current state.

## Versioning, Idempotency, and Retry

The `version` field is an optimistic precondition, not metadata. The authority
for the KnowledgeOutput must compare it with the current authorized version. A
mismatch produces a non-retryable version conflict until the caller refreshes
the output and makes a new decision.

Idempotency is scoped to authenticated owner, `transport_mode`, `output_id`, and
`idempotency_key`:

- Repeating a successful request with the same canonical payload returns the
  original receipt and does not write again.
- Reusing a key with a different version, digest, logical path, or conflict
  policy returns an idempotency conflict and does not write.
- An indeterminate transport failure is retryable with the same key. The writer
  must reconcile whether commit occurred before attempting another write.

For `local_native`, the native app may maintain a durable offline queue. Queue
execution must be ordered at least per output and granted root. Replay must
revalidate authentication, Task/KnowledgeOutput ownership, directory grant,
version precondition, content digest, path containment, and current filesystem
conflicts. Offline age does not weaken any check.

For `remote_server`, clients retry against the backend with the same
idempotency key. Backend workers, if introduced, must preserve equivalent
ordering and reconciliation semantics.

## Cancellation

Cancellation succeeds only before atomic commit begins. A cancelled request
must not leave target bytes or a reported success.

Once atomic commit has completed, cancellation cannot rewrite history. The
writer returns the committed receipt even if a cancellation raced with commit.
Any later removal or rollback is a new authorized operation with its own
idempotency identity and audit record.

## Observability and Data Handling

Publication telemetry may record authenticated owner and output identifiers,
transport mode, logical operation identifier, result status, latency, retry
count, digest identifiers, conflict outcome, and stable error class.

Logs, metrics, traces, and receipts must not include:

- Markdown content or generated frontmatter;
- access or refresh tokens;
- raw security-scoped grants or bookmarks;
- sensitive native absolute paths; or
- unrestricted server absolute paths.

Operational events should use logical relative paths only when needed and
permitted; otherwise use an opaque locator or path hash suitable for correlation.

## Implementation Boundaries

This ADR enables separate follow-up issues only after review. Those issues must
use non-overlapping write scopes and must not infer ownership beyond this table.

| Follow-up | Owner and allowed implementation tree | Responsibility | Explicit exclusion |
| --- | --- | --- | --- |
| Backend remote transport | Backend owner; `justime_backend/**` | `remote_server` authorization, tenant root mapping, atomic writer, idempotency records, receipts, and backend-side validation | No native grant handling or writes into a user's local filesystem |
| Native local transport | macOS native owner; `apps/macos-native/**` | Directory picker/grant lifecycle, native bridge, offline queue, atomic local writer, reconciliation, and native receipts | No server storage writer and no backend-host path interpretation |
| Web/BFF presentation | Web owner; `justime_agent/**` | Mode selection, bridge capability detection, prepared-versus-committed UI states, and safe receipt presentation | No direct arbitrary filesystem write and no fabricated local success |

Tests belong within each owner's tree. A shared schema or cross-tree contract
file is not authorized by this ADR; a later architecture issue must assign its
ownership and write scope before one is introduced.

The follow-ups must agree on field semantics and conformance examples, but one
follow-up must not modify another owner's implementation tree. No implementation
issue may replace the two modes with an inferred environment heuristic.

## Migration

The existing backend `vault_root_path` is interpreted only as a backend-host
path. It must never be reinterpreted as a user-local path or sent to a native
client as if it were a valid directory grant.

Existing configurations may migrate to `remote_server` only after an
administrator validates and maps them to tenant-scoped server roots. Migration
must verify containment, ownership, expected permissions, and collision policy.
Ambiguous, missing, or client-local-looking configurations are disabled pending
explicit reconfiguration.

No automatic migration to `local_native` is possible because a native
security-scoped grant requires an explicit user selection on the target device.

Existing KnowledgeOutput records and their versions remain source records.
Migration of transport configuration must not imply that any historical file
was successfully published under the new receipt contract.

## Rollback

Rollback of a future implementation disables its new transport entry points
and queue execution while retaining KnowledgeOutputs, idempotency records,
receipts, and audit evidence needed to reconcile prior commits.

Rollback must not restore ambiguous local-path claims, reinterpret a server path
as a native path, or delete committed user files automatically. A writer that
cannot prove the result of an in-flight request must expose an indeterminate,
retryable reconciliation state rather than report success or perform an
unconditional duplicate write.

## Rejected Options

### One backend-host path contract for every deployment

Rejected because a remote backend cannot exercise authority over an arbitrary
path on the user's computer, and deployments do not share a filesystem trust
boundary.

### Browser direct arbitrary filesystem publication

Rejected because a standalone browser cannot reliably hold the required
arbitrary directory authority or satisfy the native grant contract.

### Upload bytes to the backend and call it local publication

Rejected because the backend would still write server storage. Transporting
content from a local UI does not make a server-side write local.

### Native client write without a scoped grant or final receipt

Rejected because filesystem authority would be unauditable and other components
could not distinguish preparation from committed bytes.

### Last-write-wins without version and idempotency

Rejected because retries, offline replay, and concurrent edits could silently
overwrite newer content or create duplicate files.

### Preserve direct backend writes as an unspecified fallback

Rejected because fallback would erase the explicit trust boundary. Direct
backend writes are permitted only as `remote_server` under validated tenant
storage.

## Consequences

The product must expose transport mode as a deliberate choice or deployment
capability. Local publication requires native participation; remote publication
requires configured server storage. The two paths can share semantic fields but
not filesystem authority.

Implementation work is larger than the current direct write because it must add
version checks, digest verification, idempotency, atomic commit, receipts,
symlink-aware containment, and mode-specific authorization. That cost is
accepted to prevent false success claims, cross-tenant writes, traversal, and
non-deterministic retry behavior.

This decision contains no unresolved trust-ownership choice. Product details
such as the exact endpoint envelope, persistence schema, digest algorithm, and
bridge protocol version belong to scoped implementation designs, provided they
preserve every invariant in this ADR.
