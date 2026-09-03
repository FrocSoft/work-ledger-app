import {
  getCredentials, saveCredentials, clearCredentials, hasCredentials,
  testConnection, fetchState, writeState,
} from "./github-api.js";

// ---- config ----
const DAILY_CAP_BLOCKS = 6;
const WORK_MIN = 50;
const BREAK_MIN = 10;
const OFFDAY_COST = 15;
const SIZE_WARN_BYTES = 900 * 1024; // Contents API caps file writes around 1MB

const DEFAULT_SPEND_PRESETS = [
  { id: "game", label: "게임 1시간", cost: 3, icon: "game" },
  { id: "web", label: "웹서핑 1시간", cost: 3, icon: "web" },
];

const ICONS = {
  play: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
  square: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>',
  check: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  x: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  plus: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  gamepad: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><circle cx="15" cy="13" r="1"></circle><circle cx="18" cy="11" r="1"></circle><rect x="2" y="6" width="20" height="12" rx="6"></rect></svg>',
  globe: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  piggy: '<svg class="wl-icon" style="width:26px;height:26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5-1.5-3.5-2-5.5-2-4 0-7.5 3-8 7-2 .5-3 1.5-3 2.5s1 1.5 2 1.5v3c0 1 1 2 2 2h1v-2h3v2h3v-2c1.5 0 2.7-.5 3.5-1.3"></path><path d="M19 5l1-2 1 2-1 1"></path><circle cx="16" cy="11" r=".5" fill="currentColor"></circle></svg>',
  chevron: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  trash: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
  coffee: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line></svg>',
  image: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M21 3l-7 7"></path><rect x="3" y="6" width="14" height="15" rx="2"></rect><circle cx="9" cy="12" r="1.5"></circle><path d="M4 20l4-4 3 3 3-4 3 3"></path></svg>',
  sparkles: '<svg class="wl-icon" style="width:22px;height:22px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"></path><path d="M19 15l.7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9L19 15z"></path></svg>',
  gear: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>',
  grip: '<svg class="wl-icon wl-icon--sm wl-grip" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"></circle><circle cx="9" cy="12" r="1.6"></circle><circle cx="9" cy="18" r="1.6"></circle><circle cx="15" cy="6" r="1.6"></circle><circle cx="15" cy="12" r="1.6"></circle><circle cx="15" cy="18" r="1.6"></circle></svg>',
  pencil: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
};

// ---- utils ----
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatKDate(d = new Date()) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
function formatTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function spentTotal(spends) {
  return (spends || []).reduce((a, s) => a + s.cost, 0);
}
function mergeLog(blocks, spends) {
  const b = blocks.map((x) => ({ id: x.id, kind: "block", label: x.task, at: x.completedAt }));
  const s = spends.map((x) => ({ id: x.id, kind: "spend", label: x.label, cost: x.cost, at: x.at }));
  return [...b, ...s].sort((a, c) => c.at - a.at);
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
const escapeAttr = escapeHtml;

function resizeImageFile(file, maxDim = 420, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function defaultState() {
  return {
    blocksByDate: {},
    spendsByDate: {},
    savings: 0,
    processedDates: [],
    offDayLog: [],
    works: [],
    revenueLog: [],
    categories: [],
    activeBlock: null,
    queue: [],
  };
}

// Migrates older saved shapes (tier.amount -> targetAmount/actualPrice, missing
// works.costs/expectedSalePrice/queue) so existing GitHub-stored state keeps working.
function normalizeState(s) {
  s.works = (s.works || []).map((w) => ({
    ...w,
    subtasks: w.subtasks || [],
    updates: w.updates || [],
    costs: w.costs || [],
    expectedSalePrice: w.expectedSalePrice != null ? w.expectedSalePrice : null,
  }));
  s.categories = (s.categories || []).map((c) => ({
    ...c,
    tiers: (c.tiers || []).map((t) => {
      if (t.targetAmount != null) return t;
      const amt = t.amount != null ? t.amount : 0;
      return { ...t, targetAmount: amt, actualPrice: amt };
    }),
  }));
  s.queue = s.queue || [];
  return s;
}

// ---- module state ----
let state = null;
let sha = null;
let phase = "loading"; // loading | loadError | needsSetup | ready
let loadErrorMsg = "";
let currentTab = "dashboard";
let settingsOpen = false;
let saveStatus = "idle"; // idle | pending | saving | saved | error
let saveErrorMsg = "";
let saveTimer = null;
let tickHandle = null;
let lastMinuteCheck = 0;
let editingCategoryId = null;
let editingCategoryDraft = "";
let editingWorkId = null;
let editingWorkDraft = { name: "", expectedSalePrice: "" };
let dragSource = null;
let costFormOpen = {};
let expandedGoalCats = {};

const drafts = {
  customSpendLabel: "",
  customSpendCost: "",
  newWorkName: "",
  newWorkExpected: "",
  newSubtask: {},
  pendingUpdate: { text: "", image: null, subtaskDone: false },
  newRevenueAmount: "",
  newCategoryName: "",
  newTier: {},
  newCost: {},
  queueDraft: { task: "", workId: "", subtaskId: "" },
  settings: null,
  settingsMsg: null,
  settingsBusy: false,
};

// ---- boot / persistence ----
async function boot() {
  if (!hasCredentials()) {
    phase = "needsSetup";
    settingsOpen = true;
    drafts.settings = getCredentials();
    drafts.settingsMsg = null;
    render();
    return;
  }
  phase = "loading";
  render();
  try {
    const { data, sha: s } = await fetchState();
    state = normalizeState(data ? Object.assign(defaultState(), data) : defaultState());
    sha = s;
    phase = "ready";
    reconcileSavings();
    startTicking();
  } catch (e) {
    phase = "loadError";
    loadErrorMsg = e && e.message ? e.message : "알 수 없는 오류";
  }
  render();
}

function reconcileSavings() {
  const today = todayKey();
  const processed = new Set(state.processedDates);
  let addTo = 0;
  const newlyProcessed = [];
  Object.keys(state.blocksByDate).forEach((date) => {
    if (date === today || processed.has(date)) return;
    const blocks = state.blocksByDate[date] || [];
    const spends = state.spendsByDate[date] || [];
    const leftover = Math.max(0, Math.min(blocks.length, DAILY_CAP_BLOCKS) - spentTotal(spends));
    addTo += leftover;
    newlyProcessed.push(date);
  });
  if (newlyProcessed.length > 0) {
    state.savings += addTo;
    state.processedDates = [...state.processedDates, ...newlyProcessed];
    return true;
  }
  return false;
}

function startTicking() {
  if (tickHandle) clearInterval(tickHandle);
  lastMinuteCheck = Date.now();
  tickHandle = setInterval(onTick, 1000);
}

function onTick() {
  if (!state) return;
  if (state.activeBlock) {
    const { phase: p, startedAt } = state.activeBlock;
    const durationMs = (p === "work" ? WORK_MIN : BREAK_MIN) * 60000;
    if (Date.now() - startedAt >= durationMs) {
      if (p === "work") completeActiveBlock();
      else {
        startNextQueueItemOrEnd();
        persistAndRender();
      }
      return;
    }
  }
  updateTimerDisplay();
  if (Date.now() - lastMinuteCheck > 60000) {
    lastMinuteCheck = Date.now();
    if (reconcileSavings()) persistAndRender();
  }
}

function persistAndRender() {
  render();
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveStatus = "pending";
  updateSaveIndicator();
  saveTimer = setTimeout(doSave, 1200);
}

async function doSave() {
  const payload = JSON.stringify(state);
  const byteSize = new TextEncoder().encode(payload).length;
  if (byteSize > SIZE_WARN_BYTES) {
    saveStatus = "error";
    saveErrorMsg = "저장 용량이 다 찼어요 (GitHub 파일 용량 제한 1MB 근처). 오래된 사진을 정리해주세요.";
    updateSaveIndicator();
    return;
  }
  saveStatus = "saving";
  updateSaveIndicator();
  try {
    sha = await writeState(state, sha);
    saveStatus = "saved";
    saveErrorMsg = "";
  } catch (e) {
    saveStatus = "error";
    saveErrorMsg = "저장에 실패했어요. 네트워크와 토큰 권한을 확인해주세요. 이번 조작은 기록되지 않았을 수 있어요.";
  }
  updateSaveIndicator();
}

function updateSaveIndicator() {
  const el = document.getElementById("wl-save-status");
  if (!el) return;
  el.className = `wl-savebar wl-savebar--${saveStatus}`;
  const map = {
    idle: "", pending: "저장 대기 중…", saving: "저장 중…", saved: "", error: saveErrorMsg || "저장 실패",
  };
  el.textContent = map[saveStatus] || "";
}

// ---- computed ----
function computeToday() {
  const today = todayKey();
  const todayBlocks = state.blocksByDate[today] || [];
  const todaySpends = state.spendsByDate[today] || [];
  const dailyPool = Math.min(todayBlocks.length, DAILY_CAP_BLOCKS);
  const dailySpent = spentTotal(todaySpends);
  const dailyAvailable = dailyPool - dailySpent;
  const overflowToday = Math.max(0, todayBlocks.length - DAILY_CAP_BLOCKS);
  return { today, todayBlocks, todaySpends, dailyPool, dailySpent, dailyAvailable, overflowToday };
}

// ---- actions: timer + continuous block queue ----
// Commits whatever the user typed into the break-time composer (or an
// auto-generated line if they typed nothing) as the linked work's update —
// this is now the only way work updates get created.
function commitPendingSessionUpdate() {
  const active = state.activeBlock;
  if (!active || active.phase !== "break" || !active.workId) return;
  const w = state.works.find((x) => x.id === active.workId);
  if (!w) return;
  const subtask = active.subtaskId ? w.subtasks.find((s) => s.id === active.subtaskId) : null;
  const typed = drafts.pendingUpdate.text.trim();
  const text = typed || `${subtask ? `[${subtask.name}] ` : ""}"${active.task}" 블록 완료 (${WORK_MIN}분)`;
  w.updates = w.updates || [];
  w.updates.unshift({ id: uid(), text, image: drafts.pendingUpdate.image || null, at: active.completedAt || Date.now(), auto: !typed });
  if (subtask && drafts.pendingUpdate.subtaskDone) subtask.done = true;
  drafts.pendingUpdate = { text: "", image: null, subtaskDone: false };
}

// The single choke point where a session ends: commits any pending update,
// then either starts the next queued block or goes idle.
function startNextQueueItemOrEnd() {
  commitPendingSessionUpdate();
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    state.activeBlock = {
      id: uid(), task: next.task, workId: next.workId || null, subtaskId: next.subtaskId || null,
      startedAt: Date.now(), phase: "work",
    };
  } else {
    state.activeBlock = null;
  }
}

function completeActiveBlock() {
  if (!state.activeBlock) return;
  const day = todayKey();
  const blocks = state.blocksByDate[day] || [];
  const newBlock = {
    id: state.activeBlock.id, task: state.activeBlock.task,
    workId: state.activeBlock.workId, subtaskId: state.activeBlock.subtaskId,
    completedAt: Date.now(),
  };
  const newBlocks = [...blocks, newBlock];
  const overflow = newBlocks.length > DAILY_CAP_BLOCKS;
  state.blocksByDate[day] = newBlocks;
  if (overflow) state.savings += 1;
  drafts.pendingUpdate = { text: "", image: null, subtaskDone: false };
  state.activeBlock = { ...state.activeBlock, phase: "break", startedAt: Date.now(), completedAt: newBlock.completedAt };
  persistAndRender();
}

function finishEarly() { completeActiveBlock(); }
function skipBreak() { startNextQueueItemOrEnd(); persistAndRender(); }
function cancelBlock() { startNextQueueItemOrEnd(); persistAndRender(); }

function addToQueue() {
  const task = drafts.queueDraft.task.trim();
  if (!task) return;
  state.queue.push({
    id: uid(), task, workId: drafts.queueDraft.workId || null, subtaskId: drafts.queueDraft.subtaskId || null,
  });
  drafts.queueDraft = { task: "", workId: "", subtaskId: "" };
  persistAndRender();
}
function removeFromQueue(id) {
  state.queue = state.queue.filter((q) => q.id !== id);
  persistAndRender();
}
function startQueue() {
  if (state.activeBlock || state.queue.length === 0) return;
  startNextQueueItemOrEnd();
  persistAndRender();
}
function reorderArray(arr, fromIndex, toIndex) {
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, item);
}

