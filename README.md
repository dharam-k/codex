# LLM Chat

A small, dependency-free web app for chatting with OpenAI, Anthropic, and OpenRouter models. API keys stay on the server.

## Run it

Node.js 20 or newer is required. Configure one or both providers:

```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENROUTER_API_KEY="your-key"
npm start
```

Only the key for the provider you want to use is required. When deploying publicly, set `APP_URL` to the app's public URL so OpenRouter can attribute requests correctly.

Open `http://127.0.0.1:3000`.

You can change the bind address and port with `HOST` and `PORT`:

```bash
HOST=0.0.0.0 PORT=8080 npm start
```

## Development

Use `npm run dev` to restart the server automatically when files change. The browser keeps the current conversation only until the page is refreshed.
