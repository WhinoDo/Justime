# Security Exceptions

This document records approved exceptions for CRITICAL/HIGH vulnerabilities
identified by the Trivy scanner in CI. Each exception must be reviewed and
approved by the project architect before the corresponding CVE ID is added
to `.trivyignore`.

## Exception Process

1. **Detection** — Trivy reports a CRITICAL/HIGH vulnerability in CI and
   the `security-scan` job fails.
2. **Assessment** — The assignee evaluates the vulnerability's real-world
   impact on this project (attack surface, exploitability, data exposure).
3. **Documentation** — The assignee adds an entry to the table below with
   full justification.
4. **Approval** — The architect reviews the entry and merges the PR that
   adds the CVE ID to `.trivyignore`.
5. **Periodic Review** — Exception entries are reviewed every release cycle.
   Entries whose upstream fix is available are removed and the dependency
   is updated.

## Exception Table

| CVE ID | Package | Severity | Justification | Approved By | Date | Tracking |
|--------|---------|----------|---------------|-------------|------|----------|
| *(none yet)* | | | | | | |

## Notes

- Never add a CVE to `.trivyignore` without a corresponding row in this
  table.
- If a vulnerability is later found to be exploitable in this project's
  context, the exception must be revoked immediately and the dependency
  patched or replaced.
