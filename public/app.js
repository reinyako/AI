/* iMessage-style AI chat — state, rendering, dan streaming. */

const STORE_KEY = "imessage-ai/v1";
const COLORS = [
  ["#5ac8fa", "#007aff"], ["#ff9500", "#ff3b30"], ["#34c759", "#248a3d"],
  ["#af52de", "#5856d6"], ["#ff2d55", "#c9006e"], ["#a2845e", "#6f5a45"],
];

const $ = (sel) => document.querySelector(sel);

const el = {
  list: $("#chat-list"),
  listFooter: $("#list-footer"),
  search: $("#search"),
  thread: $("#thread"),
  peerName: $("#peer-name"),
  peerAvatar: $("#peer-avatar"),
  composer: $("#composer"),
  input: $("#input"),
  send: $("#btn-send"),
  sheet: $("#sheet"),
  sheetForm: $("#sheet-form"),
  sheetTitle: $("#sheet-title"),
  fName: $("#f-name"),
  fPersona: $("#f-persona"),
  fColors: $("#f-colors"),
  fDelete: $("#f-delete"),
  toast: $("#toast"),
};

/* ------------------------------ State ------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10);

function seed() {
  const now = Date.now();
  return {
    activeId: null,
    chats: [
      {
        id: uid(), name: "Claude", color: 0, unread: 0,
        persona: "Asisten serba bisa yang ramah, to the point, dan suka membantu menyelesaikan masalah sehari-hari.",
        messages: [{ id: uid(), role: "assistant", text: "Hai! Aku Claude 👋 Mau ngobrolin apa hari ini?", at: now - 60_000 }],
      },
      {
        id: uid(), name: "Chef Rio", color: 1, unread: 0,
        persona: "Koki rumahan yang hangat. Selalu kasih resep praktis dengan bahan yang gampang dicari di Indonesia, plus tips singkat.",
        messages: [{ id: uid(), role: "assistant", text: "Kulkas lagi isi apa? Nanti aku carikan resep yang cocok.", at: now - 3_600_000 }],
      },
      {
        id: uid(), name: "Dev Buddy", color: 3, unread: 0,
        persona: "Programmer senior yang santai. Jelaskan konsep dengan analogi sederhana dan kasih contoh kode singkat kalau perlu.",
        messages: [{ id: uid(), role: "assistant", text: "Ada bug yang bikin pusing? Lempar aja ke sini.", at: now - 86_400_000 }],
      },
    ],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seed();
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.chats) || !data.chats.length) return seed();
    return data;
  } catch {
    return seed();
  }
}

let state = load();
let editingId = null;
let editMode = false;
let pendingColor = 0;
let streaming = false;

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* penyimpanan penuh / mode privat — abaikan */
  }
}

const chatById = (id) => state.chats.find((c) => c.id === id);
const activeChat = () => chatById(state.activeId);
const lastMessage = (chat) => chat.messages[chat.messages.length - 1];
const chatTime = (chat) => lastMessage(chat)?.at ?? 0;

/* ---------------------------- Utilitas ---------------------------- */

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
}

function gradientOf(index) {
  const [a, b] = COLORS[index % COLORS.length];
  return `linear-gradient(180deg, ${a}, ${b})`;
}

function sameDay(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.toDateString() === d2.toDateString();
}

