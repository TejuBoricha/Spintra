// Shared room capacity bounds — the single source of truth for the 2..50
// ceiling that the database enforces via the CHECK constraint in migration
// 0049 (`rooms_max_participants_bounds`). Consumed by the creation slider
// (create-client.tsx) and the Room Settings panel so the client UI can never
// silently drift from the DB constraint.
//
// NOTE: migration 0049 must repeat these as SQL literals (it can't import TS);
// if you change the ceiling here, change it there too — that trade-off is
// called out in ADR-007.
export const ROOM_MIN_CAPACITY = 2;
export const ROOM_MAX_CAPACITY = 50;

// Default capacity for a newly-created room (must sit within the bounds above).
export const ROOM_DEFAULT_CAPACITY = 10;
