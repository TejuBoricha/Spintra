-- Spintra: Allow the host of a room to update room_participants rows (e.g. marking crashed users offline).
drop policy if exists "participants_update" on public.room_participants;

create policy "participants_update" on public.room_participants
  for update using (
    user_id = auth.uid()::text 
    or exists (
      select 1 from public.rooms 
      where code = room_id 
        and host_id = auth.uid()::text
    )
  ) with check (
    user_id = auth.uid()::text 
    or exists (
      select 1 from public.rooms 
      where code = room_id 
        and host_id = auth.uid()::text
    )
  );