function clockOf(ts) {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function listTime(ts) {
  const now = new Date();
  const d = new Date(ts);
  if (sameDay(now, d)) return clockOf(ts);
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(yesterday, d)) return "Kemarin";
  if (now - d < 7 * 86_400_000) return d.toLocaleDateString("id-ID", { weekday: "long" });
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function dayLabel(ts) {
  const now = new Date();
  const d = new Date(ts);
  if (sameDay(now, d)) return `<b>Hari ini</b> ${clockOf(ts)}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(yesterday, d)) return `<b>Kemarin</b> ${clockOf(ts)}`;
  const date = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  return `<b>${date}</b> ${clockOf(ts)}`;
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Markdown super ringan: `code`, **tebal**, dan tautan. */
function formatText(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return html;
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function haptic(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ------------------------- Daftar percakapan ------------------------- */

function renderList() {
  const query = el.search.value.trim().toLowerCase();
  const chats = [...state.chats].sort((a, b) => chatTime(b) - chatTime(a)).filter((chat) => {
    if (!query) return true;
    const haystack = `${chat.name} ${chat.messages.map((m) => m.text).join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });

  el.list.innerHTML = "";
  for (const chat of chats) {
    const last = lastMessage(chat);
    const preview = last ? (last.role === "user" ? `Kamu: ${last.text}` : last.text) : "Belum ada pesan";

    const row = document.createElement("div");
    row.className = "row";
    row.dataset.id = chat.id;
    row.innerHTML = `
      <div class="row__unread" ${chat.unread ? "" : "hidden"}></div>
      <div class="avatar" style="background:${gradientOf(chat.color)}">${escapeHtml(initials(chat.name))}</div>
      <div class="row__body">
        <div class="row__top">
          <div class="row__name">${escapeHtml(chat.name)}</div>
          <div class="row__time">${last ? listTime(last.at) : ""}</div>
        </div>
        <div class="row__preview">${escapeHtml(preview)}</div>
      </div>
      <svg class="row__chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M8.6 4.6a1.1 1.1 0 0 1 1.6 0l6.6 6.6a1.1 1.1 0 0 1 0 1.6l-6.6 6.6a1.1 1.1 0 1 1-1.6-1.6l5.8-5.8-5.8-5.8a1.1 1.1 0 0 1 0-1.6z" fill="currentColor"/>
      </svg>`;
    row.addEventListener("click", () => (editMode ? openSheet(chat) : openChat(chat.id)));
    el.list.appendChild(row);
  }

  if (!chats.length) {
    el.list.innerHTML = `<p class="list__footer">Tidak ada percakapan yang cocok.</p>`;
  }
  el.listFooter.textContent = editMode
    ? "Mode edit — ketuk percakapan untuk mengubah nama, karakter, atau menghapusnya."
    : `${state.chats.length} percakapan · ketuk ✎ untuk membuat kontak AI baru`;
}

/* ---------------------------- Thread ---------------------------- */

