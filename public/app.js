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

const HISTORY_KEY = "modeldeck-chat-history-v1";
const DEFAULT_SYSTEM = "You are a helpful, concise assistant.";
const providerNames = { openai: "OpenAI", anthropic: "Anthropic", openrouter: "OpenRouter" };

const providerSelect = document.querySelector("#provider");
const modelSelect = document.querySelector("#model");
const systemInput = document.querySelector("#system");
const messagesElement = document.querySelector("#messages");
const conversationElement = document.querySelector("#conversation");
const welcomeElement = document.querySelector("#welcome");
const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send");
const newChatButton = document.querySelector("#new-chat");
const settingsPanel = document.querySelector("#settings");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsBackdrop = document.querySelector("#settings-backdrop");
const historyPanel = document.querySelector("#history");
const historyToggle = document.querySelector("#history-toggle");
const historyBackdrop = document.querySelector("#history-backdrop");
const historyList = document.querySelector("#history-list");
const historyCount = document.querySelector("#history-count");
const settingsDrawer = window.matchMedia("(max-width: 800px)");
const historyDrawer = window.matchMedia("(max-width: 1150px)");

let messages = [];
let chats = [];
let activeChatId = null;

function setSettingsOpen(open) {
  const shouldOpen = settingsDrawer.matches && open;
  if (shouldOpen) setHistoryOpen(false);
  settingsPanel.classList.toggle("is-open", shouldOpen);
  settingsToggle.setAttribute("aria-expanded", String(shouldOpen));
  settingsBackdrop.hidden = !shouldOpen;
  settingsPanel.inert = settingsDrawer.matches && !shouldOpen;
}

function setHistoryOpen(open) {
  const shouldOpen = historyDrawer.matches && open;
  if (shouldOpen && settingsPanel.classList.contains("is-open")) setSettingsOpen(false);
  historyPanel.classList.toggle("is-open", shouldOpen);
  historyToggle.setAttribute("aria-expanded", String(shouldOpen));
  historyBackdrop.hidden = !shouldOpen;
  historyPanel.inert = historyDrawer.matches && !shouldOpen;
}

function syncResponsivePanels() {
  if (settingsDrawer.matches) setSettingsOpen(false);
  else {
    settingsPanel.classList.remove("is-open");
    settingsPanel.inert = false;
    settingsBackdrop.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
  }

  if (historyDrawer.matches) setHistoryOpen(false);
  else {
    historyPanel.classList.remove("is-open");
    historyPanel.inert = false;
    historyBackdrop.hidden = true;
    historyToggle.setAttribute("aria-expanded", "false");
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

function selectModel(preferredModel) {
  if (!preferredModel) return;
  const exists = [...modelSelect.options].some((option) => option.value === preferredModel);
  if (!exists) modelSelect.prepend(...modelOptions([[preferredModel, preferredModel]]));
  modelSelect.value = preferredModel;
}

async function fillModels(preferredModel) {
  const provider = providerSelect.value;
  if (provider !== "openrouter") {
    modelSelect.replaceChildren(...modelOptions(models[provider]));
    selectModel(preferredModel);
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
    selectModel(preferredModel);
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

function loadStoredChats() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    chats = Array.isArray(stored)
      ? stored.filter((chat) => chat?.id && Array.isArray(chat.messages) && chat.messages.length).slice(0, 40)
      : [];
  } catch (error) {
    console.warn("Could not read saved chat history:", error.message);
    chats = [];
  }
}

function saveChats() {
  chats = chats.slice(0, 40);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(chats));
  } catch (error) {
    console.warn("Could not save chat history:", error.message);
  }
}

function activeChat() {
  return chats.find((chat) => chat.id === activeChatId);
}

function currentModelLabel() {
  return modelSelect.options[modelSelect.selectedIndex]?.text || modelSelect.value;
}

function persistActiveChat() {
  if (!messages.length) return;
  let chat = activeChat();
  if (!chat) {
    activeChatId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    chat = { id: activeChatId, title: "New conversation" };
  }

  const firstQuestion = messages.find((message) => message.role === "user")?.content || "New conversation";
  chat.title = firstQuestion.length > 46 ? `${firstQuestion.slice(0, 46).trim()}…` : firstQuestion;
  chat.messages = messages.map((message) => ({ ...message }));
  chat.provider = providerSelect.value;
  chat.model = modelSelect.value;
  chat.system = systemInput.value;
  chat.updatedAt = Date.now();
  chats = [chat, ...chats.filter((item) => item.id !== chat.id)];
  saveChats();
  renderHistory();
}

