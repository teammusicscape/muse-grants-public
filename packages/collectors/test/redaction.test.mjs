// Offline regression tests: Node >=22.13, no installed packages required.
// node --experimental-vm-modules --disable-warning=ExperimentalWarning --test packages/collectors/test/redaction.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

const utilSource = readFileSync(new URL("../src/util.ts", import.meta.url), "utf8");
const util = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(utilSource)).toString("base64")}`);
const KEY = "LOCAL_FAKE_KEY+/=";
const URL_WITH_KEY = `https://example.invalid/api?ServiceKey=${encodeURIComponent(KEY)}&pageNo=1`;

async function withFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await action(); } finally { globalThis.fetch = original; }
}

function assertHidden(message) {
  assert.equal(message.includes(KEY), false, "raw dummy key must not appear");
  assert.equal(message.includes(encodeURIComponent(KEY)), false, "encoded dummy key must not appear");
}

test("HTTP errors mask the key without changing the outgoing request", async () => {
  let requested;
  await withFetch(async (url) => {
    requested = url;
    return new Response("", { status: 403, statusText: "Forbidden" });
  }, async () => {
    await assert.rejects(util.fetchText(URL_WITH_KEY), (e) => {
      assertHidden(e.message);
      assert.match(e.message, /403 Forbidden/);
      assert.ok(e.message.includes("https://example.invalid/api"));
      assert.ok(e.message.includes("pageNo=1"));
      return true;
    });
  });
  assert.equal(requested, URL_WITH_KEY);
});

// Execute the real run.ts with in-memory dependencies and fake DB methods.
// Only its entry-point promise is awaited so the assertions observe completion.
async function collectOffline(failure, { platformFailure = false, fatal = false } = {}) {
  const { createContext, SourceTextModule, SyntheticModule } = await import("node:vm");
  const logs = [], writes = [], exits = [];
  const context = createContext({
    console: { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)), table() {} },
    process: { argv: [], env: { SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "fake-db-key", DATA_GO_KR_KEY: KEY }, exit: (code) => exits.push(code) },
    fetch: async () => { throw new Error(`network failure: ${URL_WITH_KEY}`); },
    setTimeout: (fn) => { fn(); },
  });
  function from(table) {
    const result = { data: [], count: 0, error: null };
    const query = {
      select() { return query; }, eq() { return query; }, not() { return query; }, in() { return query; },
      single() { return Promise.resolve({ data: { id: 1 }, error: null }); },
      insert(value) { writes.push({ table, method: "insert", value }); return query; },
      update(value) { writes.push({ table, method: "update", value }); return query; },
      upsert(value) { writes.push({ table, method: "upsert", value }); return query; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
    return query;
  }
  const modules = new Map();
  function mock(name, exports) {
    modules.set(name, new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context }));
  }
  mock("@supabase/supabase-js", { createClient: () => {
    if (fatal) throw new Error(`initialization failed: ${KEY}`);
    return { from, rpc: async () => ({ data: 0 }) };
  } });
  mock("@muse/core", { classifyKind: () => "grant", dedupeKey: () => "", extraTags: () => [], titleKey: () => "", todayISO: () => "2026-01-01" });
  mock("./sources", { COLLECTORS: [{ id: "g2b", name: "mock", list: failure }] });
  mock("./sources/kgo", { kgoPlatforms: async () => {
    if (platformFailure) throw new Error(`platform response: ${KEY}`);
    return [];
  } });
  modules.set("./util", new SourceTextModule(stripTypeScriptTypes(utilSource), { context }));
  const runSource = readFileSync(new URL("../src/run.ts", import.meta.url), "utf8");
  assert.ok(runSource.includes("main().catch("));
  const run = new SourceTextModule(stripTypeScriptTypes(runSource).replace("main().catch(", "await main().catch("), { context });
  await run.link((name) => {
    assert.ok(modules.has(name), `unmocked import: ${name}`);
    return modules.get(name);
  });
  await run.evaluate();
  if (fatal) {
    assert.deepEqual(exits, [1]);
    return { logs: logs.join("\n") };
  }
  assert.deepEqual(exits, []);
  const completed = writes.find((w) => w.table === "collect_runs" && w.method === "update");
  assert.ok(completed, "collection must reach the fake collect_runs update");
  assert.equal(completed.value.errors.length, 1);
  return { logs: logs.join("\n"), errors: JSON.stringify(completed.value.errors) };
}

