// Static site + Airtable submit proxy for Railway.
// Env vars required:
//   AIRTABLE_TOKEN  = scoped personal access token (data.records:write on the base)
//   AIRTABLE_BASE   = base id, e.g. appXXXXXXXXXXXXXX
//   AIRTABLE_TABLE  = table id (tblXXXXXXXXXXXXXX) or exact table name, e.g. "Models"
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4180);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

async function handleSubmit(req, res) {
  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE = process.env.AIRTABLE_BASE;
  const TABLE = process.env.AIRTABLE_TABLE || "Models";
  if (!TOKEN || !BASE) return json(res, 500, { error: "Server not configured" });

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) return json(res, 413, { error: "Payload too large" });
  }
  let p;
  try { p = JSON.parse(raw); } catch { return json(res, 400, { error: "Bad JSON" }); }
  if (!p || typeof p.fields !== "object") return json(res, 400, { error: "Missing fields" });

  // Sanitize: strings only, trimmed, capped.
  const fields = {};
  for (const [k, v] of Object.entries(p.fields)) {
    if (typeof k !== "string" || k.length > 100) continue;
    const s = String(v ?? "").slice(0, 10000).trim();
    if (s) fields[k] = s;
  }
  if (!fields["Stage Name"]) return json(res, 400, { error: "Stage Name required" });

  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`;

  // Create record; if Airtable rejects an unknown field, drop it and retry
  // (so a renamed/missing column never blocks a submission).
  let attempt = { ...fields };
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: [{ fields: attempt }], typecast: true }),
    });

    if (r.ok) {
      const j = await r.json();
      return json(res, 200, { ok: true, id: j.records?.[0]?.id || null });
    }

    let err;
    try { err = await r.json(); } catch { err = {}; }
    const msg = err?.error?.message || "";
    const m = msg.match(/Unknown field name:\s*"([^"]+)"/);
    if (r.status === 422 && m && attempt[m[1]] !== undefined) {
      console.warn("Dropping unknown field:", m[1]);
      delete attempt[m[1]];
      continue;
    }
    console.error("AIRTABLE_ERROR", r.status, msg);
    return json(res, 502, { error: "Airtable rejected the submission" });
  }
  return json(res, 502, { error: "Too many field mismatches" });
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);

  if (path === "/submit") {
    if (req.method !== "POST") return json(res, 405, { error: "POST only" });
    try { return await handleSubmit(req, res); }
    catch (e) { console.error("SUBMIT_ERROR", e); return json(res, 500, { error: "Server error" }); }
  }

  try {
    const file = normalize(join(root, path === "/" ? "index.html" : path));
    if (!file.startsWith(normalize(root)) || file.endsWith("server.js")) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, () => console.log(`mathilde-onboarding listening on :${port}`));
