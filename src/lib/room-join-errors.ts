/**
 * What to tell someone whose join was refused by the database, from the error text it raised.
 * The raw text cannot be matched on the word "limit": a rate limit ("Rate limit exceeded: you
 * can join up to 20 rooms every 10 minutes...") also contains it, and was reported as "This room
 * has reached its participant limit" (audit R-8).
 */
export function joinErrorMessage(dbMessage: string): string {
  if (/banned/i.test(dbMessage)) return "You have been banned from this room by the host.";
  const rate = dbMessage.match(/rate limit exceeded:\s*(.+)$/i);
  if (rate) {
    // The database's own wording says what the limit is and to wait; just make it a sentence.
    const text = rate[1].trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (/participant limit|room is full/i.test(dbMessage)) return "This room has reached its participant limit.";
  return "Unable to join room.";
}
