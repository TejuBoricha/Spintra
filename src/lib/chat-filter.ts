// Basic first-pass moderation filter: catches plain-text profanity/slurs and
// obvious spam patterns. Deliberately not exhaustive and easy to bypass with
// spacing or leetspeak — a lightweight deterrent, not a robust moderation
// system. Extend PROHIBITED_WORDS as needed, or swap in a third-party
// moderation service for production-grade filtering.
const PROHIBITED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "piss",
  "slut", "whore", "faggot", "nigger", "nigga", "retard", "rape",
];

// Leading word boundary only (no trailing \b) so inflections like "fucking"
// or "shitty" are still caught, not just the exact bare word.
const PROHIBITED_PATTERN = new RegExp(
  `\\b(${PROHIBITED_WORDS.join("|")})`,
  "i"
);

// Same character repeated 7+ times in a row (e.g. "aaaaaaaa", "!!!!!!!!").
const SPAM_REPEATED_CHAR_PATTERN = /(.)\1{6,}/;

export function getChatContentViolation(text: string): string | null {
  if (SPAM_REPEATED_CHAR_PATTERN.test(text)) {
    return "Message looks like spam (too many repeated characters).";
  }
  if (PROHIBITED_PATTERN.test(text)) {
    return "Message contains inappropriate language.";
  }
  return null;
}
