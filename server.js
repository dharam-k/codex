const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("At least one message is required.");
  }
  return messages.map(({ role, content }) => {
    if (!["user", "assistant"].includes(role) || typeof content !== "string" || !content.trim()) {
      throw new Error("Messages must have a valid role and non-empty content.");
    }
    return { role, content: content.trim() };
  });
}

async function callOpenAI(model, messages, system) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

  const input = system ? [{ role: "system", content: system }, ...messages] : messages;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, messages: input })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed.");
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(model, messages, system) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, max_tokens: 2048, system: system || undefined, messages })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Anthropic request failed.");
  return (data.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
}

async function callOpenRouter(model, messages, system) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured on the server.");

  const input = system ? [{ role: "system", content: system }, ...messages] : messages;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || `http://${host}:${port}`,
      "X-Title": "LLM Chat"
    },
    body: JSON.stringify({ model, messages: input })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenRouter request failed.");
  return data.choices?.[0]?.message?.content || "";
}

async function handleChat(req, res) {
  try {
    const body = await readJson(req);
    const provider = body.provider;
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const system = typeof body.system === "string" ? body.system.trim() : "";
    const messages = validateMessages(body.messages);

    if (!model) throw new Error("A model is required.");
    const providers = {
      openai: callOpenAI,
      anthropic: callAnthropic,
      openrouter: callOpenRouter
    };
    if (!providers[provider]) throw new Error("Unknown provider.");

    const content = await providers[provider](model, messages, system);

    json(res, 200, { content });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid JSON request." : error.message;
    json(res, 400, { error: message || "The request failed." });
  }
}

async function serveStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.resolve(publicDir, `.${requestedPath}`);

  if (!filePath.startsWith(`${publicDir}${path.sep}`)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404).end("Not found");
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405, { Allow: "GET, POST" }).end("Method not allowed");
});

server.listen(port, host, () => {
  console.log(`LLM Chat is running at http://${host}:${port}`);
});
