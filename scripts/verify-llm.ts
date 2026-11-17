/**
 * Exercises the DeepSeek ranking path end-to-end against a local
 * OpenAI-compatible mock, without needing a real key. Confirms:
 *   - the prompt carries the student's buckets and every candidate plan
 *   - a valid model response reorders the plans
 *   - a malformed response falls back to the solver instead of throwing
 *   - an HTTP error falls back to the solver
 *
 * Run with: npx tsx scripts/verify-llm.ts
 */
import http from "node:http";

type Mode = "good" | "garbage" | "error";

let mode: Mode = "good";
let lastBody: {
  model?: string;
  messages: { role: string; content: string }[];
} | null = null;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      lastBody = JSON.parse(raw);

      if (mode === "error") {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Authentication Fails" } }));
        return;
      }

      const user = lastBody?.messages?.find((m) => m.role === "user")?.content ?? "";
      const specIds = [...user.matchAll(/specId:\s*([a-z]+)/g)].map((m) => m[1]);

      const content =
        mode === "garbage"
          ? "I think the AI path is best, honestly."
          : JSON.stringify({
              summary: "Mocked DeepSeek summary.",
              ranked: [...specIds].reverse().map((id, i) => ({
                specId: id,
                rank: i + 1,
                headline: `Mock headline for ${id}`,
                rationale: `Mock rationale naming CS 7641 for ${id}.`,
                watchOuts: [`Mock warning for ${id}`],
              })),
            });

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });

  await new Promise<void>((resolve) => server.listen(4599, "127.0.0.1", resolve));

  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.DEEPSEEK_BASE_URL = "http://127.0.0.1:4599";
  process.env.DEEPSEEK_MODEL = "deepseek-chat";

  const { getDb } = await import("../src/lib/db");
  const { loadCatalog, loadInterests, buildAllPlans } = await import(
    "../src/lib/planner"
  );
  const { rankPlans, deepseekConfigured } = await import("../src/lib/llm");

  const db = getDb();
  const catalog = loadCatalog(db);
  const interests = loadInterests(db);
  const set = buildAllPlans(catalog, interests);
  const bucketMap = Object.fromEntries(interests);

  // --- good response --------------------------------------------------------
  const good = await rankPlans(set.plans, bucketMap);
  assert(good.engine === "deepseek", `expected deepseek engine, got ${good.engine}`);
  assert(good.model === "deepseek-chat", `expected deepseek-chat, got ${good.model}`);
  assert(good.ranked.length === 6, `expected 6 ranked, got ${good.ranked.length}`);
  assert(
    good.ranked[0].specId === set.plans[set.plans.length - 1].specId,
    "model ordering was not applied",
  );
  assert(lastBody?.model === "deepseek-chat", "wrong model sent to the API");
  assert(
    lastBody?.messages?.[0]?.role === "system",
    "missing system prompt",
  );

  const prompt = lastBody!.messages.find((m) => m.role === "user")!.content;
  assert(prompt.includes("Highly interested"), "prompt missing highly-interested bucket");
  assert(prompt.includes("CS-7641"), "prompt missing ranked course ids");
  assert((prompt.match(/specId:/g) ?? []).length === 6, "prompt missing candidate plans");

  // --- malformed response ---------------------------------------------------
  mode = "garbage";
  const bad = await rankPlans(set.plans, bucketMap);
  assert(bad.engine === "solver", `expected solver fallback, got ${bad.engine}`);
  assert(typeof bad.error === "string", "expected an error note on fallback");
  assert(bad.ranked.length === 6, "fallback must still rank every plan");

  // --- HTTP error (bad key) -------------------------------------------------
  mode = "error";
  const failed = await rankPlans(set.plans, bucketMap);
  assert(failed.engine === "solver", `expected solver fallback, got ${failed.engine}`);
  assert(
    failed.error?.includes("401"),
    `expected the 401 to surface, got ${failed.error}`,
  );

  // --- no key at all --------------------------------------------------------
  delete process.env.DEEPSEEK_API_KEY;
  assert(!deepseekConfigured(), "configured() should be false without a key");
  const none = await rankPlans(set.plans, bucketMap);
  assert(none.engine === "solver", "expected solver engine with no key");
  assert(none.ranked.length === 6, "solver narrative must rank every plan");

  console.log("DeepSeek path verified:");
  console.log(`  ranking     : ${good.ranked.map((r) => r.specId).join(" > ")}`);
  console.log(`  prompt      : ${prompt.length} chars, 6 plans, buckets included`);
  console.log(`  bad JSON    : fell back to solver (${bad.error?.slice(0, 44)}…)`);
  console.log(`  bad key     : fell back to solver (${failed.error?.slice(0, 40)}…)`);
  console.log(`  no key      : solver ranking, ${none.ranked.length} plans`);

  server.close();
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