test("network exception URLs are masked before logging and collect_runs writes", async () => {
  const result = await collectOffline((ctx) => ctx.fetchText(URL_WITH_KEY));
  assertHidden(result.logs);
  assertHidden(result.errors);
  assert.ok(result.errors.includes("network failure"));
  assert.ok(result.errors.includes("pageNo=1"));
});

test("fetchText also masks URLs in network exceptions", async () => {
  await withFetch(async () => { throw new Error(`connection failed: ${URL_WITH_KEY}`); }, async () => {
    await assert.rejects(util.fetchText(URL_WITH_KEY), (e) => {
      assertHidden(e.message);
      assert.match(e.message, /connection failed/);
      return true;
    });
  });
});

for (const name of ["serviceKey", "ServiceKey", "SERVICEKEY"]) {
  test(`redaction handles ${name} and repeated parameters`, () => {
    const message = `https://example.invalid/api?${name}=${encodeURIComponent(KEY)}&pageNo=2&${name}=SECOND_FAKE_KEY#section`;
    const safe = util.redactApiKeys(message);
    assertHidden(safe);
    assert.equal(safe.includes("SECOND_FAKE_KEY"), false);
    assert.ok(safe.includes("pageNo=2"));
    assert.ok(safe.endsWith("#section"));
    assert.equal(util.redactApiKeys(safe), safe, "redaction must be idempotent");
  });
}

test("URLs without API keys and malformed diagnostic text stay usable", () => {
  const plain = "403 https://example.invalid/api?pageNo=2&kind=grant";
  assert.equal(util.redactApiKeys(plain), plain);
  assertHidden(util.redactApiKeys(`bad URL ?ServiceKey=${KEY}&pageNo=2`));
});

test("known keys echoed without a URL are masked in raw and encoded forms", () => {
  const safe = util.redactApiKeys(`response: ${KEY} / ${encodeURIComponent(KEY)}`, KEY);
  assertHidden(safe);
  assert.ok(safe.startsWith("response:"));
});

test("successful fetchJson preserves response and request options", async () => {
  let requested, options;
  await withFetch(async (url, init) => {
    requested = url; options = init;
    return new Response('{"ok":true}', { status: 200 });
  }, async () => {
    assert.deepEqual(await util.fetchJson(URL_WITH_KEY), { ok: true });
  });
  assert.equal(requested, URL_WITH_KEY);
  assert.equal(options.headers.accept, "application/json");
});

test("HTTP failures reach logs and collect_runs without keys", async () => {
  const result = await collectOffline(() => { throw new Error(`403 Forbidden: ${URL_WITH_KEY}`); });
  assertHidden(result.logs);
  assertHidden(result.errors);
  assert.ok(result.errors.includes("403 Forbidden"));
});

test("JSON parsing or API body errors cannot echo a known key into logs or DB", async () => {
  const result = await collectOffline(() => {
    JSON.parse(`invalid response with ${KEY} and ${encodeURIComponent(KEY)}`);
  });
  assertHidden(result.logs);
  assertHidden(result.errors);
});

test("platform catch errors are masked at the DB write boundary", async () => {
  const result = await collectOffline(async () => [], { platformFailure: true });
  assertHidden(result.logs);
  assertHidden(result.errors);
  assert.ok(result.errors.includes("platform response"));
});

test("top-level fatal errors are masked before console.error", async () => {
  const result = await collectOffline(async () => [], { fatal: true });
  assertHidden(result.logs);
  assert.ok(result.logs.includes("initialization failed"));
});
