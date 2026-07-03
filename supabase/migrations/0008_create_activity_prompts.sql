-- Migration 0008: Create activity_prompts table and seed standard prompts for Truth or Dare, Would You Rather, and Never Have I Ever.

create table if not exists public.activity_prompts (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null check (activity_type in ('truth-or-dare', 'would-you-rather', 'never-have-i-ever')),
  category text check (category in ('truth', 'dare')),
  prompt_data jsonb not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.activity_prompts enable row level security;

-- Anyone (authenticated or anonymous holding the anon key) can read prompts
drop policy if exists "activity_prompts_select_all" on public.activity_prompts;
create policy "activity_prompts_select_all" on public.activity_prompts for select using (true);

-- Seed Truth prompts
insert into public.activity_prompts (activity_type, category, prompt_data) values
('truth-or-dare', 'truth', '{"text": "What''s your biggest fear?"}'),
('truth-or-dare', 'truth', '{"text": "What''s the most embarrassing thing you''ve done?"}'),
('truth-or-dare', 'truth', '{"text": "What''s a secret you''ve never told anyone?"}'),
('truth-or-dare', 'truth', '{"text": "Who was your first crush?"}'),
('truth-or-dare', 'truth', '{"text": "What''s the worst lie you''ve told?"}'),
('truth-or-dare', 'truth', '{"text": "Have you ever cheated on a test?"}'),
('truth-or-dare', 'truth', '{"text": "What is the most childish thing you still do?"}'),
('truth-or-dare', 'truth', '{"text": "What''s the biggest misconception people have about you?"}');

-- Seed Dare prompts
insert into public.activity_prompts (activity_type, category, prompt_data) values
('truth-or-dare', 'dare', '{"text": "Do your best celebrity impression"}'),
('truth-or-dare', 'dare', '{"text": "Speak in an accent for the next 3 minutes"}'),
('truth-or-dare', 'dare', '{"text": "Text your crush right now"}'),
('truth-or-dare', 'dare', '{"text": "Do 10 jumping jacks"}'),
('truth-or-dare', 'dare', '{"text": "Sing a song for 30 seconds"}'),
('truth-or-dare', 'dare', '{"text": "Do a silly dance for 30 seconds"}'),
('truth-or-dare', 'dare', '{"text": "Mimic a farm animal until someone guesses what you are"}'),
('truth-or-dare', 'dare', '{"text": "Try to touch your nose with your tongue"}');

-- Seed Would You Rather prompts
insert into public.activity_prompts (activity_type, prompt_data) values
('would-you-rather', '{"a": "Be able to fly", "b": "Be invisible"}'),
('would-you-rather', '{"a": "Always be cold", "b": "Always be hot"}'),
('would-you-rather', '{"a": "Live without music", "b": "Live without movies"}'),
('would-you-rather', '{"a": "Have super strength", "b": "Have super speed"}'),
('would-you-rather', '{"a": "Travel to the past", "b": "Travel to the future"}'),
('would-you-rather', '{"a": "Explore the deep ocean", "b": "Explore outer space"}'),
('would-you-rather', '{"a": "Have 10 close friends", "b": "Have 100 acquaintances"}'),
('would-you-rather', '{"a": "Always say everything on your mind", "b": "Never speak again"}');

-- Seed Never Have I Ever statements
insert into public.activity_prompts (activity_type, prompt_data) values
('never-have-i-ever', '{"text": "Never have I ever lied to get out of trouble"}'),
('never-have-i-ever', '{"text": "Never have I ever pulled an all-nighter"}'),
('never-have-i-ever', '{"text": "Never have I ever gone skydiving"}'),
('never-have-i-ever', '{"text": "Never have I ever eaten something off the floor"}'),
('never-have-i-ever', '{"text": "Never have I ever ghosted someone"}'),
('never-have-i-ever', '{"text": "Never have I ever sung karaoke in public"}'),
('never-have-i-ever', '{"text": "Never have I ever got lost in a foreign city"}'),
('never-have-i-ever', '{"text": "Never have I ever broken a bone"}');

-- Add to Realtime replication
alter publication supabase_realtime add table public.activity_prompts;
