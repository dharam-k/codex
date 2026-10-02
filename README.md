# ModelDeck

A small, dependency-free web app for chatting with OpenAI, Anthropic, and OpenRouter models. API keys stay on the server, while conversation history is stored locally in the browser.

## Run it

Node.js 20 or newer is required. Configure one or both providers:

```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENROUTER_API_KEY="your-key"
npm start
```

Only the key for the provider you want to use is required. When deploying publicly, set `APP_URL` to the app's public URL so OpenRouter can attribute requests correctly.

When OpenRouter is selected, the app loads its current zero-cost model catalog and places those models in a **Free models** group. The automatic `openrouter/free` router remains available if the catalog cannot be loaded. Free models still require an OpenRouter key and are subject to OpenRouter's availability and rate limits.

Open `http://127.0.0.1:3000`.

You can change the bind address and port with `HOST` and `PORT`:

```bash
HOST=0.0.0.0 PORT=8080 npm start
```

## Development

Use `npm run dev` to restart the server automatically when files change. The browser keeps the current conversation only until the page is refreshed.
