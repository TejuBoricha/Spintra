-- Migration 0010: Create trivia_questions and seed questions, and add word-scramble prompts to activity_prompts.

-- 1. Modify activity_prompts constraints to allow 'word-scramble' activity type
alter table public.activity_prompts drop constraint if exists activity_prompts_activity_type_check;
alter table public.activity_prompts add constraint activity_prompts_activity_type_check check (activity_type in ('truth-or-dare', 'would-you-rather', 'never-have-i-ever', 'word-scramble'));

-- 2. Seed word-scramble prompts
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "PUZZLE"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "GALAXY"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "WIZARD"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "CASTLE"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "DRAGON"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "PLANET"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "GUITAR"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "FOREST"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "ISLAND"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "ROCKET"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "TROPHY"}');
insert into public.activity_prompts (activity_type, prompt_data) values ('word-scramble', '{"word": "CANDLE"}');

-- 3. Create trivia_questions table
create table if not exists public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  options jsonb not null,
  correct_index integer not null,
  category text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.trivia_questions enable row level security;

-- Setup policy
drop policy if exists "trivia_questions_select_all" on public.trivia_questions;
create policy "trivia_questions_select_all" on public.trivia_questions for select using (true);

-- Add to Realtime replication
alter publication supabase_realtime add table public.trivia_questions;

