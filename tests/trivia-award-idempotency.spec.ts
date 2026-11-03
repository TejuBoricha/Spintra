import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration(test);

// Migration 0115 (audit G-3, server half):
// room_scores was unique on (room_id, user_id, activity_type, round_key, award_kind).
// For trivia the award kind is "win" or "participation", so two answers could both score.
// Migration 0115 takes a transaction advisory lock and guards duplicate awards per question.

test('migration 0115 exists, guards trivia awards, and revokes public execute', () => {
  const mig = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0115_trivia_one_award_per_question.sql'), 'utf-8');
  expect(mig).toContain('create or replace function public._record_award');
  expect(mig).toContain("p_activity_type = 'trivia'");
  expect(mig).toContain('pg_advisory_xact_lock');
  expect(mig).toContain("hashtext('trivia-award:' || p_room_id || ':' || p_user_id || ':' || p_round_key)");
  expect(mig).toContain('select 1 from public.room_scores');
  expect(mig).toContain('return false;');
  expect(mig).toContain('revoke execute on function public._record_award');
});
