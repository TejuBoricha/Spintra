-- Migration 0022: Support the Explore page's actual query pattern
--
-- Found in the Session 41 production-readiness audit: the Explore page
-- filters `is_public = true` and orders by `created_at desc`, but no index
-- covers that pattern — only `(host_id, created_at)` (migration 0011, for
-- the rate-limit trigger) existed. As room count grows, this query degrades
-- from an index scan to a full sequential scan plus sort. Partial index
-- (`where is_public = true`) since most rooms are expected to be private and
-- this only needs to be fast for the public subset Explore actually reads.

create index if not exists rooms_is_public_created_at_idx
  on public.rooms (is_public, created_at desc)
  where is_public = true;