// ---- actions: spend / savings ----
function spend(label, cost) {
  const { dailyAvailable } = computeToday();
  if (cost > dailyAvailable) return;
  const day = todayKey();
  const list = state.spendsByDate[day] || [];
  state.spendsByDate[day] = [...list, { id: uid(), label, cost, at: Date.now() }];
  persistAndRender();
}
function addCustomSpend() {
  const cost = Number(drafts.customSpendCost);
  if (!drafts.customSpendLabel.trim() || !cost || cost <= 0) return;
  spend(drafts.customSpendLabel.trim(), cost);
  drafts.customSpendLabel = "";
  drafts.customSpendCost = "";
}
function useOffDay() {
  if (state.savings < OFFDAY_COST) return;
  state.savings -= OFFDAY_COST;
  state.offDayLog.push(Date.now());
  persistAndRender();
}

// ---- actions: works ----
function addWork() {
  const name = drafts.newWorkName.trim();
  if (!name) return;
  const expectedSalePrice = drafts.newWorkExpected ? Number(drafts.newWorkExpected) : null;
  state.works.push({ id: uid(), name, subtasks: [], updates: [], costs: [], expectedSalePrice });
  drafts.newWorkName = "";
  drafts.newWorkExpected = "";
  persistAndRender();
}
function removeWork(id) {
  state.works = state.works.filter((w) => w.id !== id);
  persistAndRender();
}
function startEditWork(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  editingWorkId = workId;
  editingWorkDraft = { name: w.name, expectedSalePrice: w.expectedSalePrice != null ? String(w.expectedSalePrice) : "" };
  render();
}
function cancelEditWork() { editingWorkId = null; render(); }
function saveEditWork() {
  const w = state.works.find((x) => x.id === editingWorkId);
  if (!w) return;
  const name = editingWorkDraft.name.trim();
  if (!name) return;
  w.name = name;
  w.expectedSalePrice = editingWorkDraft.expectedSalePrice ? Number(editingWorkDraft.expectedSalePrice) : null;
  editingWorkId = null;
  persistAndRender();
}
function addSubtask(workId) {
  const name = (drafts.newSubtask[workId] || "").trim();
  if (!name) return;
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.subtasks.push({ id: uid(), name, done: false });
  drafts.newSubtask[workId] = "";
  persistAndRender();
}
function toggleSubtask(workId, subId) {
  const w = state.works.find((x) => x.id === workId);
  const st = w && w.subtasks.find((s) => s.id === subId);
  if (!st) return;
  st.done = !st.done;
  persistAndRender();
}
function removeSubtask(workId, subId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.subtasks = w.subtasks.filter((s) => s.id !== subId);
  persistAndRender();
}
function reorderSubtasks(workId, fromIndex, toIndex) {
  const w = state.works.find((x) => x.id === workId);
  if (!w || fromIndex === toIndex) return;
  reorderArray(w.subtasks, fromIndex, toIndex);
  persistAndRender();
}
function workCostTotal(w) {
  return (w.costs || []).reduce((a, c) => a + c.amount, 0);
}
function workSessionStats(workId) {
  let count = 0;
  Object.values(state.blocksByDate).forEach((blocks) => {
    (blocks || []).forEach((b) => { if (b.workId === workId) count += 1; });
  });
  return { count, minutes: count * WORK_MIN };
}
function subtaskMinutes(workId, subtaskId) {
  let count = 0;
  Object.values(state.blocksByDate).forEach((blocks) => {
    (blocks || []).forEach((b) => { if (b.workId === workId && b.subtaskId === subtaskId) count += 1; });
  });
  return count * WORK_MIN;
}
function removeWorkUpdate(workId, updateId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.updates = (w.updates || []).filter((u) => u.id !== updateId);
  persistAndRender();
}
function toggleCostForm(workId) {
  costFormOpen[workId] = !costFormOpen[workId];
  render();
}
function addWorkCost(workId) {
  const draft = drafts.newCost[workId] || {};
  const amount = Number(draft.amount);
  if (!amount || amount <= 0) return;
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.costs = w.costs || [];
  w.costs.push({ id: uid(), amount, label: (draft.label || "").trim(), at: Date.now() });
  drafts.newCost[workId] = { label: "", amount: "" };
  costFormOpen[workId] = false;
  persistAndRender();
}
function removeWorkCost(workId, costId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.costs = (w.costs || []).filter((c) => c.id !== costId);
  persistAndRender();
}