function bubbleNode(message, options) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg--${message.role === "user" ? "out" : "in"}`;
  if (options.groupStart) wrap.classList.add("group-start");
  if (options.tail) wrap.classList.add("tail");
  wrap.dataset.id = message.id;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = formatText(message.text);
  if (message.reaction) {
    const tap = document.createElement("span");
    tap.className = "tapback";
    tap.textContent = message.reaction;
    bubble.appendChild(tap);
  }
  wrap.appendChild(bubble);

  bubble.addEventListener("dblclick", (event) => {
    event.preventDefault();
    toggleReaction(message.id);
  });
  return wrap;
}

function renderThread() {
  const chat = activeChat();
  if (!chat) return;

  el.thread.innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "intro";
  intro.innerHTML = `
    <div class="avatar" style="background:${gradientOf(chat.color)}">${escapeHtml(initials(chat.name))}</div>
    <strong>${escapeHtml(chat.name)}</strong>
    ${escapeHtml(chat.persona || "Asisten AI")}`;
  el.thread.appendChild(intro);

  chat.messages.forEach((message, index) => {
    const prev = chat.messages[index - 1];
    const next = chat.messages[index + 1];
    const gapFromPrev = prev ? message.at - prev.at : Infinity;

    if (!prev || gapFromPrev > 30 * 60_000) {
      const mark = document.createElement("div");
      mark.className = "daymark";
      mark.innerHTML = dayLabel(message.at);
      el.thread.appendChild(mark);
    }

    const groupStart = !prev || prev.role !== message.role || gapFromPrev > 60_000;
    const tail = !next || next.role !== message.role || next.at - message.at > 60_000;
    el.thread.appendChild(bubbleNode(message, { groupStart, tail }));

    const isLast = index === chat.messages.length - 1;
    if (isLast && message.role === "user") {
      const receipt = document.createElement("div");
      receipt.className = "receipt";
      receipt.innerHTML = "Terkirim";
      el.thread.appendChild(receipt);
    }
  });

  scrollToBottom();
}

function scrollToBottom(smooth = false) {
  el.thread.scrollTo({ top: el.thread.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

function toggleReaction(messageId) {
  const chat = activeChat();
  const message = chat?.messages.find((m) => m.id === messageId);
  if (!message) return;
  message.reaction = message.reaction ? null : "❤️";
  haptic(12);
  save();
  renderThread();
}

/* --------------------------- Navigasi --------------------------- */

function openChat(id) {
  const chat = chatById(id);
  if (!chat) return;
  state.activeId = id;
  chat.unread = 0;
  save();

  el.peerName.textContent = chat.name;
  el.peerAvatar.textContent = initials(chat.name);
  el.peerAvatar.style.background = gradientOf(chat.color);
  document.body.classList.add("in-chat");
  $("#screen-chat").setAttribute("aria-hidden", "false");
  renderThread();
  renderList();
}

function closeChat() {
  document.body.classList.remove("in-chat");
  $("#screen-chat").setAttribute("aria-hidden", "true");
  el.input.blur();
  state.activeId = null;
  save();
  renderList();
}

/* ---------------------------- Sheet ---------------------------- */

function renderSwatches() {
  el.fColors.innerHTML = "";
  COLORS.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "swatch";
    dot.style.background = gradientOf(index);
    dot.setAttribute("aria-pressed", String(index === pendingColor));
    dot.setAttribute("aria-label", `Warna ${index + 1}`);
    dot.addEventListener("click", () => {
      pendingColor = index;
      renderSwatches();
    });
    el.fColors.appendChild(dot);
  });
}

function openSheet(chat) {
  editingId = chat?.id ?? null;
  pendingColor = chat?.color ?? Math.floor(Math.random() * COLORS.length);
  el.sheetTitle.textContent = chat ? "Edit kontak" : "Kontak baru";
  el.fName.value = chat?.name ?? "";
  el.fPersona.value = chat?.persona ?? "";
  el.fDelete.hidden = !chat;
  renderSwatches();
  el.sheet.setAttribute("aria-hidden", "false");
  setTimeout(() => el.fName.focus(), 260);
}

function closeSheet() {
  el.sheet.setAttribute("aria-hidden", "true");
}

el.sheet.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close")) closeSheet();
});

el.sheetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = el.fName.value.trim();
  if (!name) return;
  const persona = el.fPersona.value.trim();

  if (editingId) {
    const chat = chatById(editingId);
    Object.assign(chat, { name, persona, color: pendingColor });
    if (state.activeId === chat.id) {
      el.peerName.textContent = chat.name;
      el.peerAvatar.textContent = initials(chat.name);
      el.peerAvatar.style.background = gradientOf(chat.color);
      renderThread();
    }
  } else {
    const chat = { id: uid(), name, persona, color: pendingColor, unread: 0, messages: [] };
    state.chats.push(chat);
    save();
    closeSheet();
    renderList();
    openChat(chat.id);
    return;
  }
  save();
  closeSheet();
  renderList();
});

el.fDelete.addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Hapus percakapan ini beserta seluruh pesannya?")) return;
  state.chats = state.chats.filter((c) => c.id !== editingId);
  if (!state.chats.length) state = seed();
  closeSheet();
  closeChat();
  renderList();
  save();
});

/* --------------------------- Kirim pesan --------------------------- */

function autoGrow() {
  el.input.style.height = "auto";
  el.input.style.height = `${Math.min(el.input.scrollHeight, 132)}px`;
  el.send.disabled = !el.input.value.trim() || streaming;
}

el.input.addEventListener("input", autoGrow);
el.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !navigator.maxTouchPoints) {
    event.preventDefault();
    el.composer.requestSubmit();
  }
});

el.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = el.input.value.trim();
  if (!text || streaming) return;
  el.input.value = "";
  autoGrow();
  sendMessage(text);
});

function appendTypingIndicator() {
  const wrap = document.createElement("div");
  wrap.className = "msg msg--in typing group-start tail";
  wrap.innerHTML = `<div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div>`;
  el.thread.appendChild(wrap);
  scrollToBottom(true);
  return wrap;
}

async function sendMessage(text) {
  const chat = activeChat();
  if (!chat) return;

  chat.messages.push({ id: uid(), role: "user", text, at: Date.now() });
  save();
  renderThread();
  haptic();

  streaming = true;
  el.composer.classList.add("is-busy");
  el.send.disabled = true;

  const typing = appendTypingIndicator();
  const hint = document.createElement("div");
  hint.className = "thinking";
  hint.hidden = true;
  el.thread.appendChild(hint);

  let bubble = null;
  let answer = "";

  const commit = (finalText) => {
    chat.messages.push({ id: uid(), role: "assistant", text: finalText, at: Date.now() });
    save();
    renderThread();
    renderList();
  };

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona: chat.persona,
        messages: chat.messages.map((m) => ({ role: m.role, content: m.text })),
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let failure = null;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const event = JSON.parse(line.slice(5).trim());

        if (event.type === "thinking") {
          hint.hidden = false;
          hint.textContent = `${hint.textContent}${event.text}`.slice(-220);
          scrollToBottom(true);
        } else if (event.type === "text") {
          hint.remove();
          if (!bubble) {
            typing.classList.remove("typing");
            bubble = typing.querySelector(".bubble");
            bubble.textContent = "";
          }
          answer += event.text;
          bubble.innerHTML = formatText(answer);
          scrollToBottom();
        } else if (event.type === "error") {
          failure = event.message;
        }
      }
    }

    hint.remove();
    if (failure && !answer) throw new Error(failure);
    if (!answer) throw new Error("Balasan kosong dari server.");
    commit(answer);
    if (failure) toast(failure);
    haptic(6);
  } catch (error) {
    hint.remove();
    typing.remove();
    if (answer) commit(answer);
    else renderThread();
    toast(error.message || "Gagal mengirim pesan.");
  } finally {
    streaming = false;
    el.composer.classList.remove("is-busy");
    autoGrow();
  }
}

/* --------------------------- Event global --------------------------- */

$("#btn-new").addEventListener("click", () => openSheet(null));
$("#btn-edit").addEventListener("click", (event) => {
  editMode = !editMode;
  event.currentTarget.textContent = editMode ? "Selesai" : "Edit";
  el.listFooter.textContent = editMode
    ? "Mode edit — ketuk percakapan untuk mengubah nama, karakter, atau menghapusnya."
    : `${state.chats.length} percakapan · ketuk ✎ untuk membuat kontak AI baru`;
});
$("#btn-back").addEventListener("click", closeChat);
$("#btn-info").addEventListener("click", () => openSheet(activeChat()));
$("#btn-clear").addEventListener("click", () => {
  const chat = activeChat();
  if (!chat || !chat.messages.length) return;
  if (!confirm("Bersihkan semua pesan di percakapan ini?")) return;
  chat.messages = [];
  save();
  renderThread();
  renderList();
});

el.search.addEventListener("input", renderList);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (el.sheet.getAttribute("aria-hidden") === "false") closeSheet();
  else if (document.body.classList.contains("in-chat")) closeChat();
});

// Jaga area input tetap terlihat saat keyboard iOS muncul.
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (document.body.classList.contains("in-chat")) scrollToBottom();
  });
}

// Cek konfigurasi server sekali di awal.
fetch("/api/health")
  .then((r) => r.json())
  .then((info) => {
    if (!info.configured) toast("Server belum punya ANTHROPIC_API_KEY — chat belum bisa dipakai.");
  })
  .catch(() => {});

renderList();
autoGrow();
