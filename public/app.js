const models = {
  openai: [
    ["gpt-4.1-mini", "GPT-4.1 mini"],
    ["gpt-4.1", "GPT-4.1"],
    ["gpt-4o-mini", "GPT-4o mini"]
  ],
  anthropic: [
    ["claude-sonnet-4-20250514", "Claude Sonnet 4"],
    ["claude-3-5-haiku-latest", "Claude 3.5 Haiku"]
  ],
  openrouter: [
    ["openai/gpt-4.1-mini", "GPT-4.1 mini"],
    ["anthropic/claude-sonnet-4", "Claude Sonnet 4"],
    ["google/gemini-2.5-flash", "Gemini 2.5 Flash"]
  ]
};

const providerSelect = document.querySelector("#provider");
const modelSelect = document.querySelector("#model");
const systemInput = document.querySelector("#system");
const messagesElement = document.querySelector("#messages");
const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send");
const newChatButton = document.querySelector("#new-chat");
const settingsPanel = document.querySelector("#settings");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsBackdrop = document.querySelector("#settings-backdrop");
const mobileLayout = window.matchMedia("(max-width: 800px)");
let messages = [];

function setSettingsOpen(open) {
  const shouldOpen = mobileLayout.matches && open;
  settingsPanel.classList.toggle("is-open", shouldOpen);
  settingsToggle.setAttribute("aria-expanded", String(shouldOpen));
  settingsBackdrop.hidden = !shouldOpen;
  settingsPanel.inert = mobileLayout.matches && !shouldOpen;
}

function syncSettingsLayout() {
  if (mobileLayout.matches) setSettingsOpen(false);
  else {
    settingsPanel.classList.remove("is-open");
    settingsPanel.inert = false;
    settingsBackdrop.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
  }
}

function modelOptions(items) {
  return items.map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  });
}

async function fillModels() {
  const provider = providerSelect.value;
  if (provider !== "openrouter") {
    modelSelect.replaceChildren(...modelOptions(models[provider]));
    return;
  }

  const fallbackFreeModels = [["openrouter/free", "Free models — automatic selection"]];
  const renderOpenRouterModels = (freeModels) => {
    const freeGroup = document.createElement("optgroup");
    freeGroup.label = "Free models";
    freeGroup.append(...modelOptions(freeModels));

    const popularGroup = document.createElement("optgroup");
    popularGroup.label = "Popular models";
    popularGroup.append(...modelOptions(models.openrouter));
    modelSelect.replaceChildren(freeGroup, popularGroup);
  };

  renderOpenRouterModels(fallbackFreeModels);
  try {
    const response = await fetch("/api/openrouter/models");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (providerSelect.value !== "openrouter") return;
    renderOpenRouterModels(data.models.map((model) => [model.id, model.name]));
  } catch (error) {
    console.warn("Using the fallback OpenRouter model list:", error.message);
  }
}

function addMessage(role, content, pending = false) {
  document.querySelector(".welcome")?.remove();
  const article = document.createElement("article");
  article.className = `message ${role}${pending ? " pending" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const wrapper = document.createElement("div");
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "You" : modelSelect.options[modelSelect.selectedIndex].text;
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = content;
  wrapper.append(label, body);
  article.append(avatar, wrapper);
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return { article, body };
}

async function sendMessage(text) {
  messages.push({ role: "user", content: text });
  addMessage("user", text);
  const pending = addMessage("assistant", "Thinking", true);
  sendButton.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerSelect.value,
        model: modelSelect.value,
        system: systemInput.value,
        messages
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The model request failed.");
    pending.article.classList.remove("pending");
    pending.body.textContent = data.content || "The model returned an empty response.";
    messages.push({ role: "assistant", content: data.content });
  } catch (error) {
    pending.article.classList.remove("pending");
    pending.body.textContent = `Could not respond: ${error.message}`;
  } finally {
    sendButton.disabled = false;
    promptInput.focus();
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }
}

providerSelect.addEventListener("change", fillModels);
settingsToggle.addEventListener("click", () => setSettingsOpen(!settingsPanel.classList.contains("is-open")));
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));
mobileLayout.addEventListener("change", syncSettingsLayout);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSettingsOpen(false);
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text || sendButton.disabled) return;
  promptInput.value = "";
  promptInput.style.height = "auto";
  sendMessage(text);
});

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

promptInput.addEventListener("input", () => {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
});

document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.textContent;
    promptInput.focus();
  });
});

newChatButton.addEventListener("click", () => {
  messages = [];
  window.location.reload();
});

syncSettingsLayout();
fillModels();