// ---- actions: revenue / goals ----
function addRevenue() {
  const amount = Number(drafts.newRevenueAmount);
  if (!amount || amount <= 0) return;
  state.revenueLog.unshift({ id: uid(), amount, date: todayKey() });
  drafts.newRevenueAmount = "";
  persistAndRender();
}
function removeRevenue(id) {
  state.revenueLog = state.revenueLog.filter((r) => r.id !== id);
  persistAndRender();
}
function addCategory() {
  const name = drafts.newCategoryName.trim();
  if (!name) return;
  state.categories.push({ id: uid(), name, tiers: [] });
  drafts.newCategoryName = "";
  persistAndRender();
}
function removeCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  persistAndRender();
}
function reorderCategories(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  reorderArray(state.categories, fromIndex, toIndex);
  persistAndRender();
}
function startEditCategory(catId) {
  const c = state.categories.find((x) => x.id === catId);
  if (!c) return;
  editingCategoryId = catId;
  editingCategoryDraft = c.name;
  render();
}
function cancelEditCategory() { editingCategoryId = null; render(); }
function saveEditCategory() {
  const c = state.categories.find((x) => x.id === editingCategoryId);
  if (!c) return;
  const name = editingCategoryDraft.trim();
  if (!name) return;
  c.name = name;
  editingCategoryId = null;
  persistAndRender();
}
function addTier(catId) {
  const draft = drafts.newTier[catId] || {};
  const targetAmount = Number(draft.targetAmount);
  const actualPrice = draft.actualPrice ? Number(draft.actualPrice) : targetAmount;
  if (!draft.label || !draft.label.trim() || !targetAmount || targetAmount <= 0) return;
  const c = state.categories.find((x) => x.id === catId);
  if (!c) return;
  if (draft.editingId) {
    const t = c.tiers.find((x) => x.id === draft.editingId);
    if (t) {
      t.label = draft.label.trim();
      t.targetAmount = targetAmount;
      t.actualPrice = actualPrice;
      t.image = draft.image || null;
    }
  } else {
    c.tiers.push({ id: uid(), label: draft.label.trim(), targetAmount, actualPrice, image: draft.image || null });
  }
  drafts.newTier[catId] = { label: "", targetAmount: "", actualPrice: "", image: null };
  persistAndRender();
}
function startEditTier(catId, tierId) {
  const c = state.categories.find((x) => x.id === catId);
  const t = c && c.tiers.find((x) => x.id === tierId);
  if (!t) return;
  drafts.newTier[catId] = {
    label: t.label, targetAmount: String(t.targetAmount), actualPrice: String(t.actualPrice),
    image: t.image || null, editingId: t.id,
  };
  render();
}
function cancelEditTier(catId) {
  drafts.newTier[catId] = { label: "", targetAmount: "", actualPrice: "", image: null };
  render();
}
function removeTier(catId, tierId) {
  const c = state.categories.find((x) => x.id === catId);
  if (!c) return;
  c.tiers = c.tiers.filter((t) => t.id !== tierId);
  persistAndRender();
}
function toggleGoalCategoryExpand(catId) {
  expandedGoalCats[catId] = !expandedGoalCats[catId];
  render();
}

// ---- actions: settings ----
function switchTab(tab) { currentTab = tab; render(); }

function openSettings() {
  drafts.settings = getCredentials();
  drafts.settingsMsg = null;
  settingsOpen = true;
  render();
}
function closeSettings() {
  if (!hasCredentials()) return;
  settingsOpen = false;
  render();
}
function settingsErrorText(reason) {
  if (reason === "auth") return "토큰이 올바르지 않거나 권한이 없어요. Contents 읽기/쓰기 권한을 확인해주세요.";
  if (reason === "notfound") return "저장소를 찾을 수 없어요. 소유자/이름을 확인해주세요.";
  if (reason === "network") return "네트워크 오류가 발생했어요.";
  return "연결에 실패했어요.";
}
async function testSettingsForm() {
  const s = drafts.settings;
  if (!s.token.trim() || !s.owner.trim() || !s.repo.trim()) {
    drafts.settingsMsg = { type: "error", text: "토큰, 소유자, 저장소를 입력해주세요." };
    render();
    return;
  }
  drafts.settingsBusy = true;
  render();
  const result = await testConnection(s);
  drafts.settingsBusy = false;
  drafts.settingsMsg = result.ok
    ? { type: "ok", text: "연결 성공!" }
    : { type: "error", text: settingsErrorText(result.reason) };
  render();
}
async function submitSettings() {
  const s = drafts.settings;
  if (!s.token.trim() || !s.owner.trim() || !s.repo.trim()) {
    drafts.settingsMsg = { type: "error", text: "토큰, 소유자, 저장소는 필수예요." };
    render();
    return;
  }
  drafts.settingsBusy = true;
  drafts.settingsMsg = null;
  render();
  const result = await testConnection(s);
  if (!result.ok) {
    drafts.settingsBusy = false;
    drafts.settingsMsg = { type: "error", text: settingsErrorText(result.reason) };
    render();
    return;
  }
  saveCredentials(s);
  drafts.settingsBusy = false;
  settingsOpen = false;
  await boot();
}
function doLogout() {
  if (!confirm("로그아웃하고 이 브라우저에 저장된 GitHub 접속 정보를 지울까요?")) return;
  clearCredentials();
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  state = null;
  sha = null;
  phase = "needsSetup";
  settingsOpen = true;
  drafts.settings = { token: "", owner: "", repo: "", branch: "main", path: "state.json" };
  drafts.settingsMsg = null;
  render();
}

// ---- render: shared bits ----
function figure(label, value, accent) {
  return `<div class="wl-figure"><div class="wl-figure-label">${escapeHtml(label)}</div><div class="wl-figure-value ${accent ? `is-${accent}` : ""}">${value}</div></div>`;
}

function renderImagePicker({ value, pickAction, clearAction, work, cat }) {
  const extra = `${work ? ` data-work="${work}"` : ""}${cat ? ` data-cat="${cat}"` : ""}`;
  if (value) {
    return `
      <div class="wl-imgpick has-image">
        <img src="${value}" class="wl-imgpick-preview" alt="" />
        <button type="button" class="wl-icon-btn wl-imgpick-clear" data-action="${clearAction}"${extra}>${ICONS.x}</button>
      </div>`;
  }
  return `
    <label class="wl-imgpick">
      <input type="file" accept="image/*" hidden data-filepick="${pickAction}"${extra} />
      ${ICONS.image}
      <span>사진</span>
    </label>`;
}

