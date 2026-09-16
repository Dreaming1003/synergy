# Decision Record: Pack Agent evidence and legacy recovery bytes

Status: implemented

## Problem

Rollout checkpoints preserve small binary fragments, chunk references and journal observations. Millions of independently allocated files consume much more space than their content. A file-for-file backup repeats that allocation overhead, and a per-file SQL import ledger adds another large index before originals can be retired. The transactional authority decision remains applicable; migration and binary storage need bounded physical representations without discarding historical evidence.

## Decision

Keep transactional SQL authority and independently addressable records. Namespace format 2 optionally compresses larger record bodies and batches records with their import checkpoint. Generic rowid tables and existing key/index definitions remain intact. Binary evidence moves into immutable raw/gzip blocks with SQL locators, bounded per-owner append packs and hash verification. Bytes become durable before references; deletion intents and startup orphan discovery collect whole unreferenced packs. A filesystem lease protects verification snapshots from collection.

Legacy backup format 2 groups at most 1,024 files or approximately 4 MiB of logical content and metadata. Each group contains a compressed inventory and independently encoded file bodies, with streamed raw files above 2 MiB. A durable descriptor follows each chunk; the final manifest seals descriptor hashes and totals. An import checkpoint covers up to 256 entries and commits with records and locators. Immutable backup chunks are hard-linked into canonical artifact storage on the same filesystem, avoiding another byte copy. Original authority files are retired only after database and artifact verification. Interrupted version 1 imports retain their importer, then run the registered binary migration.

Binary evidence has no new 32 MiB product limit: historical writers accepted larger objects. Only compressed blocks carry that bound; larger writes and legacy blobs use raw blocks with safe byte offsets and streaming verification. A single raw object may exceed the 64 MiB pack rotation target. Quarantining otherwise valid large evidence would silently reduce the available history, so both JSON-authority and existing-SQL upgrades preserve and independently restore these objects.

The record codec follows the same compatibility rule: the 128 MiB bound limits compressed expansion, while larger JSON bodies keep their plain representation and remain subject to existing engine admission limits. Adding compression must not reject an otherwise accepted plain record.

The capacity budget includes backup content and metadata, SQL overhead, journals, owner migrations and recovery reserve without crediting future deletion. Phase checks stop before consuming the reserve. The SQL per-record allowances are estimates to calibrate against actual data, not guaranteed upper bounds. Measurements distinguish logical bytes, allocated blocks and unique file identities. Restoration verifies into a new staged Home and publishes only after the final inventory validates.

## Alternatives considered

**Keep loose evidence and per-file backups.** This preserves simple file inspection but repeats minimum filesystem allocation and requires millions of durable publications and ledger rows.

**Store binary bodies in the authority database.** This would avoid artifact files but inflate engine backup, transfer and journal work, and couple large evidence lifetime to the record engine. Dedicated locators keep both SQLite and PostgreSQL on the same logical model.

**Compress each backup group as one stream.** A small artifact read would repeatedly decode the whole group. Independent frames preserve bounded direct reads while sharing group metadata and allocation.

**Rewrite every SQL table with WITHOUT ROWID and shorter keys.** A synthetic 49,700-record layout experiment increased a vacuumed database from 123,367,424 to 187,547,648 bytes when both generic tables used WITHOUT ROWID, because large record bodies needed overflow pages. Compact nodes, shorter hashes and sparse indexes showed separate benefits but require their own migration and query analysis. They are excluded from this change; their experimental sizes are not claimed as deployed savings.

**Delete evidence during import or vacuum during the migration peak.** Early deletion weakens independent recovery; full-database rewriting adds another large temporary allocation. The importer retains originals until activation and does not require vacuum.

## Consequences

Small files share allocation and backup descriptors, while Rollout journals and retained snapshots preserve their content. SQL format 1 remains upgrade input and plain JSON remains a valid format 2 encoding; older writers cannot reopen the upgraded namespace. Portable version 2 carries locators and version 1 remains readable. Normal binary operations have one current path.

Compression adds CPU work. Partially live packs retain dead ranges, and a retained backup continues to hold shared chunks after canonical references disappear. Backups therefore need an explicit retention policy rather than automatic deletion during migration. Corruption stops activation or restore and remains visible. The storage, transfer, long-stream and released-upgrade suites exercise resumability, deletion fencing, corruption, SQLite/PostgreSQL parity and byte reconstruction.

Artifact replacement probes use the existing namespace/key index. In an unanalyzed SQLite namespace, adding `DISTINCT` to the old-pack lookup caused a namespace-wide scan through the pack index for every batch, making a large import progressively slower. The collection-intent primary key already deduplicates packs through `ON CONFLICT DO NOTHING`; removing the redundant query-level deduplication restores point seeks without another index. The query-plan regression executes the public replacement path and checks shared-pack collection semantics.

The implemented schema uses 88,641,536 bytes after vacuum on the same synthetic layout fixture, with an identical logical key/value/revision digest. A separate private-data pilot of 11 Session aggregates migrated 102,905 files, including 24,100 binary artifacts, in 76 seconds. With the complete recovery backup retained and hard links counted once, allocated bytes fell from 626,978,816 to 425,304,064; sampled additional allocation peaked at 425,271,296 bytes. These local macOS measurements establish the tested implementation's behavior, not a universal compression ratio or a full-Home capacity guarantee.

See [Agent storage](../../../architecture/agent-storage.md) and the [transactional authority decision](2026-09-14-transactional-agent-authority.md) for the underlying transaction and ownership model.
