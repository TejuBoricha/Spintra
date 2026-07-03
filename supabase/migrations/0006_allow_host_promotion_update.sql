-- Spintra: Allow promotion of a participant to host if the current host is offline/left.

drop policy if exists "rooms_update" on public.rooms;

create policy "rooms_update" on public.rooms
  for update using (
    host_id = auth.uid()::text 
    or (
      exists (
        select 1 from public.room_participants 
        where room_id = code 
          and user_id = auth.uid()::text
      ) 
      and not exists (
        select 1 from public.room_participants 
        where room_id = code 
          and role = 'host' 
          and is_online = true
          and user_id <> auth.uid()::text
      )
    )
  )
  with check (
    host_id = auth.uid()::text 
    or (
      exists (
        select 1 from public.room_participants 
        where room_id = code 
          and user_id = auth.uid()::text
      ) 
      and not exists (
        select 1 from public.room_participants 
        where room_id = code 
          and role = 'host' 
          and is_online = true
          and user_id <> auth.uid()::text
      )
    )
  );
