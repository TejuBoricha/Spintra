import type { KeyboardEvent } from "react";

/**
 * True while a key press belongs to an input method (Japanese, Chinese, Korean). Enter confirms the composition and
 * Escape cancels it, so neither is the field's own submit or cancel: acting on it sends or saves a half-typed word.
 * Safari delivers the confirming keydown after compositionend, with isComposing already false but keyCode 229, so both
 * are checked.
 */
export function isImeKey(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}
