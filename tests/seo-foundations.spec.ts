import { test, expect, type APIRequestContext } from '@playwright/test';
import { GAMES } from '../src/lib/games';
import { jsonLdScript } from '../src/lib/site-metadata';

// 7 Oct 2026: searching "spintra dice" showed Google correcting "spintra" to "spinner" and
// an AI overview defining it as a Roman token, so the site was not being found by its own
// name. Checked on the live site: the home page had no canonical, nothing said who "Spintra"
// is (only a WebApplication entry), and the sitemap had no lastmod to tell crawlers which
// pages changed. These tests pin the fixes against the running app.

const SITE = 'https://spintra.io';
const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));

type LdNode = {
  '@type'?: string;
  '@id'?: string;
  '@graph'?: LdNode[];
  name?: string;
  url?: string;
  alternateName?: string;
  publisher?: { '@id'?: string };
  logo?: { url: string };
};

async function html(request: APIRequestContext, path: string) {
  const res = await request.get(path);
  expect(res.status(), `${path} should load`).toBe(200);
  return res.text();
}
/** The value of `attr` inside the first tag of `tag` whose attributes include `match`, whatever order the attributes are in. */
function attrOf(h: string, tag: string, match: RegExp, attr: string): string | undefined {
  for (const m of h.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))) {
    if (match.test(m[0])) return new RegExp(`\\b${attr}="([^"]*)"`).exec(m[0])?.[1];
  }
  return undefined;
}
const metaContent = (h: string, property: string) => attrOf(h, 'meta', new RegExp(`property="${property}"`), 'content');
const canonicalOf = (h: string) => attrOf(h, 'link', /rel="canonical"/, 'href');
const ldNodes = (h: string): LdNode[] =>
  [...h.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]) as LdNode)
    .flatMap((block) => block['@graph'] ?? [block]);

/** The sitemap is the list of pages that should be found; everything else is checked against it. */
async function sitemapEntries(request: APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text();
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1] ?? '',
    lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1],
  }));
}
const pathOf = (loc: string) => new URL(loc).pathname;

test('the sitemap lists the home page, the tools index and every tool page', async ({ request }) => {
  const paths = (await sitemapEntries(request)).map((e) => pathOf(e.loc));
  for (const required of ['/', '/tools', ...toolPaths]) expect(paths, required).toContain(required);
  expect(new Set(paths).size, 'each page once').toBe(paths.length);
});

test('every page in the sitemap names its own address as canonical (none inherits the home page\'s) and as its share address', async ({ request }) => {
  for (const { loc } of await sitemapEntries(request)) {
    const h = await html(request, pathOf(loc));
    expect(canonicalOf(h), `canonical of ${loc}`).toBe(loc);
    // og:url is optional, but when a page has one it must not point at another page.
    const ogUrl = metaContent(h, 'og:url');
    if (ogUrl !== undefined) expect(ogUrl, `og:url of ${loc}`).toBe(loc);
  }
});

test('a lastmod is only given where it is known: the home page and every tool page have one, and no date is in the future', async ({ request }) => {
  const entries = await sitemapEntries(request);
  // A day of slack: the dates are written in local time and this runs in UTC.
  const latest = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const e of entries) {
    if (e.lastmod === undefined) continue;
    expect(e.lastmod, `lastmod of ${e.loc}`).toMatch(/^20\d\d-\d\d-\d\d/);
    expect(e.lastmod.slice(0, 10) <= latest, `lastmod of ${e.loc} is not in the future`).toBe(true);
  }
  for (const required of ['/', ...toolPaths]) {
    const entry = entries.find((e) => pathOf(e.loc) === required);
    expect(entry?.lastmod, `lastmod of ${required}`).toBeTruthy();
  }
});

test('the home page says who Spintra is: a WebSite and an Organization with its name, address and logo', async ({ request }) => {
  const nodes = ldNodes(await html(request, '/'));
  const site = nodes.find((n) => n['@type'] === 'WebSite');
  const org = nodes.find((n) => n['@type'] === 'Organization');
  expect(site, 'a WebSite entry').toBeTruthy();
  expect(org, 'an Organization entry').toBeTruthy();

  expect(site?.name).toBe('Spintra');
  expect(site?.url).toBe(SITE);
  expect(site?.alternateName).toBe('Spintra.io');
  expect(org?.name).toBe('Spintra');
  expect(org?.url).toBe(SITE);
  expect(org?.logo?.url).toMatch(/^https:\/\/spintra\.io\/.+\.(png|svg|webp|jpg)$/);
  expect(site?.publisher?.['@id'], 'the site names the organization as its publisher').toBe(org?.['@id']);

  // What was already there stays.
  expect(nodes.find((n) => n['@type'] === 'WebApplication')?.name).toBe('Spintra');
});

test('the Organization logo address serves an image, and a tool page does not repeat the home page entity markup', async ({ request }) => {
  const org = ldNodes(await html(request, '/')).find((n) => n['@type'] === 'Organization');
  const res = await request.get(new URL(org?.logo?.url ?? SITE).pathname); // same app, local address
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^image\//);

  const tool = ldNodes(await html(request, '/tools/dice')).map((n) => n['@type']);
  expect(tool, 'the dice page keeps its own markup').toContain('WebApplication');
  expect(tool).not.toContain('WebSite');
  expect(tool).not.toContain('Organization');
});

test('the home page says in plain text what Spintra is', async ({ request }) => {
  // Search engines and AI summaries take "what is Spintra?" from page text. The point is
  // that a plain definition is in the server-rendered page, not its exact wording.
  const text = (await html(request, '/')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  expect(text).toMatch(/Spintra is a free [^.]{20,}browser[^.]*\./);
});

test('inline JSON-LD cannot end its script early', () => {
  const out = jsonLdScript({ description: 'a </script><script>alert(1)</script> b' });
  expect(out).not.toContain('<');
  expect(JSON.parse(out).description).toBe('a </script><script>alert(1)</script> b'); // decodes back unchanged
});
