# Actual initial CI checkpoint — run 46014620091, attempt 1

Tested revision: `8b89ec6439eb1c2d01377a39056265e1e2079008`.
[Actual run](https://github.com/gmcnicol/DeclareFX/actions/runs/46014620091),
[full matrix and limitations](../../proof-evidence.md).
This is historical evidence for that revision, **not** CI evidence for the later
final-review compiler fix. No EEL2/REAPER execution is represented.

## Compact durable contents

These files preserve genuine downloaded API/artifact data, not reconstructed
runner output:

- `run.json`, `jobs.json`, `artifacts.json`: original completed Actions API
  responses, including exact SHA, attempt, job/step conclusions, artifact IDs,
  sizes, service digests and expiry.
- `artifact-download-verification.json`: merger's machine-generated archive
  verification record. Each independently hashed raw downloaded ZIP equals its
  service-reported SHA-256. Absolute paths are historical collection provenance,
  not required locations for using this committed snapshot.
- `platform-evidence-summary.json`: merger's machine-generated summary containing
  the three **complete original** `reproducibility/result.json` objects, actual
  environments/commands/exits, test/vendor counts and gate-log hashes. During the
  final fix pass every embedded report was compared to its downloaded original,
  counts re-read from actual logs, and all hashes independently checked.
- `inputs.json`, `dist.json`: unmodified downloaded Linux manifests, shared only
  after verifying all three input manifests and all six dist manifests are
  byte-identical (31 input files, 15 emitted files). These describe the initial
  tested revision; they are not the current compiler's dist hashes.
- `matrix-comparison.log`: unmodified downloaded comparison-job output.
- `setup-{linux,darwin,win32,comparison}.log`: small original setup-step logs
  preserving actual runner/OS product/image versions. Evidence is excluded from
  Git newline normalization so the Windows log's original CRLF bytes survive.
- `download-SHA256SUMS`: original merger's 177-file collection inventory, including
  raw archives, full Actions logs and expanded artifacts. All 177 were verified
  again during the final fix pass. Paths refer to that original collection;
  omitted full files are **not** claimed to be present here.
- `SHA256SUMS`: integrity inventory for this compact committed snapshot (excluding
  itself). Verify from this directory with `sha256sum -c SHA256SUMS`.

Live API rechecks during the fix pass confirmed the exact SHA, completed success,
all four jobs/all steps successful, and the four artifact service digests. ZIP
sizes/digests and every expanded artifact byte were checked against the raw ZIPs.
The six generated files matched the committed 22,103-byte golden completely.
The original full collection is a machine-local coordinator handoff under
`/tmp/declarefx-implementation/ticket-14-merge-evidence/`, not durable storage.

## Retention and scope

GitHub's 90-day artifacts expire **2027-02-25T14:17:42Z**; Actions logs may also
expire/be deleted. This small Git snapshot preserves actual facts, original
reports/manifests and hashes independently of `/tmp` or expiring URLs. It does
not preserve full binary ZIPs, full runner logs, duplicated generated goldens,
vendor bytes or every build input. The tested Git revision supplies source and
golden bytes; coordinator must separately archive the full downloads before
expiry if full raw replay/audit is required. Hashes are integrity records, not
signatures or a claim that absent raw logs can be recovered from their hashes.

The reproducibility script's explicit build-input inventory excludes `docs/`,
including this evidence. Documentation archival is not a compiler build input.
