import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

// Muat .env kalau ada (Node >= 20.6)
try {
  process.loadEnvFile(new URL(".env", import.meta.url).pathname);
} catch {}

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.MODEL || "claude-opus-5";
const MAX_MESSAGES = 200;
const MAX_CHARS = 20000;

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const BASE_SYSTEM = [
  "Kamu adalah asisten AI yang mengobrol lewat aplikasi pesan di iPhone (mirip iMessage).",
  "Gaya balasan: santai, hangat, dan ringkas seperti orang chat betulan.",
  "Utamakan 1-3 kalimat pendek. Panjangkan hanya kalau memang diminta atau topiknya butuh detail.",
  "Jangan pakai heading markdown atau bullet berlebihan di jawaban pendek.",
  "Ikuti bahasa yang dipakai pengguna (default Bahasa Indonesia).",
].join(" ");

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = normalize(join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR + sep)) return send(res, 403, { error: "Forbidden" });

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    const cache = pathname === "/index.html" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
    res.end(data);
  } catch {
    send(res, 404, { error: "Not found" });
  }
}

function readJsonBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload terlalu besar"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("JSON tidak valid"));
      }
    });
    req.on("error", reject);
  });
}

/** Bersihkan riwayat dari klien: hanya role/teks, dan harus selang-seling diakhiri user. */
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) throw new Error("messages harus array");
  const cleaned = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    const role = item?.role === "assistant" ? "assistant" : "user";
    const text = String(item?.content ?? "").slice(0, MAX_CHARS).trim();
    if (!text) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.role === role) prev.content += "\n\n" + text;
    else cleaned.push({ role, content: text });
  }
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
    throw new Error("Pesan terakhir harus dari pengguna");
  }
  return cleaned;
}

async function handleChat(req, res) {
  if (!client) {
    return send(res, 503, {
      error: "ANTHROPIC_API_KEY belum diset di server. Salin .env.example ke .env lalu isi key-nya.",
    });
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    return send(res, 400, { error: err.message });
  }

  let messages;
  try {
    messages = sanitizeMessages(payload.messages);
  } catch (err) {
    return send(res, 400, { error: err.message });
  }

  const persona = String(payload.persona ?? "").slice(0, 2000).trim();
  const system = persona ? `${BASE_SYSTEM}\n\nKarakter yang kamu perankan: ${persona}` : BASE_SYSTEM;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const emit = (type, data = {}) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages,
      },
      { signal: controller.signal },
    );

    for await (const event of stream) {
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "text_delta") emit("text", { text: event.delta.text });
      else if (event.delta.type === "thinking_delta") emit("thinking", { text: event.delta.thinking });
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      emit("error", { message: "Maaf, permintaan ini tidak bisa aku jawab." });
    }
    emit("done", { model: final.model, usage: final.usage });
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error("[chat]", err);
      const status = err?.status;
      const message =
        status === 401 ? "API key ditolak. Cek ANTHROPIC_API_KEY."
        : status === 429 ? "Kena rate limit. Coba lagi sebentar lagi."
        : err?.message || "Terjadi kesalahan di server.";
      emit("error", { message });
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/health")) {
    return send(res, 200, { ok: true, configured: Boolean(client), model: MODEL });
  }
  if (req.url?.startsWith("/api/chat")) {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    return handleChat(req, res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  iMessage AI berjalan di http://localhost:${PORT}`);
  console.log(`  Model: ${MODEL}`);
  if (!client) console.log("  ⚠️  ANTHROPIC_API_KEY belum diset — chat akan menolak permintaan.\n");
  else console.log("");
});