// ---- render: column 1 — time block ----
function renderTimerBlock({ label, phaseLabel, durationMin, startedAt, isBreak, workId, subtaskId }) {
  const durationMs = durationMin * 60000;
  const elapsed = Date.now() - startedAt;
  const remaining = durationMs - elapsed;
  const pct = Math.min(100, Math.max(0, (elapsed / durationMs) * 100));
  return `
    <div class="wl-timer">
      <div class="wl-timer-top">
        <span class="wl-timer-phase ${isBreak ? "is-break" : ""}">${isBreak ? ICONS.coffee : ICONS.square} ${phaseLabel}</span>
        <span class="wl-timer-clock" id="wl-timer-clock">${formatClock(remaining)}</span>
      </div>
      <div class="wl-timer-task">${escapeHtml(label)}</div>
      <div class="wl-timer-bar"><div class="wl-timer-bar-fill" id="wl-timer-bar-fill" style="width:${pct}%"></div></div>
      <div class="wl-timer-actions">
        ${!isBreak ? `
          <button class="wl-btn wl-btn--primary" data-action="finishEarly">${ICONS.check} 일찍 마무리</button>
          <button class="wl-btn wl-btn--ghost" data-action="cancelBlock">${ICONS.x} 중단</button>
        ` : `<button class="wl-btn wl-btn--ghost" data-action="skipBreak">휴식 건너뛰기</button>`}
      </div>
      ${isBreak && workId ? renderSessionUpdateComposer(workId, subtaskId) : ""}
    </div>`;
}

function renderSessionUpdateComposer(workId, subtaskId) {
  const draft = drafts.pendingUpdate;
  const w = state.works.find((x) => x.id === workId);
  const subtask = subtaskId && w ? w.subtasks.find((s) => s.id === subtaskId) : null;
  return `
    <div class="wl-session-update">
      <div class="wl-hint">방금 세션 기록 — 쉬는 동안 적으면 저장돼요</div>
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" placeholder="무엇을 했나요?" data-draft="pendingUpdateText" value="${escapeAttr(draft.text)}" />
        ${renderImagePicker({ value: draft.image || null, pickAction: "pickPendingUpdateImage", clearAction: "clearPendingUpdateImage" })}
      </div>
      ${subtask && !subtask.done ? `
        <div class="wl-subtask-row" style="margin-top:10px">
          <button class="wl-checkbox ${draft.subtaskDone ? "is-done" : ""}" data-action="togglePendingSubtaskDone">${draft.subtaskDone ? ICONS.check : ""}</button>
          <span class="wl-subtask-name">"${escapeHtml(subtask.name)}" 완료 처리</span>
        </div>` : ""}
    </div>`;
}

function updateTimerDisplay() {
  if (currentTab !== "dashboard" || !state.activeBlock) return;
  const clockEl = document.getElementById("wl-timer-clock");
  const barEl = document.getElementById("wl-timer-bar-fill");
  if (!clockEl || !barEl) return;
  const { phase: p, startedAt } = state.activeBlock;
  const durationMs = (p === "work" ? WORK_MIN : BREAK_MIN) * 60000;
  const elapsed = Date.now() - startedAt;
  const remaining = durationMs - elapsed;
  const pct = Math.min(100, Math.max(0, (elapsed / durationMs) * 100));
  clockEl.textContent = formatClock(remaining);
  barEl.style.width = `${pct}%`;
}

function renderQueueItem(item, idx) {
  const w = item.workId ? state.works.find((x) => x.id === item.workId) : null;
  return `
    <li class="wl-queue-item" draggable="true" data-drag-kind="queue" data-index="${idx}">
      ${ICONS.grip}
      <span class="wl-queue-index">${idx + 1}</span>
      <span class="wl-queue-task">${escapeHtml(item.task)}${w ? `<span class="wl-queue-work"> · ${escapeHtml(w.name)}</span>` : ""}</span>
      <button class="wl-icon-btn" data-action="removeFromQueue" data-id="${item.id}">${ICONS.x}</button>
    </li>`;
}

