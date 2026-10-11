// The crash page's CSS, kept apart from global-error.tsx so a test can read it without rendering JSX.
// See the comment in global-error.tsx for why it is literal colours with no site CSS variables.
export const GLOBAL_ERROR_CSS = `
  :root { color-scheme: light dark; --bg: #f6f1ef; --fg: #14120f; --muted: #55524a; --card: #ffffff; --edge: rgba(195, 49, 56, 0.35); }
  @media (prefers-color-scheme: dark) { :root { --bg: #010105; --fg: #fbf5f0; --muted: #b4b6bf; --card: #0d0e12; --edge: rgba(228, 60, 32, 0.5); } }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; }
  .ge-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box; }
  .ge-card { max-width: 28rem; width: 100%; padding: 2rem; border-radius: 1.5rem; border: 1px solid var(--edge); background: var(--card); text-align: center; box-sizing: border-box; }
  .ge-card h1 { font-size: 1.5rem; font-weight: 900; margin: 0 0 0.5rem; }
  .ge-card p { color: var(--muted); font-size: 0.875rem; line-height: 1.6; margin: 0 0 1.5rem; }
  .ge-btn { width: 100%; height: 2.75rem; border-radius: 9999px; font-weight: 700; font-size: 1rem; font-family: inherit; border: none; cursor: pointer; background: linear-gradient(to right, #e2f72a, #eefb6e); color: #0c0d05; }
  .ge-btn:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
`;