function persistActiveSettings() {
  const chat = activeChat();
  if (!chat) return;
  chat.provider = providerSelect.value;
  chat.model = modelSelect.value;
  chat.system = systemInput.value;
  saveChats();
  renderHistory();
}

function historyTime(timestamp) {
  const date = new Date(timestamp || Date.now());
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderHistory() {
  historyCount.textContent = String(chats.length);
  historyList.replaceChildren();
  if (!chats.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Your conversations will appear here.";
    historyList.append(empty);
    return;
  }

  chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = `history-item${chat.id === activeChatId ? " is-active" : ""}`;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "history-open";
    openButton.addEventListener("click", () => loadChat(chat.id));

    const title = document.createElement("strong");
    title.textContent = chat.title;
    const meta = document.createElement("span");
    meta.textContent = `${providerNames[chat.provider] || "Model"} · ${historyTime(chat.updatedAt)}`;
    openButton.append(title, meta);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "history-delete";
    removeButton.setAttribute("aria-label", `Delete ${chat.title}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => deleteChat(chat.id));
    item.append(openButton, removeButton);
    historyList.append(item);
  });
}

function addMessage(role, content, pending = false, modelLabel = "") {
  welcomeElement.hidden = true;
  const article = document.createElement("article");
  article.className = `message ${role}${pending ? " pending" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const wrapper = document.createElement("div");
  wrapper.className = "message-content";
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "You" : (modelLabel || currentModelLabel());
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = content;
  wrapper.append(label, body);
  article.append(avatar, wrapper);
  conversationElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return { article, body };
}

function renderConversation() {
  conversationElement.replaceChildren();
  welcomeElement.hidden = messages.length > 0;
  messages.forEach((message) => addMessage(message.role, message.content, false, message.modelLabel));
  requestAnimationFrame(() => { messagesElement.scrollTop = messagesElement.scrollHeight; });
}

async function loadChat(chatId) {
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) return;
  activeChatId = chat.id;
  messages = chat.messages.map((message) => ({ ...message }));
  providerSelect.value = chat.provider || "openai";
  systemInput.value = chat.system || DEFAULT_SYSTEM;
  await fillModels(chat.model);
  renderConversation();
  renderHistory();
  setHistoryOpen(false);
  promptInput.focus();
}

function startNewChat() {
  activeChatId = null;
  messages = [];
  renderConversation();
  renderHistory();
  setHistoryOpen(false);
  promptInput.focus();
}

function deleteChat(chatId) {
  chats = chats.filter((chat) => chat.id !== chatId);
  saveChats();
  if (activeChatId === chatId) startNewChat();
  else renderHistory();
}

async function sendMessage(text) {
  const modelLabel = currentModelLabel();
  messages.push({ role: "user", content: text });
  addMessage("user", text);
  persistActiveChat();
  const pending = addMessage("assistant", "Thinking", true, modelLabel);
  sendButton.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerSelect.value,
        model: modelSelect.value,
        system: systemInput.value,
        messages: messages.map(({ role, content }) => ({ role, content }))
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The model request failed.");
    const content = data.content || "The model returned an empty response.";
    pending.article.classList.remove("pending");
    pending.body.textContent = content;
    messages.push({ role: "assistant", content, modelLabel });
    persistActiveChat();
  } catch (error) {
    pending.article.classList.remove("pending");
    pending.article.classList.add("error");
    pending.body.textContent = `Could not respond: ${error.message}`;
  } finally {
    sendButton.disabled = false;
    promptInput.focus();
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }
}

providerSelect.addEventListener("change", async () => {
  await fillModels();
  persistActiveSettings();
});
modelSelect.addEventListener("change", persistActiveSettings);
systemInput.addEventListener("input", persistActiveSettings);
settingsToggle.addEventListener("click", () => setSettingsOpen(!settingsPanel.classList.contains("is-open")));
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));
historyToggle.addEventListener("click", () => setHistoryOpen(!historyPanel.classList.contains("is-open")));
historyBackdrop.addEventListener("click", () => setHistoryOpen(false));
settingsDrawer.addEventListener("change", syncResponsivePanels);
historyDrawer.addEventListener("change", syncResponsivePanels);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSettingsOpen(false);
    setHistoryOpen(false);
  }
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

newChatButton.addEventListener("click", startNewChat);

async function initialize() {
  loadStoredChats();
  syncResponsivePanels();
  renderHistory();
  if (chats.length) await loadChat(chats[0].id);
  else {
    await fillModels();
    renderConversation();
  }
}

initialize();
