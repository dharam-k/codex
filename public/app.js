const models = {
  openai: [
    ["gpt-4.1-mini", "GPT-4.1 mini"],
    ["gpt-4.1", "GPT-4.1"],
    ["gpt-4o-mini", "GPT-4o mini"]
  ],
  anthropic: [
    ["claude-sonnet-4-20250514", "Claude Sonnet 4"],
    ["claude-3-5-haiku-latest", "Claude 3.5 Haiku"]
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
let messages = [];

function fillModels() {
  modelSelect.replaceChildren(...models[providerSelect.value].map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }));
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

fillModels();
