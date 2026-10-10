import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

// UX audit (7 Oct 2026), U-01 and U-02, kept from coming back: Tailwind's `outline-none` removes the browser's
// focus outline, so a control that sets it and draws nothing in its place is invisible to a keyboard user. The
// code review of the accessibility wave found three more of them after the Tab test had passed (the skip link,
// the six room-code boxes, the wheel's rename field) because the Tab test only visits what is on screen at load.
// This reads the source, so it covers dialogs, open editors and anything else a page load does not reach.
//
// Two rules, one per direction, applied to every quoted class list in src:
//  1. A list that removes the outline (`outline-none` / `outline-hidden`, with or without a `focus:`, `md:` ...
//     prefix) must draw a replacement for focus: a ring of a real width (`focus-visible:ring-2`, `focus:ring-1`;
//     not `ring-0` or `ring-offset-*`, which draw nothing), a `focus-visible:outline-*` that is not none, or, for
//     a menu or listbox item, a filled row (`focus:bg-accent`).
//  2. A list that draws a ring of its own on focus must remove the outline, or the global rule draws a second
//     ring around it (two concentric indicators).
// The popups below receive focus from code (a dialog or a menu moving focus into itself) and the page's <main>
// is the skip link's target (tabindex -1); none of them is a control a person tabs to.
// Limits: a class list split across several strings (a `cn()` call with a conditional) is judged string by string,
// and a list written over several lines is not seen. Both fail safe for rule 1 (a replacement in another string
// is reported, so merge it) and are covered by the Tab test in ux-keyboard.spec.ts for what is on a page.

const SRC = path.join(__dirname, '..', 'src');
const POPUPS = new Set(['components/ui/dialog.tsx', 'components/ui/dropdown-menu.tsx', 'components/ui/popover.tsx']);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
  });
}

const REMOVES_OUTLINE = /(?:^|:)outline-(?:none|hidden)$/;
const DRAWS_RING = /^(?:[^\s:]+:)*(?:focus-visible|focus|has-focus-visible):ring(?:-[1-9]\d*|-\[\d[^\]]*\])?$/;
// A menu or listbox item shows the keyboard position by filling its row (focus:bg-accent), not by a ring.
const DRAWS_FILL = /^(?:[^\s:]+:)*(?:focus|focus-visible|data-highlighted):bg-\S+$/;
const DRAWS_OUTLINE = /^(?:[^\s:]+:)*focus-visible:outline-(?!none$|hidden$)\S+$/;
// <main id="main-content" tabIndex={-1}>, the skip link's target: file and exact class list, nothing broader.
const PROGRAMMATIC_TARGETS = [{ file: 'app/layout.tsx', classes: 'min-h-screen pt-[6rem] outline-none' }];

test('outline-none always comes with a focus ring of its own, and a focus ring always with outline-none', () => {
  const missingRing: string[] = [];
  const doubleIndicator: string[] = [];
  let removals = 0;
  let ringLists = 0;
  for (const file of sourceFiles(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (POPUPS.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    // Every quoted string on one line (a class list is one); a string with neither token is skipped at once.
    for (const match of text.matchAll(/(["'`])((?:(?!\1)[^\n\\])*)\1/g)) {
      const tokens = match[2].split(/\s+/);
      const removes = tokens.some((token) => REMOVES_OUTLINE.test(token));
      const ring = tokens.some((token) => DRAWS_RING.test(token));
      if (ring) ringLists++;
      if (!removes && !ring) continue;
      const line = text.slice(0, match.index).split('\n').length;
      const shown = `${rel}:${line}: ${match[2].trim().slice(0, 90)}`;
      if (removes) {
        removals++;
        if (PROGRAMMATIC_TARGETS.some((target) => target.file === rel && target.classes === match[2].trim())) continue;
        if (!ring && !tokens.some((token) => DRAWS_OUTLINE.test(token) || DRAWS_FILL.test(token))) missingRing.push(shown);
      } else {
        doubleIndicator.push(shown);
      }
    }
  }
  expect(removals, 'the scan found the outline-none class lists (a pattern that matches nothing would pass)').toBeGreaterThan(8);
  expect(ringLists, 'the scan found the class lists that draw a ring (a pattern that matches nothing would pass)').toBeGreaterThan(8);
  expect(missingRing, 'outline-none with no focus ring in its place').toEqual([]);
  expect(doubleIndicator, 'a focus ring without outline-none (the global outline would draw a second ring)').toEqual([]);
});
