# Decision Record: Storage bootstrap participates in managed startup progress

Status: implemented

## Problem

An existing installation can spend longer than the ordinary Desktop health deadline scanning and importing legacy storage before the domain migration runner starts. Successful bootstrap work needs observable progress while HTTP admission is closed.

## Decision

The public startup framing includes aggregate storage stages with increasing step identifiers, item counts and byte counts. Storage bootstrap reports preparation, inventory scanning, backup, inventory publication, owner validation, import, verification, activation and legacy-writer checks. Runtime forwards these events independently of domain migration and execution recovery reporters. The managed server bounds emission frequency while preserving stage transitions.

Built-in CLI commands dispatch without loading unrelated plugin command metadata. Their startup and offline recovery paths remain callable while storage is importing; root help and plugin dispatch still discover and validate plugin namespaces.

Desktop renews the existing five-minute inactivity deadline only for advancing storage work or a new step. Storage completion restores the ordinary health deadline. Domain migrations and storage activation can alternate before execution recovery starts; stale storage output cannot reopen completed recovery.

## Alternatives considered

**Increase the ordinary health timeout.** A fixed larger timeout still fails on sufficiently large installations and delays diagnosis when startup actually stalls.

**Report only backup and import counts.** Initial inventory, owner checks and activation can each exceed the ordinary deadline, so reporting only the main copy loop leaves gaps.

**Reuse execution-recovery records.** Execution recovery follows domain migrations; conflating the stages weakens stale-progress rejection and presents misleading status.

## Consequences

The startup schema gains a storage variant, and consumers must understand its ordering. Payloads contain no paths or record contents. Reporting observes work without changing migration checkpoints, backup contents or activation policy. Progress tests cover real legacy fixtures and Desktop deadline transitions.