function renderQueueSection() {
  const draft = drafts.queueDraft;
  const selectedWork = state.works.find((w) => w.id === draft.workId);
  return `
    <div class="wl-queue">
      <div class="wl-card-title">블록 추가</div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="다음 블록에서 할 일" data-draft="queueTask" data-enter-action="addToQueue" value="${escapeAttr(draft.task)}" />
        <button class="wl-btn wl-btn--primary" data-action="addToQueue">${ICONS.plus} 추가</button>
      </div>
      ${state.works.length > 0 ? `
        <div class="wl-field-row wl-field-row--tight">
          <select class="wl-select" data-select="queueWork">
            <option value="">할일 연결 안 함</option>
            ${state.works.map((w) => `<option value="${w.id}" ${draft.workId === w.id ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("")}
          </select>
          ${selectedWork && selectedWork.subtasks.length > 0 ? `
            <select class="wl-select" data-select="queueSub">
              <option value="">하위 할일 선택 안 함</option>
              ${selectedWork.subtasks.map((st) => `<option value="${st.id}" ${draft.subtaskId === st.id ? "selected" : ""}>${escapeHtml(st.name)}</option>`).join("")}
            </select>` : ""}
        </div>` : ""}
      ${state.queue.length > 0 ? `
        <div class="wl-hint" style="margin-top:10px">계획된 블록 ${state.queue.length}개 · 드래그로 순서 변경</div>
        <ul class="wl-queue-list">${state.queue.map(renderQueueItem).join("")}</ul>
        ${!state.activeBlock ? `<button class="wl-btn wl-btn--primary wl-btn--full" data-action="startQueue">${ICONS.play} 시작</button>` : ""}
      ` : `<div class="wl-hint" style="margin-top:10px">먼저 계획을 짜두고, 준비되면 "시작"을 눌러 순서대로 진행하세요.</div>`}
    </div>`;
}

function renderTimeBlockColumn() {
  const active = state.activeBlock;
  return `
    <section class="wl-card">
      ${active
        ? renderTimerBlock(active.phase === "work"
            ? { label: active.task, phaseLabel: "작업 중", durationMin: WORK_MIN, startedAt: active.startedAt, isBreak: false, workId: active.workId, subtaskId: active.subtaskId }
            : { label: "휴식", phaseLabel: "휴식 중", durationMin: BREAK_MIN, startedAt: active.startedAt, isBreak: true, workId: active.workId, subtaskId: active.subtaskId })
        : `<div class="wl-empty wl-empty--pad">진행 중인 블록이 없어요. 아래에서 계획을 짜고 시작해보세요.</div>`}
    </section>
    <section class="wl-card">
      ${renderQueueSection()}
    </section>`;
}

// ---- render: column 2 — project status ----
function renderProjectStatusRow(w) {
  const latest = (w.updates || [])[0];
  const nextSubtask = (w.subtasks || []).find((s) => !s.done);
  const costTotal = workCostTotal(w);
  const costDraft = drafts.newCost[w.id] || {};
  const costOpen = !!costFormOpen[w.id];
  return `
    <div class="wl-project-row">
      <div class="wl-work-name">${escapeHtml(w.name)}</div>
      ${latest
        ? `<div class="wl-project-status">
            ${latest.image ? `<img src="${latest.image}" class="wl-update-img" alt="" />` : ""}
            <div class="wl-project-status-text">${escapeHtml(latest.text)}</div>
          </div>`
        : `<div class="wl-empty">아직 기록이 없어요.</div>`}
      ${nextSubtask ? `
        <div class="wl-subtask-row">
          <button class="wl-checkbox" data-action="toggleSubtask" data-work="${w.id}" data-sub="${nextSubtask.id}"></button>
          <span class="wl-subtask-name">${escapeHtml(nextSubtask.name)}</span>
        </div>` : ""}
      <div class="wl-project-money">
        <span>쓴 비용 <b>${costTotal.toLocaleString()}원</b></span>
        <span>판매예상 <b>${w.expectedSalePrice != null ? `${w.expectedSalePrice.toLocaleString()}원` : "미설정"}</b></span>
      </div>
      ${costOpen ? `
        <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
          <input class="wl-input wl-input--sm" placeholder="쓴 비용 추가" data-draft="costLabel" data-work="${w.id}" value="${escapeAttr(costDraft.label || "")}" />
          <input class="wl-input wl-input--num" placeholder="금액" inputmode="numeric" data-draft="costAmount" data-work="${w.id}" data-enter-action="addWorkCost" value="${escapeAttr(costDraft.amount || "")}" />
          <button class="wl-btn wl-btn--ghost" data-action="addWorkCost" data-work="${w.id}">${ICONS.check}</button>
          <button class="wl-btn wl-btn--ghost" data-action="toggleCostForm" data-work="${w.id}">${ICONS.x}</button>
        </div>` : `<button class="wl-cost-toggle" data-action="toggleCostForm" data-work="${w.id}">${ICONS.plus} 비용 추가</button>`}
    </div>`;
}

function renderProjectsStatusColumn() {
  const sorted = [...state.works].sort((a, b) => {
    const aAt = (a.updates && a.updates[0] && a.updates[0].at) || 0;
    const bAt = (b.updates && b.updates[0] && b.updates[0].at) || 0;
    return bAt - aAt;
  });
  return `
    <section class="wl-card">
      <div class="wl-work-head">
        <div class="wl-card-title" style="margin-bottom:0">프로젝트 최신 상황</div>
        <button class="wl-icon-btn" data-action="switchTab" data-tab="works-manage">${ICONS.plus}</button>
      </div>
      ${sorted.length === 0 ? `<div class="wl-empty wl-empty--pad">아직 할일이 없어요. '할일 관리'에서 추가해보세요.</div>` : ""}
      ${sorted.map(renderProjectStatusRow).join("")}
    </section>`;
}

// ---- render: column 3 — today summary ----
function renderTodaySummaryColumn() {
  const { todayBlocks, todaySpends, dailyPool, dailySpent, dailyAvailable, overflowToday } = computeToday();
  return `
    <section class="wl-ledger-strip">
      ${figure("오늘 적립", `${dailyPool}${overflowToday ? ` +${overflowToday}` : ""}`)}
      ${figure("오늘 사용", dailySpent)}
      ${figure("오늘 가용", Math.max(0, dailyAvailable), "work")}
      ${figure("저축", state.savings, "save")}
    </section>
    <section class="wl-card">
      <div class="wl-card-title">소비</div>
      <div class="wl-spend-row">
        ${DEFAULT_SPEND_PRESETS.map((p) => `
          <button class="wl-spend-btn" data-action="spendPreset" data-cost="${p.cost}" data-label="${escapeAttr(p.label)}" ${p.cost > dailyAvailable ? "disabled" : ""}>
            ${p.icon === "game" ? ICONS.gamepad : ICONS.globe}
            <span>${escapeHtml(p.label)}</span>
            <span class="wl-spend-cost">${p.cost}점</span>
          </button>`).join("")}
      </div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="다른 것" data-draft="customSpendLabel" value="${escapeAttr(drafts.customSpendLabel)}" />
        <input class="wl-input wl-input--num" placeholder="점" inputmode="numeric" data-draft="customSpendCost" value="${escapeAttr(drafts.customSpendCost)}" />
        <button class="wl-btn wl-btn--ghost" data-action="addCustomSpend">${ICONS.plus}</button>
      </div>
    </section>
    <section class="wl-card">
      <div class="wl-card-title">오늘의 기록</div>
      ${todayBlocks.length === 0 && todaySpends.length === 0 ? `<div class="wl-empty">아직 기록이 없어요.</div>` : ""}
      <ul class="wl-log">
        ${mergeLog(todayBlocks, todaySpends).map((item) => `
          <li class="wl-log-row wl-log-row--${item.kind}">
            <span class="wl-log-time">${formatTime(item.at)}</span>
            <span class="wl-log-label">${escapeHtml(item.label)}</span>
            <span class="wl-log-points">${item.kind === "block" ? "+1" : `-${item.cost}`}</span>
          </li>`).join("")}
      </ul>
    </section>`;
}

// ---- render: column 4 — savings + goals ----
function renderSavingsCard() {
  const pct = Math.min(100, Math.round((state.savings / OFFDAY_COST) * 100));
  const canUse = state.savings >= OFFDAY_COST;
  return `
    <section class="wl-card wl-card--center">
      ${ICONS.piggy}
      <div class="wl-save-total">${state.savings}점</div>
      <div class="wl-progress">
        <div class="wl-progress-bar"><div class="wl-progress-fill is-save" style="width:${pct}%"></div></div>
        <span class="wl-progress-label">${state.savings}/${OFFDAY_COST}</span>
      </div>
      <button class="wl-btn wl-btn--primary wl-btn--full" data-action="useOffDay" ${!canUse ? "disabled" : ""}>휴무권 사용 (-${OFFDAY_COST}점)</button>
      ${!canUse ? `<div class="wl-hint">쓰지 않고 남긴 포인트가 매일 저녁 여기로 쌓여요.</div>` : ""}
    </section>
    <section class="wl-card">
      <div class="wl-card-title">사용 기록</div>
      ${state.offDayLog.length === 0 ? `<div class="wl-empty">아직 없어요.</div>` : ""}
      <ul class="wl-log">
        ${[...state.offDayLog].reverse().map((ts) => `
          <li class="wl-log-row wl-log-row--save">
            <span class="wl-log-time">${escapeHtml(formatKDate(new Date(ts)))}</span>
            <span class="wl-log-label">휴무권 사용</span>
            <span class="wl-log-points">-${OFFDAY_COST}</span>
          </li>`).join("")}
      </ul>
    </section>`;
}

function renderTierRow(t, totalRevenue, showActions, catId) {
  const unlocked = totalRevenue >= t.targetAmount;
  const showActual = t.actualPrice != null && t.actualPrice !== t.targetAmount;
  return `
    <li class="wl-tier-row ${unlocked ? "is-unlocked" : ""}">
      ${t.image ? `<img src="${t.image}" class="wl-thumb" alt="" />` : ""}
      ${ICONS.chevron}
      <span class="wl-tier-label">${escapeHtml(t.label)}</span>
      <span class="wl-tier-amount">목표 ${t.targetAmount.toLocaleString()}원${showActual ? `<span class="wl-tier-actual"> · 실가 ${t.actualPrice.toLocaleString()}원</span>` : ""}</span>
      <span class="wl-tier-status">${unlocked ? "구매 가능" : "미도달"}</span>
      ${showActions ? `
        <button class="wl-icon-btn" data-action="editTier" data-cat="${catId}" data-tier="${t.id}">${ICONS.pencil}</button>
        <button class="wl-icon-btn" data-action="removeTier" data-cat="${catId}" data-tier="${t.id}">${ICONS.x}</button>
      ` : ""}
    </li>`;
}

function renderCategoryGoalCard(c, totalRevenue) {
  const tiers = c.tiers.slice().sort((a, b) => a.targetAmount - b.targetAmount);
  const nextTier = tiers.find((t) => t.targetAmount > totalRevenue);
  const pct = nextTier ? Math.min(100, Math.round((totalRevenue / nextTier.targetAmount) * 100)) : 100;
  const expanded = !!expandedGoalCats[c.id];
  return `
    <section class="wl-card wl-goal-cat-card">
      <button class="wl-goal-cat-toggle" data-action="toggleGoalCategory" data-cat="${c.id}">
        <span class="wl-goal-cat-name">${escapeHtml(c.name)}</span>
        <span class="wl-goal-cat-toggle-icon ${expanded ? "is-expanded" : ""}">${ICONS.chevron}</span>
      </button>
      ${nextTier ? `
        <div class="wl-goal-next">
          ${nextTier.image ? `<img src="${nextTier.image}" class="wl-goal-next-img" alt="${escapeAttr(nextTier.label)}" />` : `<div class="wl-goal-next-img wl-goal-next-img--empty">${ICONS.sparkles}</div>`}
          <div class="wl-goal-next-body">
            <div class="wl-goal-next-label">${escapeHtml(nextTier.label)}</div>
            <div class="wl-progress">
              <div class="wl-progress-bar"><div class="wl-progress-fill is-sales" style="width:${pct}%"></div></div>
              <span class="wl-progress-label">${pct}%</span>
            </div>
            <div class="wl-hint">${(nextTier.targetAmount - totalRevenue).toLocaleString()}원 남음</div>
          </div>
        </div>` : `<div class="wl-empty">이 카테고리 목표를 모두 달성했어요.</div>`}
      ${expanded ? `<ul class="wl-tiers" style="margin-top:10px">${tiers.map((t) => renderTierRow(t, totalRevenue, false, c.id)).join("")}</ul>` : ""}
    </section>`;
}

function renderGoalsColumn() {
  const totalRevenue = state.revenueLog.reduce((a, r) => a + r.amount, 0);
  return `
    <section class="wl-card wl-card--center">
      <div class="wl-work-head" style="width:100%;margin-bottom:0">
        <div class="wl-figure-label">누적 수익</div>
        <button class="wl-icon-btn" data-action="switchTab" data-tab="goals-manage">${ICONS.plus}</button>
      </div>
      <div class="wl-save-total is-sales">${totalRevenue.toLocaleString()}원</div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--num" placeholder="금액" inputmode="numeric" data-draft="newRevenueAmount" data-enter-action="addRevenue" value="${escapeAttr(drafts.newRevenueAmount)}" />
        <button class="wl-btn wl-btn--ghost" data-action="addRevenue">${ICONS.plus} 수익 기록</button>
      </div>
    </section>
    ${state.categories.length === 0 ? `<section class="wl-card"><div class="wl-empty wl-empty--pad">등록된 목표가 없어요. '목표 관리'에서 추가해보세요.</div></section>` : ""}
    ${state.categories.map((c) => renderCategoryGoalCard(c, totalRevenue)).join("")}
    ${state.revenueLog.length > 0 ? `
      <section class="wl-card">
        <div class="wl-card-title">수익 기록</div>
        <ul class="wl-log">
          ${state.revenueLog.map((r) => `
            <li class="wl-log-row wl-log-row--sales">
              <span class="wl-log-time">${r.date.slice(5)}</span>
              <span class="wl-log-label">수익</span>
              <span class="wl-log-points">${r.amount.toLocaleString()}원</span>
              <button class="wl-icon-btn" data-action="removeRevenue" data-id="${r.id}">${ICONS.x}</button>
            </li>`).join("")}
        </ul>
      </section>` : ""}`;
}

function renderDashboard() {
  return `
    <div class="wl-dashboard-grid">
      <div class="wl-dash-col">${renderTimeBlockColumn()}</div>
      <div class="wl-dash-col">${renderProjectsStatusColumn()}</div>
      <div class="wl-dash-col">${renderTodaySummaryColumn()}</div>
      <div class="wl-dash-col">${renderSavingsCard()}${renderGoalsColumn()}</div>
    </div>`;
}

// ---- render: works-manage tab ----
function renderWorkManageCard(w) {
  const done = w.subtasks.filter((s) => s.done).length;
  const total = w.subtasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isEditing = editingWorkId === w.id;
  return `
    <section class="wl-card">
      <div class="wl-work-head">
        ${isEditing ? `
          <div class="wl-field-row wl-field-row--tight wl-field-row--wrap" style="flex:1;margin:0">
            <input class="wl-input wl-input--sm" data-draft="editWorkName" value="${escapeAttr(editingWorkDraft.name)}" placeholder="할일 이름" data-enter-action="saveEditWork" />
            <input class="wl-input wl-input--num" data-draft="editWorkExpected" value="${escapeAttr(editingWorkDraft.expectedSalePrice)}" placeholder="판매예상" inputmode="numeric" data-enter-action="saveEditWork" />
            <button class="wl-icon-btn" data-action="saveEditWork">${ICONS.check}</button>
            <button class="wl-icon-btn" data-action="cancelEditWork">${ICONS.x}</button>
          </div>` : `
          <div class="wl-work-name">${escapeHtml(w.name)}${w.expectedSalePrice != null ? `<span class="wl-work-expected"> · 판매예상 ${w.expectedSalePrice.toLocaleString()}원</span>` : ""}</div>
          <div>
            <button class="wl-icon-btn" data-action="editWork" data-work="${w.id}">${ICONS.pencil}</button>
            <button class="wl-icon-btn" data-action="removeWork" data-work="${w.id}">${ICONS.trash}</button>
          </div>`}
      </div>
      <div class="wl-progress">
        <div class="wl-progress-bar"><div class="wl-progress-fill" style="width:${pct}%"></div></div>
        <span class="wl-progress-label">${done}/${total}</span>
      </div>
      <ul class="wl-subtasks">
        ${w.subtasks.map((st, idx) => {
          const mins = subtaskMinutes(w.id, st.id);
          return `
          <li class="wl-subtask-row wl-subtask-row--draggable" draggable="true" data-drag-kind="subtask" data-work="${w.id}" data-index="${idx}">
            ${ICONS.grip}
            <button class="wl-checkbox ${st.done ? "is-done" : ""}" data-action="toggleSubtask" data-work="${w.id}" data-sub="${st.id}">${st.done ? ICONS.check : ""}</button>
            <span class="wl-subtask-name ${st.done ? "is-done" : ""}">${escapeHtml(st.name)}</span>
            ${mins > 0 ? `<span class="wl-subtask-time">${mins}분</span>` : ""}
            <button class="wl-icon-btn" data-action="removeSubtask" data-work="${w.id}" data-sub="${st.id}">${ICONS.x}</button>
          </li>`;
        }).join("")}
      </ul>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="하위 할일 추가" data-draft="newSubtask" data-work="${w.id}" data-enter-action="addSubtask" value="${escapeAttr(drafts.newSubtask[w.id] || "")}" />
        <button class="wl-btn wl-btn--ghost" data-action="addSubtask" data-work="${w.id}">${ICONS.plus}</button>
      </div>
      ${(w.updates || []).length > 0 ? `
        <div class="wl-card-title" style="margin-top:14px">세션 기록</div>
        <ul class="wl-session-log">
          ${w.updates.map((u) => `
            <li class="wl-session-log-row">
              ${u.image ? `<img src="${u.image}" class="wl-update-img" alt="" />` : ""}
              <div class="wl-session-log-body">
                <div class="wl-session-log-text">${escapeHtml(u.text)}</div>
                <div class="wl-session-log-meta">${escapeHtml(formatKDate(new Date(u.at)))} ${formatTime(u.at)}</div>
              </div>
              <button class="wl-icon-btn" data-action="removeWorkUpdate" data-work="${w.id}" data-update="${u.id}">${ICONS.x}</button>
            </li>`).join("")}
        </ul>` : ""}
    </section>`;
}

function renderWorksManage() {
  return `
    <div class="wl-body">
      <section class="wl-card">
        <div class="wl-field-row">
          <input class="wl-input" placeholder="새 할일 이름" data-draft="newWorkName" data-enter-action="addWork" value="${escapeAttr(drafts.newWorkName)}" />
          <input class="wl-input wl-input--num" placeholder="판매예상(선택)" inputmode="numeric" data-draft="newWorkExpected" data-enter-action="addWork" value="${escapeAttr(drafts.newWorkExpected)}" />
          <button class="wl-btn wl-btn--primary" data-action="addWork">${ICONS.plus} 추가</button>
        </div>
      </section>
      ${state.works.length === 0 ? `<div class="wl-empty wl-empty--pad">등록된 할일이 없어요. 위에서 하나 추가해보세요.</div>` : ""}
      ${state.works.map(renderWorkManageCard).join("")}
    </div>`;
}

// ---- render: goals-manage tab ----
function renderCategoryManageCard(c, totalRevenue, idx) {
  const tiers = c.tiers.slice().sort((a, b) => a.targetAmount - b.targetAmount);
  const draft = drafts.newTier[c.id] || {};
  const isEditingName = editingCategoryId === c.id;
  return `
    <section class="wl-card" data-drag-kind="category" data-index="${idx}">
      <div class="wl-work-head">
        ${isEditingName ? `
          <div class="wl-field-row wl-field-row--tight" style="flex:1;margin:0">
            <input class="wl-input wl-input--sm" data-draft="editCategoryName" value="${escapeAttr(editingCategoryDraft)}" data-enter-action="saveEditCategory" />
            <button class="wl-icon-btn" data-action="saveEditCategory">${ICONS.check}</button>
            <button class="wl-icon-btn" data-action="cancelEditCategory">${ICONS.x}</button>
          </div>` : `
          <div class="wl-work-head-left">
            <span draggable="true" data-drag-kind="category" data-index="${idx}" class="wl-drag-handle">${ICONS.grip}</span>
            <div class="wl-work-name">${escapeHtml(c.name)}</div>
          </div>
          <div>
            <button class="wl-icon-btn" data-action="editCategory" data-cat="${c.id}">${ICONS.pencil}</button>
            <button class="wl-icon-btn" data-action="removeCategory" data-cat="${c.id}">${ICONS.trash}</button>
          </div>`}
      </div>
      <ul class="wl-tiers">${tiers.map((t) => renderTierRow(t, totalRevenue, true, c.id)).join("")}</ul>
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" placeholder="가격대 이름" data-draft="tierLabel" data-cat="${c.id}" value="${escapeAttr(draft.label || "")}" />
        <input class="wl-input wl-input--num" placeholder="목표 금액" inputmode="numeric" data-draft="tierTargetAmount" data-cat="${c.id}" value="${escapeAttr(draft.targetAmount || "")}" />
        <input class="wl-input wl-input--num" placeholder="실제 가격(선택)" inputmode="numeric" data-draft="tierActualPrice" data-cat="${c.id}" value="${escapeAttr(draft.actualPrice || "")}" />
        ${renderImagePicker({ value: draft.image || null, pickAction: "pickTierImage", clearAction: "clearTierImage", cat: c.id })}
        <button class="wl-btn wl-btn--ghost" data-action="addTier" data-cat="${c.id}">${draft.editingId ? ICONS.check : ICONS.plus} ${draft.editingId ? "저장" : ""}</button>
        ${draft.editingId ? `<button class="wl-btn wl-btn--ghost" data-action="cancelEditTier" data-cat="${c.id}">${ICONS.x}</button>` : ""}
      </div>
    </section>`;
}

function renderGoalsManage() {
  const totalRevenue = state.revenueLog.reduce((a, r) => a + r.amount, 0);
  return `
    <div class="wl-body">
      <section class="wl-card">
        <div class="wl-field-row">
          <input class="wl-input" placeholder="새 카테고리 (예: 시계)" data-draft="newCategoryName" data-enter-action="addCategory" value="${escapeAttr(drafts.newCategoryName)}" />
          <button class="wl-btn wl-btn--primary" data-action="addCategory">${ICONS.plus} 추가</button>
        </div>
      </section>
      ${state.categories.length === 0 ? `<div class="wl-empty wl-empty--pad">등록된 카테고리가 없어요.</div>` : ""}
      ${state.categories.length > 1 ? `<div class="wl-hint">카드 왼쪽 손잡이를 드래그하면 우선순위(표시 순서)를 바꿀 수 있어요.</div>` : ""}
      ${state.categories.map((c, idx) => renderCategoryManageCard(c, totalRevenue, idx)).join("")}
    </div>`;
}

// ---- render: shell / settings / loading ----
function renderShell() {
  return `
    <div class="wl-root">
      <header class="wl-header">
        <div class="wl-header-top">
          <div class="wl-brand">작업 장부</div>
          <div class="wl-header-right">
            <div class="wl-date">${escapeHtml(formatKDate(new Date()))}</div>
            <button class="wl-icon-btn" data-action="openSettings" title="설정">${ICONS.gear}</button>
          </div>
        </div>
        <nav class="wl-tabs">
          <button class="wl-tab ${currentTab === "dashboard" ? "is-active" : ""}" data-action="switchTab" data-tab="dashboard">홈</button>
          <button class="wl-tab ${currentTab === "works-manage" ? "is-active" : ""}" data-action="switchTab" data-tab="works-manage">할일 관리</button>
          <button class="wl-tab ${currentTab === "goals-manage" ? "is-active" : ""}" data-action="switchTab" data-tab="goals-manage">목표 관리</button>
        </nav>
      </header>
      <div id="wl-save-status" class="wl-savebar"></div>
      ${currentTab === "dashboard" ? renderDashboard() : currentTab === "works-manage" ? renderWorksManage() : renderGoalsManage()}
    </div>`;
}

function renderLoading() {
  return `<div class="wl-loading">불러오는 중…</div>`;
}
function renderLoadError() {
  return `
    <div class="wl-loading">
      <div class="wl-loading-error">데이터를 불러오지 못했어요.<br/>${escapeHtml(loadErrorMsg)}</div>
      <div class="wl-settings-actions" style="max-width:280px;margin:0 auto;">
        <button class="wl-btn wl-btn--primary" data-action="retryLoad">다시 시도</button>
        <button class="wl-btn wl-btn--ghost" data-action="openSettings">설정 열기</button>
      </div>
    </div>`;
}

function renderSettingsOverlay() {
  const s = drafts.settings || getCredentials();
  const canClose = hasCredentials();
  const msg = drafts.settingsMsg;
  return `
    <div class="wl-settings-overlay">
      <div class="wl-settings-panel">
        <div class="wl-settings-title">GitHub 연결 설정</div>
        <div class="wl-settings-desc">
          데이터를 저장할 프라이빗 저장소 정보와, Contents 읽기/쓰기 권한을 가진 fine-grained
          PAT를 입력하세요. 이 정보는 이 브라우저에만 저장되고 어디에도 전송되지 않아요.
        </div>
        <div class="wl-settings-field">
          <label class="wl-settings-label">Personal Access Token</label>
          <input type="password" class="wl-input" data-draft="settingsToken" value="${escapeAttr(s.token)}" placeholder="github_pat_..." autocomplete="off" />
        </div>
        <div class="wl-settings-field">
          <label class="wl-settings-label">저장소 소유자 (owner)</label>
          <input class="wl-input" data-draft="settingsOwner" value="${escapeAttr(s.owner)}" placeholder="예: my-github-account" />
        </div>
        <div class="wl-settings-field">
          <label class="wl-settings-label">저장소 이름 (repo)</label>
          <input class="wl-input" data-draft="settingsRepo" value="${escapeAttr(s.repo)}" placeholder="예: my-data-repo" />
        </div>
        <div class="wl-settings-field">
          <label class="wl-settings-label">브랜치</label>
          <input class="wl-input" data-draft="settingsBranch" value="${escapeAttr(s.branch)}" placeholder="main" />
        </div>
        <div class="wl-settings-field">
          <label class="wl-settings-label">파일 경로</label>
          <input class="wl-input" data-draft="settingsPath" value="${escapeAttr(s.path)}" placeholder="state.json" />
        </div>
        ${msg ? `<div class="wl-settings-msg wl-settings-msg--${msg.type === "ok" ? "ok" : "error"}">${escapeHtml(msg.text)}</div>` : ""}
        <div class="wl-settings-actions">
          <button class="wl-btn wl-btn--ghost" data-action="testSettings" ${drafts.settingsBusy ? "disabled" : ""}>연결 테스트</button>
          <button class="wl-btn wl-btn--primary" data-action="saveSettings" ${drafts.settingsBusy ? "disabled" : ""}>저장하고 시작</button>
        </div>
        ${canClose ? `
          <div class="wl-settings-actions">
            <button class="wl-btn wl-btn--ghost" data-action="closeSettings">닫기</button>
            <button class="wl-btn wl-btn--ghost" data-action="logout">로그아웃</button>
          </div>` : ""}
      </div>
    </div>`;
}

function render() {
  const root = document.getElementById("app");
  let html = "";
  if (phase === "loading") html = renderLoading();
  else if (phase === "loadError") html = renderLoadError();
  else if (state) html = renderShell();
  root.innerHTML = html;
  if (settingsOpen) root.insertAdjacentHTML("beforeend", renderSettingsOverlay());
  updateSaveIndicator();
}

// ---- event wiring ----
function runAction(name, ds) {
  switch (name) {
    case "finishEarly": finishEarly(); break;
    case "skipBreak": skipBreak(); break;
    case "cancelBlock": cancelBlock(); break;
    case "spendPreset": spend(ds.label, Number(ds.cost)); break;
    case "addCustomSpend": addCustomSpend(); break;
    case "useOffDay": useOffDay(); break;
    case "openSettings": openSettings(); break;
    case "closeSettings": closeSettings(); break;
    case "saveSettings": submitSettings(); break;
    case "testSettings": testSettingsForm(); break;
    case "logout": doLogout(); break;
    case "switchTab": switchTab(ds.tab); break;
    case "retryLoad": boot(); break;
    case "addWork": addWork(); break;
    case "removeWork": removeWork(ds.work); break;
    case "editWork": startEditWork(ds.work); break;
    case "saveEditWork": saveEditWork(); break;
    case "cancelEditWork": cancelEditWork(); break;
    case "addSubtask": addSubtask(ds.work); break;
    case "toggleSubtask": toggleSubtask(ds.work, ds.sub); break;
    case "removeSubtask": removeSubtask(ds.work, ds.sub); break;
    case "addWorkCost": addWorkCost(ds.work); break;
    case "removeWorkCost": removeWorkCost(ds.work, ds.cost); break;
    case "removeWorkUpdate": removeWorkUpdate(ds.work, ds.update); break;
    case "toggleCostForm": toggleCostForm(ds.work); break;
    case "clearPendingUpdateImage": drafts.pendingUpdate.image = null; render(); break;
    case "togglePendingSubtaskDone": drafts.pendingUpdate.subtaskDone = !drafts.pendingUpdate.subtaskDone; render(); break;
    case "addRevenue": addRevenue(); break;
    case "removeRevenue": removeRevenue(ds.id); break;
    case "addCategory": addCategory(); break;
    case "removeCategory": removeCategory(ds.cat); break;
    case "editCategory": startEditCategory(ds.cat); break;
    case "saveEditCategory": saveEditCategory(); break;
    case "cancelEditCategory": cancelEditCategory(); break;
    case "addTier": addTier(ds.cat); break;
    case "editTier": startEditTier(ds.cat, ds.tier); break;
    case "cancelEditTier": cancelEditTier(ds.cat); break;
    case "removeTier": removeTier(ds.cat, ds.tier); break;
    case "clearTierImage":
      drafts.newTier[ds.cat] = { ...(drafts.newTier[ds.cat] || {}), image: null };
      render();
      break;
    case "addToQueue": addToQueue(); break;
    case "removeFromQueue": removeFromQueue(ds.id); break;
    case "startQueue": startQueue(); break;
    case "toggleGoalCategory": toggleGoalCategoryExpand(ds.cat); break;
  }
}

function onRootClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  e.preventDefault();
  runAction(el.dataset.action, el.dataset);
}

function onRootKeydown(e) {
  if (e.key !== "Enter") return;
  const el = e.target.closest("[data-enter-action]");
  if (!el) return;
  e.preventDefault();
  runAction(el.dataset.enterAction, el.dataset);
}

function onRootInput(e) {
  const el = e.target.closest("[data-draft]");
  if (!el) return;
  const key = el.dataset.draft;
  const value = el.value;
  const clampNumeric = () => {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (cleaned !== value) el.value = cleaned;
    return cleaned;
  };
  switch (key) {
    case "customSpendLabel": drafts.customSpendLabel = value; break;
    case "customSpendCost": drafts.customSpendCost = clampNumeric(); break;
    case "newWorkName": drafts.newWorkName = value; break;
    case "newWorkExpected": drafts.newWorkExpected = clampNumeric(); break;
    case "editWorkName": editingWorkDraft.name = value; break;
    case "editWorkExpected": editingWorkDraft.expectedSalePrice = clampNumeric(); break;
    case "newSubtask": drafts.newSubtask[el.dataset.work] = value; break;
    case "pendingUpdateText": drafts.pendingUpdate.text = value; break;
    case "newRevenueAmount": drafts.newRevenueAmount = clampNumeric(); break;
    case "newCategoryName": drafts.newCategoryName = value; break;
    case "editCategoryName": editingCategoryDraft = value; break;
    case "tierLabel": {
      const catId = el.dataset.cat;
      drafts.newTier[catId] = { ...(drafts.newTier[catId] || {}), label: value };
      break;
    }
    case "tierTargetAmount": {
      const catId = el.dataset.cat;
      drafts.newTier[catId] = { ...(drafts.newTier[catId] || {}), targetAmount: clampNumeric() };
      break;
    }
    case "tierActualPrice": {
      const catId = el.dataset.cat;
      drafts.newTier[catId] = { ...(drafts.newTier[catId] || {}), actualPrice: clampNumeric() };
      break;
    }
    case "costLabel": {
      const workId = el.dataset.work;
      drafts.newCost[workId] = { ...(drafts.newCost[workId] || {}), label: value };
      break;
    }
    case "costAmount": {
      const workId = el.dataset.work;
      drafts.newCost[workId] = { ...(drafts.newCost[workId] || {}), amount: clampNumeric() };
      break;
    }
    case "queueTask": drafts.queueDraft.task = value; break;
    case "settingsToken": drafts.settings.token = value; break;
    case "settingsOwner": drafts.settings.owner = value; break;
    case "settingsRepo": drafts.settings.repo = value; break;
    case "settingsBranch": drafts.settings.branch = value; break;
    case "settingsPath": drafts.settings.path = value; break;
  }
}

async function onRootChange(e) {
  const filePick = e.target.closest("[data-filepick]");
  if (filePick) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      const action = filePick.dataset.filepick;
      if (action === "pickTierImage") {
        const catId = filePick.dataset.cat;
        drafts.newTier[catId] = { ...(drafts.newTier[catId] || {}), image: dataUrl };
      } else if (action === "pickPendingUpdateImage") {
        drafts.pendingUpdate.image = dataUrl;
      }
      render();
    } catch (err) {
      // image is optional — ignore failures silently
    }
    return;
  }
  const select = e.target.closest("[data-select]");
  if (select) {
    const kind = select.dataset.select;
    if (kind === "queueWork") { drafts.queueDraft.workId = select.value; drafts.queueDraft.subtaskId = ""; render(); }
    if (kind === "queueSub") { drafts.queueDraft.subtaskId = select.value; }
  }
}

function onRootDragStart(e) {
  const el = e.target.closest("[data-drag-kind]");
  if (!el) return;
  dragSource = { kind: el.dataset.dragKind, work: el.dataset.work || null, index: Number(el.dataset.index) };
  el.classList.add("is-dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", el.dataset.index);
  }
}
function onRootDragOver(e) {
  if (!dragSource) return;
  const el = e.target.closest("[data-drag-kind]");
  if (!el || el.dataset.dragKind !== dragSource.kind) return;
  if (dragSource.kind === "subtask" && el.dataset.work !== dragSource.work) return;
  e.preventDefault();
}
function onRootDrop(e) {
  if (!dragSource) return;
  const el = e.target.closest("[data-drag-kind]");
  if (!el || el.dataset.dragKind !== dragSource.kind) { dragSource = null; return; }
  if (dragSource.kind === "subtask" && el.dataset.work !== dragSource.work) { dragSource = null; return; }
  e.preventDefault();
  const toIndex = Number(el.dataset.index);
  if (dragSource.kind === "subtask") reorderSubtasks(dragSource.work, dragSource.index, toIndex);
  else if (dragSource.kind === "queue" && toIndex !== dragSource.index) { reorderArray(state.queue, dragSource.index, toIndex); persistAndRender(); }
  else if (dragSource.kind === "category" && toIndex !== dragSource.index) reorderCategories(dragSource.index, toIndex);
  dragSource = null;
}
function onRootDragEnd(e) {
  const el = e.target.closest("[data-drag-kind]");
  if (el) el.classList.remove("is-dragging");
  dragSource = null;
}

function attachHandlers() {
  const root = document.getElementById("app");
  root.addEventListener("click", onRootClick);
  root.addEventListener("input", onRootInput);
  root.addEventListener("change", onRootChange);
  root.addEventListener("keydown", onRootKeydown);
  root.addEventListener("dragstart", onRootDragStart);
  root.addEventListener("dragover", onRootDragOver);
  root.addEventListener("drop", onRootDrop);
  root.addEventListener("dragend", onRootDragEnd);
}

attachHandlers();
boot();
