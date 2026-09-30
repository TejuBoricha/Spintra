import { test, expect } from '@playwright/test';
import { joinErrorMessage } from '../src/lib/room-join-errors';

// Audit R-8: a join refused by a RATE limit was reported as "This room has reached its
// participant limit", because the message was classified by the word "limit". These are the
// real messages the database raises (supabase/migrations).

test('a full room is reported as full', () => {
  expect(joinErrorMessage('This room has reached its maximum participant limit of 30')).toBe(
    'This room has reached its participant limit.'
  );
});

test('a rate limit is reported as a rate limit, with the database\'s own explanation, not as a full room', () => {
  const msg = joinErrorMessage('Rate limit exceeded: you can join up to 20 rooms every 10 minutes. Please wait before joining another room.');
  expect(msg).toBe('You can join up to 20 rooms every 10 minutes. Please wait before joining another room.');
  expect(msg).not.toMatch(/participant limit/i);
  // The participant-update limit and the others read the same way.
  expect(joinErrorMessage("Rate limit exceeded: too many updates to this room's participants. Please slow down.")).toBe(
    "Too many updates to this room's participants. Please slow down."
  );
});

test('a banned player and anything unknown keep their messages', () => {
  expect(joinErrorMessage('You are banned from this room')).toBe('You have been banned from this room by the host.');
  expect(joinErrorMessage('permission denied for table room_participants')).toBe('Unable to join room.');
  expect(joinErrorMessage('')).toBe('Unable to join room.');
});