-- 4. Seed trivia questions
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the chemical symbol for Gold?', '["Go","Gd","Au","Ag"]', 2, 'Science & Nature', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How many bones are there in an adult human body?', '["106","206","306","406"]', 1, 'Science & Nature', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which organelle is known as the powerhouse of the cell?', '["Nucleus","Ribosome","Mitochondria","Golgi Apparatus"]', 2, 'Science & Nature', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which gas makes up the majority of Earth''s atmosphere?', '["Oxygen","Carbon Dioxide","Nitrogen","Hydrogen"]', 2, 'Science & Nature', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the approximate speed of light in a vacuum?', '["186,000 miles per second","300,000 miles per second","150,000 miles per second","250,000 miles per second"]', 0, 'Science & Nature', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which planet in our solar system is the hottest?', '["Mercury","Venus","Mars","Jupiter"]', 1, 'Science & Nature', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the atomic number of Hydrogen?', '["1","2","3","4"]', 0, 'Science & Nature', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What type of electromagnetic radiation has the shortest wavelength?', '["X-rays","Gamma rays","Ultraviolet rays","Radio waves"]', 1, 'Science & Nature', 'hard');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which element is the most abundant in the Earth''s crust by weight?', '["Silicon","Iron","Oxygen","Aluminum"]', 2, 'Science & Nature', 'hard');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How many chambers are there in a human heart?', '["2","3","4","5"]', 2, 'Science & Nature', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the capital of France?', '["Berlin","Madrid","Paris","Rome"]', 2, 'Geography', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the largest ocean on Earth?', '["Atlantic Ocean","Indian Ocean","Arctic Ocean","Pacific Ocean"]', 3, 'Geography', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which river is the longest in the world?', '["Amazon River","Nile River","Yangtze River","Mississippi River"]', 1, 'Geography', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the smallest country in the world by land area?', '["Monaco","San Marino","Vatican City","Liechtenstein"]', 2, 'Geography', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which desert is the largest hot desert in the world?', '["Gobi Desert","Kalahari Desert","Sahara Desert","Arabian Desert"]', 2, 'Geography', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the highest mountain peak in the world?', '["K2","Mount Kilimanjaro","Mount Everest","Mount Denali"]', 2, 'Geography', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which country has the largest land area?', '["Canada","China","United States","Russia"]', 3, 'Geography', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which African country has the largest population?', '["Egypt","Nigeria","Ethiopia","South Africa"]', 1, 'Geography', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('In which country is the tallest building, the Burj Khalifa, located?', '["Saudi Arabia","Qatar","United Arab Emirates","Singapore"]', 2, 'Geography', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which European capital city is built on 14 islands?', '["Amsterdam","Venice","Stockholm","Copenhagen"]', 2, 'Geography', 'hard');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who painted the Mona Lisa?', '["Vincent van Gogh","Leonardo da Vinci","Pablo Picasso","Claude Monet"]', 1, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who wrote the play ''Romeo and Juliet''?', '["Charles Dickens","William Shakespeare","Jane Austen","Mark Twain"]', 1, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('In which year did the Titanic sink?', '["1908","1912","1916","1920"]', 1, 'History', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who was the first President of the United States?', '["Thomas Jefferson","John Adams","George Washington","Benjamin Franklin"]', 2, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which ancient empire built the Colosseum in Rome?', '["Grecian Empire","Roman Empire","Byzantine Empire","Egyptian Empire"]', 1, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who was the first person to walk on the moon in 1969?', '["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","Michael Collins"]', 2, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('In which year did World War II end?', '["1918","1939","1941","1945"]', 3, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who was the prime minister of Great Britain during most of World War II?', '["Neville Chamberlain","Winston Churchill","Clement Attlee","Anthony Eden"]', 1, 'History', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which country gifted the Statue of Liberty to the United States in 1886?', '["Great Britain","France","Spain","Germany"]', 1, 'History', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What was the name of the first artificial Earth satellite, launched by the USSR in 1957?', '["Vostok 1","Sputnik 1","Soyuz 1","Explorer 1"]', 1, 'History', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which film won the very first Academy Award for Best Picture?', '["Metropolis","Sunrise","Wings","The Jazz Singer"]', 2, 'Pop Culture', 'hard');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How many members were in the legendary band The Beatles?', '["3","4","5","6"]', 1, 'Pop Culture', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which streaming network produced the hit series ''Stranger Things''?', '["Hulu","HBO Max","Disney+","Netflix"]', 3, 'Pop Culture', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the name of the fictional kingdom in Disney''s ''Frozen''?', '["Corona","Arendelle","DunBroch","Genovia"]', 1, 'Pop Culture', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who played Jack Dawson in the 1997 film ''Titanic''?', '["Brad Pitt","Johnny Depp","Leonardo DiCaprio","Matt Damon"]', 2, 'Pop Culture', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which pop singer is known as the ''King of Pop''?', '["Prince","Elvis Presley","Michael Jackson","Freddie Mercury"]', 2, 'Pop Culture', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the highest-grossing film of all time (unadjusted for inflation)?', '["Avengers: Endgame","Avatar","Titanic","Star Wars: The Force Awakens"]', 1, 'Pop Culture', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How many seasons of the popular sitcom ''Friends'' were produced?', '["8","9","10","12"]', 2, 'Pop Culture', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which Marvel superhero has a shield made of vibranium?', '["Iron Man","Thor","Captain America","Black Panther"]', 2, 'Pop Culture', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What is the name of the island where Jurassic Park is located?', '["Isla Nublar","Isla Sorna","Isla de la Juventud","Isla Tortuga"]', 0, 'Pop Culture', 'hard');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How many players are on a standard soccer team on the field at one time?', '["9","10","11","12"]', 2, 'Sports', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which country won the first FIFA World Cup in 1930?', '["Brazil","Argentina","Uruguay","Italy"]', 2, 'Sports', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('In which sport are the terms ''love'', ''deuce'', and ''service'' used?', '["Badminton","Tennis","Table Tennis","Squash"]', 1, 'Sports', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Who holds the record for the most Olympic gold medals won in history?', '["Usain Bolt","Larisa Latynina","Michael Phelps","Carl Lewis"]', 2, 'Sports', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How many rings are there on the official Olympic flag?', '["4","5","6","7"]', 1, 'Sports', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which NBA player is famously nicknamed ''Air Jordan''?', '["Kobe Bryant","LeBron James","Michael Jordan","Shaquille O''Neal"]', 2, 'Sports', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('What are the two national sports of Canada?', '["Ice Hockey and Lacrosse","Ice Hockey and Baseball","Curling and Lacrosse","Ice Hockey and Rugby"]', 0, 'Sports', 'hard');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('How long is a standard marathon race in miles?', '["20 miles","26.2 miles","31 miles","13.1 miles"]', 1, 'Sports', 'medium');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('In golf, what is the term for scoring one stroke under par on a hole?', '["Bogey","Eagle","Birdie","Albatross"]', 2, 'Sports', 'easy');
insert into public.trivia_questions (text, options, correct_index, category, difficulty) values ('Which country has won the most FIFA World Cups?', '["Germany","Italy","Argentina","Brazil"]', 3, 'Sports', 'easy');
