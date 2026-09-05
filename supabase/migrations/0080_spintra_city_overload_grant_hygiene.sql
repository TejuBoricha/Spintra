-- Spintra City — closes a grant-hygiene gap this fix phase itself introduced
-- in migrations 0077 and 0079. Migrations are append-only.
--
-- CREATE OR REPLACE FUNCTION does NOT edit a function in place when the new
-- definition adds parameters, even trailing ones with defaults -- Postgres
-- resolves overloads by the exact declared parameter type list, and a
-- longer list is a genuinely different signature, hence a genuinely new
-- pg_proc row with its own OID. The OLD (shorter) signature is left behind,
-- untouched (still correctly revoked, just now dead and unreachable, since
-- every call site in this codebase already passes the new arguments). The
-- NEW signature is a function Postgres has just created from scratch, and
-- Postgres grants EXECUTE to PUBLIC by default on function creation -- the
-- same trap 0052's `_record_award` comment already documented for this
-- exact codebase, and the same one 0074 had to catch for
-- `city_retire_seat_on_departure`. This is that trap's third occurrence,
-- just via a different mechanism (added parameters instead of a plain new
-- function): 0077 added two defaulted parameters to
-- `city_assert_can_manage`, and this migration's own 0079 added two more to
-- `city_resolve_landing` -- both landed a second, publicly-executable
-- overload that neither migration's own REVOKE statements (written against
-- the OLD signature) touched.
--
-- Confirmed both were genuinely exploitable as found, not merely
-- theoretical: `city_resolve_landing` does not check `auth.uid()` at all
-- (by design -- it is meant to be invoked only from already-authenticated,
-- already-locked callers like city_roll_dice), so a client able to reach
-- the new 6-argument overload directly could call it for an arbitrary
-- match/seat/space with an attacker-chosen `p_rent_multiplier` or
-- `p_flat_rent_multiplier`, charging (or crediting, via a negative value)
-- any amount to any seat, with none of city_roll_dice's turn/lock/rate-limit
-- checks in the way. `city_assert_can_manage`'s new overload was a narrower
-- information-disclosure risk (it performs no writes) but the same shape of
-- mistake: trusts a bare `p_user_id` argument with no `auth.uid()` check of
-- its own, exactly because it was designed to be an internal helper other
-- SECURITY DEFINER functions call after establishing identity themselves.
--
-- Fixed by dropping the now-dead old-signature overloads outright (nothing
-- in this codebase calls them anymore, and leaving revoked-but-unreachable
-- dead code around is its own source of confusion) and explicitly revoking
-- the new ones, matching every other internal helper's grant posture.
--
-- `city_settle_auction`'s two overloads are NOT part of this bug -- that is
-- 0071's own deliberate, already-correct fix shape (the 2-arg `p_force`
-- form is a genuinely different, dropped-and-revoked signature; the 1-arg
-- form is a new wrapper deliberately granted to clients), not an artifact
-- of this trap. A regression-harness assertion is added that checks the
-- full city_* function surface for this pattern generally, not just these
-- two functions, so a future migration that adds parameters the same way
-- fails loudly instead of shipping quietly.

drop function if exists public.city_assert_can_manage(uuid, text);
drop function if exists public.city_resolve_landing(uuid, integer, integer, integer);

revoke all on function public.city_assert_can_manage(uuid, text, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.city_resolve_landing(uuid, integer, integer, integer, integer, integer)
  from public, anon, authenticated;
