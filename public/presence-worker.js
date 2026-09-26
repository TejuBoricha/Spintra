// Ticks for the room heartbeat (use-room-subscription.ts). Browsers slow a
// hidden tab's own timers to about once a minute, which would let the server
// count a player who only switched tabs as gone; a worker's timers keep time.
let timer = null;
self.onmessage = (event) => {
  clearInterval(timer);
  const intervalMs = event.data && event.data.intervalMs;
  if (intervalMs) timer = setInterval(() => self.postMessage("beat"), intervalMs);
};
