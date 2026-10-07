import { test, expect, type APIRequestContext } from '@playwright/test';
import { GAMES } from '../src/lib/games';

// 7 Oct 2026: searching "spintra dice" showed Google correcting "spintra" to "spinner" and
// an AI overview defining it as a Roman token, so the site was not being found by its own
// name. Checked on the live site: the home page had no canonical, nothing said who "Spintra"
// is (only a WebApplication entry), and the sitemap had no lastmod to tell crawlers which
// pages changed. These tests pin the fixes against the running app.

const SITE = 'https://spintra.io';
const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));
const pages = ['/', '/tools', '/explore', '/create', '/for-teachers', '/spintra-city', '/legal/terms', '/legal/privacy', ...toolPaths];

async function html(request: APIRequestContext, path: string) {
  const res = await request.get(path);
  expect(res.status(), `${path} should load`).toBe(200);
  return res.text();
}
const canonicalOf = (h: string) => /<link rel="canonical" href="([^"]+)"/.exec(h)?.[1];
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
const jsonLd = (h: string): LdNode[] =>
  [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as LdNode);
const ldNodes = (h: string): LdNode[] => jsonLd(h).flatMap((block) => block['@graph'] ?? [block]);

test('every indexable page names its own address as canonical, and none inherits the home page\'s', async ({ request }) => {
  for (const path of pages) {
    const expected = path === '/' ? SITE : `${SITE}${path}`; // the root has no trailing slash, as in the sitemap
    expect(canonicalOf(await html(request, path)), `canonical of ${path}`).toBe(expected);
  }
});

test('the site says who Spintra is: a WebSite and an Organization with its name, address and logo', async ({ request }) => {
  const nodes = ldNodes(await html(request, '/'));
  const byType = (type: string) => nodes.find((n) => n['@type'] === type)!;

  const site = byType('WebSite');
  expect(site, 'a WebSite entry').toBeTruthy();
  expect(site.name).toBe('Spintra');
  expect(site.url).toBe(SITE);
  expect(site.alternateName).toBe('Spintra.io');

  const org = byType('Organization');
  expect(org, 'an Organization entry').toBeTruthy();
  expect(org.name).toBe('Spintra');
  expect(org.logo?.url).toMatch(/^https:\/\/spintra\.io\/.+\.(png|svg|webp|jpg)$/);
  expect(site.publisher?.['@id']).toBe(org['@id']);

  // What was already there stays.
  expect(byType('WebApplication')?.name).toBe('Spintra');
});

test('the logo address in the Organization entry really serves an image', async ({ request }) => {
  const nodes = ldNodes(await html(request, '/'));
  const logo = new URL(nodes.find((n) => n['@type'] === 'Organization')!.logo!.url);
  const res = await request.get(logo.pathname); // same app, local address
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^image\//);
});

test('the sitemap lists every page once, each with a lastmod date', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  const locs = entries.map((e) => /<loc>([^<]+)<\/loc>/.exec(e)?.[1]);
  expect(locs.sort()).toEqual(pages.map((p) => (p === '/' ? SITE : `${SITE}${p}`)).sort());
  for (const e of entries) expect(e, 'lastmod').toMatch(/<lastmod>20\d\d-\d\d-\d\d(T[^<]*)?<\/lastmod>/);
});

test('the home page says in plain text what Spintra is', async ({ request }) => {
  // Search engines and AI summaries take "what is Spintra?" from page text.
  const text = (await html(request, '/')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  expect(text).toContain('Spintra is a free set of games and group tools that run in your browser');
});
