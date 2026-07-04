-- Migration 0017: Drop rooms.settings
--
-- Found in the Session 37 audit: always inserted as `{}` at room creation
-- and never read anywhere in the client. Dead column.

alter table public.rooms drop column if exists settings;
