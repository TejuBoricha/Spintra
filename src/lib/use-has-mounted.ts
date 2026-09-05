"use client";

import { useSyncExternalStore } from "react";

// Shared by navbar.tsx's theme toggle and whats-new-dialog.tsx's
// hydration-guarded badge — both need to know "has this hydrated on the
// client yet" without setState-in-an-effect, which trips this repo's React
// Compiler lint rule (react-hooks/set-state-in-effect). A no-op-subscription
// useSyncExternalStore is the established workaround; a review pass found it
// had been copy-pasted byte-for-byte into both files instead of shared.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
