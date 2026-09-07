import {
  getCredentials, saveCredentials, clearCredentials, hasCredentials,
  testConnection, fetchState, writeState,
} from "./github-api.js";

// ---- config ----
const WORK_MIN = 50;
const BREAK_MIN = 10;
const OFFDAY_COST = 15;
const SPEND_INCLUDED_MIN = 60; // a preset's points buy this much time up front
const SPEND_MIN_PER_POINT = 10; // past the included time: 1 more point per 10 minutes
const SIZE_WARN_BYTES = 900 * 1024; // Contents API caps file writes around 1MB

const DEFAULT_SPEND_PRESETS = [
  { label: "게임", cost: 3 },
  { label: "웹서핑", cost: 3 },
];

const DEFAULT_TAGS = [
  { name: "제작", points: 3 },
  { name: "개발", points: 2 },
  { name: "사무", points: 1 },
  { name: "습관", points: 1 },
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
  archive: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"></rect><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"></path><line x1="10" y1="13" x2="14" y2="13"></line></svg>',
  bell: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
  pip: '<svg class="wl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none"></rect></svg>',
  pause: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="4" x2="9" y2="20"></line><line x1="15" y1="4" x2="15" y2="20"></line></svg>',
  resume: '<svg class="wl-icon wl-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>',
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
  const b = blocks.map((x) => ({ id: x.id, kind: "block", label: x.task, at: x.completedAt, points: blockPoints(x), block: x }));
  const s = spends.map((x) => ({ id: x.id, kind: "spend", label: x.label, cost: x.cost, at: x.at }));
  return [...b, ...s].sort((a, c) => c.at - a.at);
}
function blockPoints(b) {
  return b.points != null ? b.points : 1;
}
function dailyPoolFromBlocks(blocks) {
  return blocks.reduce((a, b) => a + blockPoints(b), 0);
}
function pointsForWork(workId) {
  if (!workId) return 1;
  const w = state.works.find((x) => x.id === workId);
  const tag = w && w.tagId ? state.tags.find((t) => t.id === w.tagId) : null;
  return tag ? tag.points : 1;
}
// A session can cover more than one 할일: switching mid-session splits it into
// segments instead of ending the block. Blocks recorded before that existed
// (and single-할일 sessions) read back as one segment.
function blockSegments(b) {
  if (b.segments && b.segments.length) return b.segments;
  return [{ workId: b.workId || null, subtaskId: b.subtaskId || null, task: b.task, minutes: blockMinutes(b) }];
}
// Scoring uses one tag value for the whole session, weighted by how long each
// 할일 got — so splitting a session honestly scores about the same as spending
// it all on one thing, instead of being punished by the under-50분 rules.
function segmentsBasePoints(segments) {
  const total = segments.reduce((a, s) => a + s.minutes, 0);
  if (total <= 0) return pointsForWork(segments.length ? segments[0].workId : null);
  return segments.reduce((a, s) => a + pointsForWork(s.workId) * s.minutes, 0) / total;
}
// 25분 이하로 끝내면 기록만 하고 점수 없음, 25~50분이면 절반,
// 목표 시간(50분)을 채우면 정상 지급 + 초과 25분마다 1점 보너스.
function computeBlockPoints(basePoints, minutes) {
  if (minutes <= 25) return 0;
  if (minutes < WORK_MIN) return Math.round(basePoints / 2);
  const overtimeBonus = Math.floor((minutes - WORK_MIN) / 25);
  return Math.round(basePoints) + overtimeBonus;
}
// 세션이 끝나면 휴식 화면에서 스스로 매기는 평가. 기본값은 "보통"(0)이라
// 아무것도 고르지 않으면 점수가 그대로입니다.
const SESSION_RATINGS = [
  { id: "focused", label: "몰입", adjust: 1, hint: "거의 안 끊기고 집중했어요" },
  { id: "normal", label: "보통", adjust: 0, hint: "평소만큼 했어요" },
  { id: "scattered", label: "산만", adjust: -1, hint: "자주 끊기거나 딴짓했어요" },
];
function ratingAdjust(rating) {
  const r = SESSION_RATINGS.find((x) => x.id === rating);
  return r ? r.adjust : 0;
}
// 평가는 이미 딴 점수를 ±1 움직일 뿐, 없던 점수를 만들지는 않습니다.
// 25분 이하로 끝나 0점인 블록은 몰입이어도 0점 그대로입니다.
function pointsWithRating(basePoints, minutes, rating) {
  const base = computeBlockPoints(basePoints, minutes);
  if (base <= 0) return 0;
  return Math.max(0, base + ratingAdjust(rating));
}
function blockBasePoints(b) {
  return computeBlockPoints(segmentsBasePoints(blockSegments(b)), blockMinutes(b));
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
    borrowedByDate: {},
    collapsedWorks: {},
    savings: 0,
    processedDates: [],
    offDayLog: [],
    works: [],
    revenueLog: [],
    categories: [],
    activeBlock: null,
    activeSpend: null,
    cancelledBlock: null,
    queue: [],
    tags: DEFAULT_TAGS.map((t) => ({ id: uid(), ...t })),
    spendPresets: DEFAULT_SPEND_PRESETS.map((p) => ({ id: uid(), label: p.label, cost: p.cost })),
  };
}

// Migrates older saved shapes (tier.amount -> targetAmount/actualPrice, missing
// works.costs/expectedSalePrice/queue/tagId, missing tags list) so existing
// GitHub-stored state keeps working.
function normalizeState(s) {
  s.works = (s.works || []).map((w) => ({
    ...w,
    subtasks: w.subtasks || [],
    updates: w.updates || [],
    costs: w.costs || [],
    expectedSalePrice: w.expectedSalePrice != null ? w.expectedSalePrice : null,
    archived: w.archived === true,
    tagId: w.tagId || null,
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
  s.borrowedByDate = s.borrowedByDate || {};
  s.collapsedWorks = s.collapsedWorks || {};
  // 진행 중/대기 구분이 없던 상태에서 넘어올 때는, 최근에 기록이 있던
  // 프로젝트 순으로 한도만큼만 진행 중으로 올려둡니다. 그 뒤로는 수동입니다.
  if (!s.works.some((w) => w.wip !== undefined)) {
    const recent = s.works
      .filter((w) => !w.archived && (w.updates || []).length > 0)
      .sort((a, b) => (b.updates[0].at || 0) - (a.updates[0].at || 0))
      .slice(0, WIP_LIMIT)
      .map((w) => w.id);
    s.works.forEach((w) => { w.wip = recent.includes(w.id); });
  }
  s.works.forEach((w) => { w.wip = w.wip === true; });
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
let editingWorkDraft = { name: "", expectedSalePrice: "", tagId: "" };
let dragSource = null;
let costFormOpen = {};
let expandedGoalCats = {};
let archivedSectionOpen = false;
let editingTagId = null;
let editingTagDraft = { name: "", points: "" };
let lightboxImage = null;
let editingBlockId = null;
let editingBlockMinutesDraft = "";
let spendPresetsEditOpen = false;
let notifiedKey = null;
let renderedDay = null;
let resetConfirm = null;
let switchFormOpen = false;
let manualBlockOpen = false;
let floatingTimerOn = false;
let floatingTimerNote = "";
let timerWindow = null;
const BASE_TITLE = document.title;
let editingPresetId = null;
let editingPresetDraft = { label: "", cost: "" };

const drafts = {
  newWorkName: "",
  newWorkExpected: "",
  newWorkTag: "",
  newSubtask: {},
  newTagName: "",
  newTagPoints: "",
  newPresetLabel: "",
  newPresetCost: "",
  pendingUpdate: { text: "", image: null, subtaskDone: false, costLabel: "", costAmount: "", extraLinks: [] },
  newRevenueAmount: "",
  newCategoryName: "",
  newTier: {},
  newCost: {},
  queueDraft: { task: "", workId: "", subtaskId: "", extraLinks: [] },
  switchDraft: { task: "", workId: "", subtaskId: "" },
  manualBlock: { task: "", workId: "", subtaskId: "", date: "", time: "", minutes: "" },
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
    const leftover = Math.max(0, dailyPoolFromBlocks(blocks) - spentTotal(spends));
    addTo += leftover;
    newlyProcessed.push(date);
    delete state.borrowedByDate[date];
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

// The clock never auto-transitions phases anymore — past the target duration
// it just keeps counting up (overtime) until the user presses the button.
function onTick() {
  if (!state) return;
  updateTimerDisplay();
  updateSpendTimerDisplay();
  updateTitleTimer();
  drawFloatingTimer();
  if (timerWindow && timerWindow.closed) { timerWindow = null; floatingTimerOn = false; render(); }
  maybeNotifyTimerDone();
  if (Date.now() - lastMinuteCheck > 60000) {
    lastMinuteCheck = Date.now();
    const savingsChanged = reconcileSavings();
    const spendChanged = applyActiveSpendTick();
    // A tab left open past midnight would otherwise keep showing yesterday's
    // "오늘" numbers until something else forces a render.
    const dayChanged = renderedDay !== todayKey();
    // The undo banner counts down in minutes, and has to clear itself when the
    // window closes rather than sitting there offering a dead button.
    const undoShowing = !!state.cancelledBlock && !state.activeBlock;
    if (undoShowing && !pendingCancelUndo()) state.cancelledBlock = null;
    if (savingsChanged || spendChanged) persistAndRender();
    else if (dayChanged || undoShowing) render();
  }
}

// ---- paused time ----
// A paused session keeps running on the wall clock but must not earn anything,
// so every place that measures a session reads through these helpers instead of
// subtracting startedAt directly. `pausedAt` is the pause currently open;
// `pausedMs` / `segPausedMs` are the pauses already closed for the block and
// for the stretch running on the current 할일.
function bankedPause(active, now) {
  const open = active.pausedAt ? Math.max(0, now - active.pausedAt) : 0;
  return {
    pausedMs: (active.pausedMs || 0) + open,
    segPausedMs: (active.segPausedMs || 0) + open,
  };
}
function activeElapsedMs(active, now = Date.now()) {
  return Math.max(0, now - active.startedAt - bankedPause(active, now).pausedMs);
}
function segmentElapsedMs(active, now = Date.now()) {
  const start = active.segmentStartedAt || active.startedAt;
  return Math.max(0, now - start - bankedPause(active, now).segPausedMs);
}
function isPaused(active) {
  return !!(active && active.pausedAt);
}

// What a running timer is showing right now, shared by the tab title and the
// floating window so they never disagree.
function runningTimerInfo() {
  const b = state.activeBlock;
  if (b) {
    const isBreak = b.phase === "break";
    const elapsed = activeElapsedMs(b);
    return {
      clock: formatClock(elapsed),
      label: isPaused(b) ? `일시정지 · ${b.task}` : (isBreak ? "휴식" : b.task),
      accent: isPaused(b) ? "#8C8474" : (isBreak ? "#C9A227" : "#8FA876"),
      over: !isPaused(b) && elapsed > (isBreak ? BREAK_MIN : WORK_MIN) * 60000,
    };
  }
  const s = state.activeSpend;
  if (s) {
    return {
      clock: formatClock(Date.now() - s.startedAt),
      label: `${s.label} · -${spendElapsedPoints(s)}점`,
      accent: "#C0684A",
      over: spendMinutes(s) > SPEND_INCLUDED_MIN,
    };
  }
  return null;
}
// The closest a web page gets to a menu-bar clock: the tab title, which
// desktop browsers show even while the window sits behind something else.
function updateTitleTimer() {
  const info = runningTimerInfo();
  document.title = info ? `${info.clock} · ${info.label}` : BASE_TITLE;
}

// A floating always-on-top window, done as picture-in-picture over a canvas —
// the one way a page can stay visible above other apps. Unsupported browsers
// simply never see the button.
// Every browser can show the fallback window, so the button is always offered.
function floatingTimerSupported() {
  return true;
}
function drawFloatingTimer() {
  const canvas = document.getElementById("wl-pip-canvas");
  if (!canvas || !floatingTimerOn) return;
  const info = runningTimerInfo();
  const ctx = canvas.getContext("2d");
  const { width: W, height: H } = canvas;
  ctx.fillStyle = "#1B1917";
  ctx.fillRect(0, 0, W, H);
  if (!info) {
    ctx.fillStyle = "#8C8474";
    ctx.font = "500 28px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("진행 중인 블록 없음", W / 2, H / 2 + 10);
    return;
  }
  ctx.fillStyle = info.over ? "#C0684A" : info.accent;
  ctx.font = "600 96px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(info.clock, W / 2, H / 2 + 14);
  ctx.fillStyle = "#BDB4A2";
  ctx.font = "500 30px -apple-system, system-ui, sans-serif";
  const label = info.label.length > 18 ? `${info.label.slice(0, 17)}…` : info.label;
  ctx.fillText(label, W / 2, H / 2 + 70);
}
function closeFloatingTimer() {
  const video = document.getElementById("wl-pip-video");
  floatingTimerOn = false;
  try {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else if (video && video.webkitSetPresentationMode) video.webkitSetPresentationMode("inline");
  } catch (e) { /* already closed */ }
  if (timerWindow && !timerWindow.closed) timerWindow.close();
  timerWindow = null;
  render();
}
// Safari refuses picture-in-picture from a canvas stream, and it only honours
// the request inside the click itself — so the call goes out synchronously,
// and anything that fails falls back to a small separate window.
function toggleFloatingTimer() {
  if (floatingTimerOn) { closeFloatingTimer(); return; }
  const canvas = document.getElementById("wl-pip-canvas");
  const video = document.getElementById("wl-pip-video");
  floatingTimerOn = true;
  floatingTimerNote = "";
  drawFloatingTimer();
  try {
    if (!video.srcObject) video.srcObject = canvas.captureStream(2);
    const playing = video.play();
    if (playing && playing.catch) playing.catch(() => {});
    if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(() => openTimerWindow("이 브라우저는 화면 위 타이머를 지원하지 않아 창으로 띄웠어요."));
    } else if (video.webkitSupportsPresentationMode && video.webkitSupportsPresentationMode("picture-in-picture")) {
      video.webkitSetPresentationMode("picture-in-picture");
      // Safari reports support but silently stays inline for canvas streams.
      setTimeout(() => {
        if (floatingTimerOn && video.webkitPresentationMode !== "picture-in-picture") {
          openTimerWindow("사파리는 화면 위 타이머를 막아서 창으로 띄웠어요.");
        }
      }, 700);
    } else {
      openTimerWindow("");
    }
  } catch (e) {
    openTimerWindow("");
  }
  render();
}
// The fallback: a small always-available window that runs its own clock from
// the start timestamp, so it stays right even when this tab is throttled.
function openTimerWindow(note) {
  floatingTimerNote = note || "";
  if (timerWindow && !timerWindow.closed) { syncTimerWindow(); timerWindow.focus(); return; }
  timerWindow = window.open("", "wl-timer", "width=280,height=150,menubar=no,toolbar=no,location=no,status=no");
  if (!timerWindow) {
    floatingTimerOn = false;
    floatingTimerNote = "팝업이 차단됐어요. 브라우저에서 이 사이트의 팝업을 허용해주세요.";
    render();
    return;
  }
  timerWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>타이머</title><style>
    html,body{margin:0;height:100%;background:#1B1917;color:#E8E1D3;
      font-family:-apple-system,system-ui,sans-serif;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:6px;-webkit-user-select:none;user-select:none}
    #c{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:44px;font-weight:600;line-height:1}
    #l{font-size:13px;color:#BDB4A2;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  </style></head><body><div id="c">--:--</div><div id="l"></div><script>
    function pad(n){return String(n).padStart(2,"0")}
    setInterval(function(){
      var t=window.wlTimer, c=document.getElementById("c"), l=document.getElementById("l");
      if(!t){c.textContent="--:--";c.style.color="#8C8474";l.textContent="진행 중인 블록 없음";return}
      var now=t.frozenAt||Date.now();
      var s=Math.max(0,Math.round((now-t.startedAt)/1000));
      c.textContent=pad(Math.floor(s/60))+":"+pad(s%60);
      c.style.color=(t.overAt&&now>t.overAt)?"#C0684A":t.accent;
      l.textContent=t.label;
      document.title=c.textContent+" · "+t.label;
    },500);
  <\/script></body></html>`);
  timerWindow.document.close();
  syncTimerWindow();
}
// Hands the child window the raw start time so it ticks on its own.
function syncTimerWindow() {
  if (!timerWindow || timerWindow.closed) return;
  const b = state.activeBlock;
  const s = state.activeSpend;
  if (b) {
    const isBreak = b.phase === "break";
    // The child ticks on its own, so it gets a start shifted forward by the
    // paused time — and, while paused, the moment its clock should stop at.
    // (an open pause needs no shift here — frozenAt stops the clock instead)
    const virtualStart = b.startedAt + (b.pausedMs || 0);
    timerWindow.wlTimer = {
      startedAt: virtualStart,
      frozenAt: b.pausedAt || 0,
      label: isPaused(b) ? `일시정지 · ${b.task}` : (isBreak ? "휴식" : b.task),
      accent: isPaused(b) ? "#8C8474" : (isBreak ? "#C9A227" : "#8FA876"),
      overAt: isPaused(b) ? 0 : virtualStart + (isBreak ? BREAK_MIN : WORK_MIN) * 60000,
    };
  } else if (s) {
    timerWindow.wlTimer = {
      startedAt: s.startedAt, frozenAt: 0, label: s.label, accent: "#C0684A",
      overAt: s.startedAt + SPEND_INCLUDED_MIN * 60000,
    };
  } else {
    timerWindow.wlTimer = null;
  }
}

// Notifies once (not on every tick) when the active block/break first
// crosses its target duration — a nudge for the manual-only timer.
function maybeNotifyTimerDone() {
  if (!state.activeBlock) return;
  const { id, phase: p, task } = state.activeBlock;
  const durationMs = (p === "work" ? WORK_MIN : BREAK_MIN) * 60000;
  const key = `${id}-${p}`;
  // Paused time doesn't count, so the nudge waits for the real work to add up.
  if (activeElapsedMs(state.activeBlock) < durationMs || notifiedKey === key) return;
  notifiedKey = key;
  sendNotification(
    p === "work" ? "작업 시간 완료" : "휴식 시간 완료",
    p === "work" ? `"${task}" 목표 시간(${WORK_MIN}분)이 됐어요. 완료를 눌러주세요.` : "휴식 목표 시간이 끝났어요. 다음 블록을 시작해주세요."
  );
}
function sendNotification(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag: "wl-timer" }); } catch (e) { /* unsupported in this context */ }
}
function requestNotifications() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") { render(); return; }
  Notification.requestPermission().then(() => render());
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
  const dailyPool = dailyPoolFromBlocks(todayBlocks);
  const dailySpent = spentTotal(todaySpends);
  const dailyAvailable = dailyPool - dailySpent;
  return { today, todayBlocks, todaySpends, dailyPool, dailySpent, dailyAvailable };
}

// ---- actions: timer + continuous block queue ----
// Commits whatever the user typed into the break-time composer (or an
// auto-generated line if they typed nothing) as the linked work's update —
// this is now the only way work updates get created.
// Writes whatever is in the composer to the linked work. Called both by the
// "기록" button mid-session and once more when the session ends, so a note can
// be written the moment it happens instead of waiting for the break.
function commitPendingSessionUpdate({ auto = false } = {}) {
  const active = state.activeBlock;
  if (!active || !active.workId) return false;
  const w = state.works.find((x) => x.id === active.workId);
  if (!w) return false;
  const draft = drafts.pendingUpdate;
  const typed = draft.text.trim();
  const costAmount = Number(draft.costAmount);
  const hasCost = !!costAmount && costAmount > 0;
  // The end-of-session call only writes a fallback line when nothing was
  // recorded for this block at all, so a note saved mid-session isn't doubled.
  if (!typed && !draft.image && !hasCost && !draft.subtaskDone) {
    if (!auto || active.noted) return false;
  }
  const subtask = active.subtaskId ? w.subtasks.find((s) => s.id === active.subtaskId) : null;
  const block = findBlockById(active.id);
  const minutes = block ? blockMinutes(block) : Math.max(0, Math.round(activeElapsedMs(active) / 60000));
  const text = typed || `${subtask ? `[${subtask.name}] ` : ""}"${active.task}" 블록 완료 (${minutes}분)`;
  w.updates = w.updates || [];
  w.updates.unshift({
    id: uid(), text, image: draft.image || null, at: active.completedAt || Date.now(),
    auto: !typed, blockId: active.id,
  });
  // The same note can be filed against other 할일 this session touched, each
  // with its own 하위 할일 if one was picked.
  draft.extraLinks.forEach((link) => {
    const other = link.workId ? state.works.find((x) => x.id === link.workId) : null;
    if (!other || other.id === w.id) return;
    const otherSub = link.subtaskId ? (other.subtasks || []).find((s) => s.id === link.subtaskId) : null;
    other.updates = other.updates || [];
    other.updates.unshift({
      id: uid(), text: otherSub ? `[${otherSub.name}] ${text}` : text,
      image: draft.image || null, at: active.completedAt || Date.now(),
      auto: !typed, blockId: active.id,
    });
  });
  if (hasCost) {
    w.costs = w.costs || [];
    w.costs.push({ id: uid(), amount: costAmount, label: draft.costLabel.trim(), at: Date.now() });
  }
  if (subtask && draft.subtaskDone) subtask.done = true;
  state.activeBlock = { ...active, noted: true };
  drafts.pendingUpdate = { text: "", image: null, subtaskDone: false, costLabel: "", costAmount: "", extraLinks: [] };
  return true;
}
function addUpdateExtraLink() {
  drafts.pendingUpdate.extraLinks.push({ workId: "", subtaskId: "" });
  render();
}
function removeUpdateExtraLink(index) {
  drafts.pendingUpdate.extraLinks.splice(Number(index), 1);
  render();
}
function savePendingSessionUpdate() {
  if (commitPendingSessionUpdate()) persistAndRender();
}

// Ending a session commits any pending note and goes idle — the next queued
// block waits for you to press 시작 rather than starting on its own.
// `auto` writes the fallback "블록 완료" line; a cancelled block gets no such
// line, only whatever was actually typed.
function endSession({ auto = true } = {}) {
  commitPendingSessionUpdate({ auto });
  state.activeBlock = null;
}
function startNextQueueItem() {
  if (state.queue.length === 0) return;
  const next = state.queue.shift();
  const now = Date.now();
  // Starting fresh means the previous cancel is settled — no stale undo.
  state.cancelledBlock = null;
  state.activeBlock = {
    id: uid(), task: next.task, workId: next.workId || null, subtaskId: next.subtaskId || null,
    linkedWorks: next.extraLinks || [],
    startedAt: now, phase: "work", segments: [], segmentStartedAt: now,
    pausedMs: 0, segPausedMs: 0, pausedAt: null,
  };
}
// Pauses (and resumes) the running session. The wall clock keeps going, but
// paused time is subtracted everywhere, so a pause earns nothing rather than
// quietly inflating the block's 소요시간 and its points.
function togglePauseSession() {
  const active = state.activeBlock;
  if (!active || active.phase !== "work") return;
  const now = Date.now();
  if (active.pausedAt) {
    const banked = bankedPause(active, now);
    state.activeBlock = { ...active, ...banked, pausedAt: null };
  } else {
    state.activeBlock = { ...active, pausedAt: now };
  }
  persistAndRender();
}
// Closes the stretch of the session that ran on the current 할일.
function closedSegments(active, at) {
  const minutes = Math.max(0, Math.round(segmentElapsedMs(active, at) / 60000));
  return [...(active.segments || []), {
    workId: active.workId || null, subtaskId: active.subtaskId || null, task: active.task, minutes,
  }];
}
// Switches 할일 without ending the session: the time so far is banked as a
// segment and the clock keeps running.
function switchSessionWork(linkIndex) {
  const active = state.activeBlock;
  if (!active || active.phase !== "work") return;
  const d = drafts.switchDraft;
  const chip = linkIndex != null ? (active.linkedWorks || [])[Number(linkIndex)] : null;
  const workId = chip ? chip.workId : d.workId;
  const task = chip ? "" : d.task.trim();
  if (!workId && !task) return;
  if (chip && workId === active.workId) return;
  commitPendingSessionUpdate(); // any note belongs to the 할일 we're leaving
  const now = Date.now();
  const current = state.activeBlock;
  // The 할일 being left stays available to switch back to.
  const linked = [
    ...(current.linkedWorks || []).filter((l) => l.workId !== workId),
    ...(current.workId ? [{ workId: current.workId, subtaskId: current.subtaskId || null }] : []),
  ].filter((l, i, arr) => arr.findIndex((x) => x.workId === l.workId) === i);
  state.activeBlock = {
    ...current,
    segments: closedSegments(current, now),
    workId: workId || null,
    subtaskId: chip ? (chip.subtaskId || null) : (d.subtaskId || null),
    task: task || current.task,
    linkedWorks: linked,
    segmentStartedAt: now,
    // The pause so far belongs to the 할일 we're leaving; a pause still open
    // carries on from here for the new one.
    pausedMs: bankedPause(current, now).pausedMs,
    segPausedMs: 0,
    pausedAt: current.pausedAt ? now : null,
    noted: false,
  };
  drafts.switchDraft = { task: "", workId: "", subtaskId: "" };
  switchFormOpen = false;
  persistAndRender();
}
function toggleSwitchForm() {
  switchFormOpen = !switchFormOpen;
  if (switchFormOpen) drafts.switchDraft = { task: "", workId: "", subtaskId: "" };
  render();
}

// 저축에서 당겨쓴 빚은 그날 번 점수로 갚습니다. 평가로 점수가 바뀌면 이미 갚은
// 만큼을 되돌린 뒤 새 점수로 다시 갚아야 이중 상환이 나지 않습니다.
function repayBorrowed(day, block) {
  const prev = block.repaid || 0;
  if (prev > 0) {
    state.savings -= prev;
    state.borrowedByDate[day] = (state.borrowedByDate[day] || 0) + prev;
  }
  const owed = state.borrowedByDate[day] || 0;
  const repaid = block.points > 0 ? Math.min(owed, block.points) : 0;
  if (repaid > 0) {
    state.savings += repaid;
    state.borrowedByDate[day] = owed - repaid;
  }
  block.repaid = repaid;
}
// 휴식 중에만 매길 수 있습니다. 같은 버튼을 다시 누르면 해제되고,
// 휴식을 끝내면 그대로 굳습니다.
function rateSession(rating) {
  const active = state.activeBlock;
  if (!active || active.phase !== "break") return;
  const day = todayKey();
  const block = (state.blocksByDate[day] || []).find((b) => b.id === active.id);
  if (!block) return;
  block.rating = block.rating === rating ? null : rating;
  block.points = pointsWithRating(segmentsBasePoints(blockSegments(block)), blockMinutes(block), block.rating);
  repayBorrowed(day, block);
  persistAndRender();
}

function completeActiveBlock() {
  if (!state.activeBlock) return;
  const day = todayKey();
  const blocks = state.blocksByDate[day] || [];
  const completedAt = Date.now();
  const segments = closedSegments(state.activeBlock, completedAt);
  const minutes = Math.max(0, Math.round(activeElapsedMs(state.activeBlock, completedAt) / 60000));
  const points = computeBlockPoints(segmentsBasePoints(segments), minutes);
  const newBlock = {
    id: state.activeBlock.id, task: state.activeBlock.task,
    workId: state.activeBlock.workId, subtaskId: state.activeBlock.subtaskId,
    startedAt: state.activeBlock.startedAt, completedAt, points, minutes,
    rating: null, repaid: 0,
    ...(segments.length > 1 ? { segments } : {}),
  };
  state.blocksByDate[day] = [...blocks, newBlock];
  repayBorrowed(day, newBlock);
  state.activeBlock = {
    ...state.activeBlock, phase: "break", startedAt: Date.now(), completedAt: newBlock.completedAt,
    pausedMs: 0, segPausedMs: 0, pausedAt: null,
  };
  persistAndRender();
}

function finishEarly() { completeActiveBlock(); }
function skipBreak() { endSession(); persistAndRender(); }

// 중단은 지금까지 한 시간을 통째로 버립니다. 옆 버튼들과 나란히 있어서 잘못
// 누르기 쉬웠기 때문에, 버릴 게 있을 때만 무엇을 잃는지 숫자로 묻고,
// 눌러버린 뒤에도 UNDO_CANCEL_MIN 동안은 되돌릴 수 있게 남겨둡니다.
const UNDO_CANCEL_MIN = 10;
function cancelBlock() {
  const active = state.activeBlock;
  if (!active) return;
  const minutes = Math.round(activeElapsedMs(active) / 60000);
  const points = active.phase === "work"
    ? computeBlockPoints(segmentsBasePoints(closedSegments(active, Date.now())), minutes)
    : 0;
  // 갓 시작해서 버릴 게 없으면 굳이 묻지 않습니다 — 확인창이 잦으면
  // 정작 중요할 때도 그냥 눌러버리게 되니까요. 물어보지 않은 경우에도
  // 아래 되돌리기는 그대로 남습니다.
  if (minutes >= 2) {
    const worth = points > 0 ? `${minutes}분 · ${points}점` : `${minutes}분`;
    if (!window.confirm(`지금까지 한 ${worth}을 버리고 중단할까요?\n(기록하려면 "완료"를 누르세요)`)) return;
  }
  state.cancelledBlock = { block: active, at: Date.now(), minutes, points };
  endSession({ auto: false });
  persistAndRender();
}
function undoCancelBlock() {
  const saved = state.cancelledBlock;
  if (!saved || state.activeBlock) return;
  // 중단해둔 사이의 시간은 일한 게 아니므로 일시정지로 쳐서 빼둡니다.
  const gap = Math.max(0, Date.now() - saved.at);
  const b = saved.block;
  state.activeBlock = {
    ...b,
    pausedMs: (b.pausedMs || 0) + gap,
    segPausedMs: (b.segPausedMs || 0) + gap,
    pausedAt: null,
  };
  state.cancelledBlock = null;
  persistAndRender();
}
// 되돌릴 수 있는 창이 아직 열려 있는지.
function pendingCancelUndo() {
  const saved = state.cancelledBlock;
  if (!saved || state.activeBlock) return null;
  if (Date.now() - saved.at > UNDO_CANCEL_MIN * 60000) return null;
  return saved;
}

// 타이머를 켜지 않고 한 일도 장부에는 남아야 합니다. 시작 시각과 소요시간을
// 직접 적어 넣으면 블록으로 기록되고, 점수는 평소 규칙 그대로 계산됩니다.
function toggleManualBlockForm() {
  manualBlockOpen = !manualBlockOpen;
  if (manualBlockOpen) {
    const now = new Date();
    drafts.manualBlock = {
      task: "", workId: "", subtaskId: "",
      date: todayKey(now),
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      minutes: "",
    };
  }
  render();
}
// 폼에 적힌 값으로 만들어질 블록. 미리보기와 실제 저장이 같은 값을 쓰도록
// 한 군데서 계산합니다. 입력이 덜 됐으면 null.
function manualBlockPreview() {
  const d = drafts.manualBlock;
  const minutes = Math.round(Number(d.minutes));
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !/^\d{2}:\d{2}$/.test(d.time)) return null;
  const [y, mo, da] = d.date.split("-").map(Number);
  const [h, mi] = d.time.split(":").map(Number);
  const startedAt = new Date(y, mo - 1, da, h, mi, 0, 0).getTime();
  if (!Number.isFinite(startedAt)) return null;
  return {
    startedAt, completedAt: startedAt + minutes * 60000, minutes,
    points: computeBlockPoints(pointsForWork(d.workId || null), minutes),
    day: d.date,
  };
}
function addManualBlock() {
  const d = drafts.manualBlock;
  const p = manualBlockPreview();
  const task = d.task.trim();
  if (!p || !task) return;
  const block = {
    id: uid(), task, workId: d.workId || null, subtaskId: d.subtaskId || null,
    startedAt: p.startedAt, completedAt: p.completedAt, minutes: p.minutes, points: p.points,
    rating: null, repaid: 0, manual: true,
  };
  state.blocksByDate[p.day] = [...(state.blocksByDate[p.day] || []), block]
    .sort((a, b) => a.completedAt - b.completedAt);
  repayBorrowed(p.day, block);
  // 할일에도 한 줄 남겨야 할일 관리의 세션 기록에서 같이 보입니다.
  const w = d.workId ? state.works.find((x) => x.id === d.workId) : null;
  if (w) {
    const sub = d.subtaskId ? (w.subtasks || []).find((s) => s.id === d.subtaskId) : null;
    w.updates = w.updates || [];
    w.updates.unshift({
      id: uid(), text: `${sub ? `[${sub.name}] ` : ""}${task}`, image: null,
      at: p.completedAt, auto: false, blockId: block.id,
    });
  }
  manualBlockOpen = false;
  drafts.manualBlock = { task: "", workId: "", subtaskId: "", date: "", time: "", minutes: "" };
  persistAndRender();
}
// 잘못 넣은 블록을 지웁니다. 갚았던 빚은 되돌리고, 할일에 남긴 기록은
// 손대지 않습니다 — 직접 쓴 메모까지 같이 사라지면 곤란하니까요.
function removeBlock(blockId) {
  const { block, day } = findBlockEntry(blockId);
  if (!block) return;
  const worth = block.points > 0 ? `${blockMinutes(block)}분 · ${block.points}점` : `${blockMinutes(block)}분`;
  if (!window.confirm(`"${block.task}" 기록(${worth})을 지울까요?`)) return;
  block.points = 0;
  repayBorrowed(day, block); // 이 블록으로 갚았던 저축을 원위치
  state.blocksByDate[day] = (state.blocksByDate[day] || []).filter((b) => b.id !== blockId);
  persistAndRender();
}

function addToQueue() {
  const task = drafts.queueDraft.task.trim();
  if (!task) return;
  state.queue.push({
    id: uid(), task, workId: drafts.queueDraft.workId || null, subtaskId: drafts.queueDraft.subtaskId || null,
    extraLinks: drafts.queueDraft.extraLinks
      .filter((l) => l.workId && l.workId !== drafts.queueDraft.workId)
      .map((l) => ({ workId: l.workId, subtaskId: l.subtaskId || null })),
  });
  drafts.queueDraft = { task: "", workId: "", subtaskId: "", extraLinks: [] };
  persistAndRender();
}
// Extra 할일 planned into one block. Each gets the same 할일/하위 할일 pair as
// the first one, and they become one-tap switch targets once the block starts.
function addQueueExtraLink() {
  drafts.queueDraft.extraLinks.push({ workId: "", subtaskId: "" });
  render();
}
function removeQueueExtraLink(index) {
  drafts.queueDraft.extraLinks.splice(Number(index), 1);
  render();
}
function removeFromQueue(id) {
  state.queue = state.queue.filter((q) => q.id !== id);
  persistAndRender();
}
function startQueue() {
  if (state.activeBlock || state.queue.length === 0) return;
  startNextQueueItem();
  persistAndRender();
}
function reorderArray(arr, fromIndex, toIndex) {
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, item);
}

// ---- actions: spend timer (presets run continuously until stopped) ----
// A preset's points are charged the moment it starts and cover the first
// hour. Only time past that hour costs more, at 1 point per 10 minutes.
function spendMinutes(activeSpend, now) {
  return ((now != null ? now : Date.now()) - activeSpend.startedAt) / 60000;
}
function spendElapsedPoints(activeSpend, now) {
  const over = Math.max(0, spendMinutes(activeSpend, now) - SPEND_INCLUDED_MIN);
  return activeSpend.cost + Math.floor(over / SPEND_MIN_PER_POINT);
}
function spendStatusText(activeSpend) {
  const minutes = spendMinutes(activeSpend);
  const cost = spendElapsedPoints(activeSpend);
  if (minutes < SPEND_INCLUDED_MIN) {
    const left = Math.max(1, Math.ceil(SPEND_INCLUDED_MIN - minutes));
    return `지금까지 -${cost}점 · 포함된 1시간 중 ${left}분 남음`;
  }
  return `지금까지 -${cost}점 · 1시간 초과 ${formatMinutes(Math.floor(minutes - SPEND_INCLUDED_MIN))} · 10분마다 1점씩 더 차감돼요`;
}
function startSpendTimer(label, cost) {
  if (state.activeSpend) return;
  if (!window.confirm(`"${label}" 소비를 시작할까요? (바로 -${cost}점으로 1시간, 1시간이 지나면 10분마다 1점씩 추가 차감)`)) return;
  state.activeSpend = { label, cost, startedAt: Date.now(), appliedPoints: 0, logId: null };
  applyActiveSpendTick();
  persistAndRender();
}
// Called on start and periodically (see onTick) so points actually leave
// the balance as the timer runs, not only once you press "끄기" — any
// shortfall beyond today's available pool is taken from savings right away.
function applyActiveSpendTick() {
  const active = state.activeSpend;
  if (!active) return false;
  const total = spendElapsedPoints(active);
  const delta = total - (active.appliedPoints || 0);
  if (delta <= 0) return false;
  const { dailyPool, dailySpent } = computeToday();
  const availableBefore = dailyPool - dailySpent;
  const overflow = Math.max(0, delta - Math.max(0, availableBefore));
  const day = todayKey();
  if (overflow > 0) {
    // Borrowed from savings because today's pool didn't cover it. Blocks
    // finished later today pay this back first (see completeActiveBlock),
    // so the day's result doesn't depend on whether you spent before or
    // after earning.
    state.savings -= overflow;
    state.borrowedByDate[day] = (state.borrowedByDate[day] || 0) + overflow;
  }
  const list = state.spendsByDate[day] || [];
  // The running log entry lives on the day the timer started; once the clock
  // rolls past midnight that entry is on yesterday's list, so start a fresh
  // one for today instead of silently dropping the charge.
  const existing = active.logId ? list.find((e) => e.id === active.logId) : null;
  if (existing) {
    state.spendsByDate[day] = list.map((e) => (e.id === active.logId ? { ...e, cost: e.cost + delta } : e));
  } else {
    const id = uid();
    active.logId = id;
    state.spendsByDate[day] = [...list, { id, label: active.label, cost: delta, at: Date.now() }];
  }
  active.appliedPoints = total;
  return true;
}
function stopSpendTimer() {
  const active = state.activeSpend;
  if (!active) return;
  applyActiveSpendTick();
  const totalCost = active.appliedPoints || 0;
  state.activeSpend = null;
  sendNotification("소비 종료", `"${active.label}" 소비를 종료했어요. 총 -${totalCost}점 사용했어요.`);
  persistAndRender();
}
function useOffDay() {
  if (state.savings < OFFDAY_COST) return;
  state.savings -= OFFDAY_COST;
  state.offDayLog.push(Date.now());
  persistAndRender();
}
function toggleSpendPresetsEdit() {
  spendPresetsEditOpen = !spendPresetsEditOpen;
  editingPresetId = null;
  render();
}
function addSpendPreset() {
  const label = drafts.newPresetLabel.trim();
  const cost = Number(drafts.newPresetCost);
  if (!label || !cost || cost <= 0) return;
  state.spendPresets.push({ id: uid(), label, cost });
  drafts.newPresetLabel = "";
  drafts.newPresetCost = "";
  persistAndRender();
}
function removeSpendPreset(id) {
  state.spendPresets = state.spendPresets.filter((p) => p.id !== id);
  persistAndRender();
}
function startEditSpendPreset(id) {
  const p = state.spendPresets.find((x) => x.id === id);
  if (!p) return;
  editingPresetId = id;
  editingPresetDraft = { label: p.label, cost: String(p.cost) };
  render();
}
function cancelEditSpendPreset() { editingPresetId = null; render(); }
function saveEditSpendPreset() {
  const p = state.spendPresets.find((x) => x.id === editingPresetId);
  if (!p) return;
  const label = editingPresetDraft.label.trim();
  const cost = Number(editingPresetDraft.cost);
  if (!label || !cost || cost <= 0) return;
  p.label = label;
  p.cost = cost;
  editingPresetId = null;
  persistAndRender();
}

// ---- actions: works ----
function addWork() {
  const name = drafts.newWorkName.trim();
  if (!name) return;
  const expectedSalePrice = drafts.newWorkExpected ? Number(drafts.newWorkExpected) : null;
  state.works.push({
    id: uid(), name, subtasks: [], updates: [], costs: [], expectedSalePrice, archived: false,
    tagId: drafts.newWorkTag || null,
  });
  drafts.newWorkName = "";
  drafts.newWorkExpected = "";
  drafts.newWorkTag = "";
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
  editingWorkDraft = {
    name: w.name, expectedSalePrice: w.expectedSalePrice != null ? String(w.expectedSalePrice) : "",
    tagId: w.tagId || "",
  };
  render();
}
function cancelEditWork() { editingWorkId = null; render(); }
function toggleWorkCollapse(workId) {
  state.collapsedWorks[workId] = !state.collapsedWorks[workId];
  persistAndRender();
}
// Collapses everything while anything is still open, and only expands once
// the whole list is closed — so one button is never ambiguous.
function anyWorkExpanded() {
  return state.works.some((w) => !w.archived && !state.collapsedWorks[w.id]);
}
function toggleAllWorkCollapse() {
  const collapse = anyWorkExpanded();
  state.works.forEach((w) => { if (!w.archived) state.collapsedWorks[w.id] = collapse; });
  persistAndRender();
}
function archiveWork(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.archived = true;
  persistAndRender();
}
function unarchiveWork(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.archived = false;
  persistAndRender();
}
function toggleArchiveSection() {
  archivedSectionOpen = !archivedSectionOpen;
  render();
}
function saveEditWork() {
  const w = state.works.find((x) => x.id === editingWorkId);
  if (!w) return;
  const name = editingWorkDraft.name.trim();
  if (!name) return;
  w.name = name;
  w.expectedSalePrice = editingWorkDraft.expectedSalePrice ? Number(editingWorkDraft.expectedSalePrice) : null;
  w.tagId = editingWorkDraft.tagId || null;
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
// Moves by id, not list position: the manage list hides archived works, so a
// position in what you see doesn't match a position in state.works.
function reorderWorks(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const from = state.works.findIndex((w) => w.id === fromId);
  const to = state.works.findIndex((w) => w.id === toId);
  if (from < 0 || to < 0) return;
  reorderArray(state.works, from, to);
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
function workTag(w) {
  return w.tagId ? state.tags.find((t) => t.id === w.tagId) : null;
}
function workTagBadge(w) {
  const tag = workTag(w);
  return tag ? ` <span class="wl-work-tag">${escapeHtml(tag.name)} · ${tag.points}점</span>` : "";
}
// Old blocks saved before per-block duration tracking fall back to the
// nominal block length.
function blockMinutes(b) {
  return b.minutes != null ? b.minutes : WORK_MIN;
}
// Blocks recorded before the start time was kept fall back to working it out
// from when they ended.
function blockStartedAt(b) {
  return b.startedAt != null ? b.startedAt : b.completedAt - blockMinutes(b) * 60000;
}
function findBlockById(blockId) {
  return findBlockEntry(blockId).block;
}
// The day matters as well as the block: repaying borrowed points is per-day.
function findBlockEntry(blockId) {
  for (const date of Object.keys(state.blocksByDate)) {
    const block = (state.blocksByDate[date] || []).find((x) => x.id === blockId);
    if (block) return { block, day: date };
  }
  return { block: null, day: null };
}
function formatMinutes(mins) {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}
// 동시에 진행할 프로젝트 수의 상한. 리틀의 법칙대로 진행 중이 늘어날수록
// 하나가 끝나는 데 걸리는 시간이 비례해서 늘어나기 때문에, 한도를 두고
// 넘길 때 무엇을 내릴지 직접 고르게 합니다. (자동 선정은 제약이 아닙니다.)
const WIP_LIMIT = 3;
function wipWorks() {
  return state.works.filter((w) => !w.archived && w.wip);
}
function backlogWorks() {
  return state.works.filter((w) => !w.archived && !w.wip);
}
// 마지막으로 이 프로젝트를 실제로 건드린 시각 — 기록이든 블록이든.
function workLastTouched(workId) {
  const w = state.works.find((x) => x.id === workId);
  let last = (w && w.updates && w.updates[0] && w.updates[0].at) || 0;
  Object.values(state.blocksByDate).forEach((blocks) => {
    (blocks || []).forEach((b) => {
      // 0분짜리 조각은 손댄 걸로 치지 않습니다 — 오늘의 기록에서 숨기는 것과
      // 같은 기준이라야 "오늘 했다"는 표시가 거짓이 되지 않습니다.
      if (blockSegments(b).some((s) => s.workId === workId && s.minutes > 0)) {
        last = Math.max(last, b.completedAt || 0);
      }
    });
  });
  return last || null;
}
function daysSince(at) {
  if (!at) return null;
  const a = new Date(at); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
// 조용히 죽어가는 프로젝트는 "며칠째 안 건드렸나"로만 보입니다.
function agingLabel(workId) {
  const days = daysSince(workLastTouched(workId));
  if (days === null) return { text: "아직 시작 안 함", stale: false, never: true };
  if (days === 0) return { text: "오늘", stale: false };
  if (days === 1) return { text: "어제", stale: false };
  return { text: `${days}일 전`, stale: days >= 7 };
}
function toggleWorkWip(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  if (!w.wip && wipWorks().length >= WIP_LIMIT) {
    window.alert(`진행 중은 ${WIP_LIMIT}개까지예요.\n먼저 하나를 대기로 내려주세요.`);
    return;
  }
  w.wip = !w.wip;
  persistAndRender();
}

function workSessionStats(workId) {
  let count = 0;
  let minutes = 0;
  Object.values(state.blocksByDate).forEach((blocks) => {
    (blocks || []).forEach((b) => {
      const mine = blockSegments(b).filter((s) => s.workId === workId);
      if (mine.length === 0) return;
      count += 1;
      minutes += mine.reduce((a, s) => a + s.minutes, 0);
    });
  });
  return { count, minutes };
}
function subtaskMinutes(workId, subtaskId) {
  let minutes = 0;
  Object.values(state.blocksByDate).forEach((blocks) => {
    (blocks || []).forEach((b) => {
      blockSegments(b).forEach((s) => {
        if (s.workId === workId && s.subtaskId === subtaskId) minutes += s.minutes;
      });
    });
  });
  return minutes;
}
function removeWorkUpdate(workId, updateId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.updates = (w.updates || []).filter((u) => u.id !== updateId);
  persistAndRender();
}
function startEditBlockMinutes(blockId) {
  const b = findBlockById(blockId);
  if (!b) return;
  editingBlockId = blockId;
  editingBlockMinutesDraft = String(blockMinutes(b));
  render();
}
function cancelEditBlockMinutes() { editingBlockId = null; render(); }
function saveEditBlockMinutes() {
  const { block: b, day } = findBlockEntry(editingBlockId);
  if (!b) return;
  const mins = Number(editingBlockMinutesDraft);
  if (!Number.isFinite(mins) || mins < 0) return;
  // Keep a multi-할일 session's segments adding up to the corrected total.
  if (b.segments && b.segments.length > 1) {
    const old = b.segments.reduce((a, s) => a + s.minutes, 0);
    let left = mins;
    b.segments = b.segments.map((s, i) => {
      const share = i === b.segments.length - 1 ? left : Math.round(old > 0 ? (s.minutes / old) * mins : mins / b.segments.length);
      left -= share;
      return { ...s, minutes: Math.max(0, share) };
    });
  }
  b.minutes = mins;
  // The end time is when 완료 was actually pressed, so a corrected duration
  // moves the start instead — otherwise the logged range would contradict it.
  b.startedAt = b.completedAt - mins * 60000;
  // A corrected duration changes what the block is worth — 35분을 20분으로 고치면
  // 25분 규칙에 걸려 0점이 되어야 합니다. 예전에는 점수가 그대로 남아 있었어요.
  b.points = pointsWithRating(segmentsBasePoints(blockSegments(b)), mins, b.rating);
  repayBorrowed(day, b);
  editingBlockId = null;
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

// ---- actions: tags ----
function addTag() {
  const name = drafts.newTagName.trim();
  const points = Number(drafts.newTagPoints);
  if (!name || !points || points <= 0) return;
  state.tags.push({ id: uid(), name, points });
  drafts.newTagName = "";
  drafts.newTagPoints = "";
  persistAndRender();
}
function removeTag(tagId) {
  state.tags = state.tags.filter((t) => t.id !== tagId);
  state.works.forEach((w) => { if (w.tagId === tagId) w.tagId = null; });
  persistAndRender();
}
function startEditTag(tagId) {
  const t = state.tags.find((x) => x.id === tagId);
  if (!t) return;
  editingTagId = tagId;
  editingTagDraft = { name: t.name, points: String(t.points) };
  render();
}
function cancelEditTag() { editingTagId = null; render(); }
function saveEditTag() {
  const t = state.tags.find((x) => x.id === editingTagId);
  if (!t) return;
  const name = editingTagDraft.name.trim();
  const points = Number(editingTagDraft.points);
  if (!name || !points || points <= 0) return;
  t.name = name;
  t.points = points;
  editingTagId = null;
  persistAndRender();
}

// ---- actions: image lightbox ----
function openImageLightbox(src, alt) {
  lightboxImage = { src, alt: alt || "" };
  render();
}
function closeImageLightbox() {
  lightboxImage = null;
  render();
}

// ---- actions: settings ----
function switchTab(tab) { currentTab = tab; render(); }

function openSettings() {
  drafts.settings = getCredentials();
  drafts.settingsMsg = null;
  settingsOpen = true;
  resetConfirm = null;
  render();
}
function closeSettings() {
  if (!hasCredentials()) return;
  settingsOpen = false;
  resetConfirm = null;
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
// Two-step: the first click only arms the button, so a stray tap on mobile
// can't wipe the ledger.
function askReset(scope) {
  resetConfirm = scope;
  render();
}
function cancelReset() {
  resetConfirm = null;
  render();
}
function doReset(scope) {
  if (resetConfirm !== scope) return;
  const fresh = defaultState();
  if (scope === "all") {
    state = fresh;
  } else {
    state = {
      ...fresh,
      works: state.works.map((w) => ({ ...w, updates: [] })),
      categories: state.categories,
      tags: state.tags,
      spendPresets: state.spendPresets,
    };
  }
  resetConfirm = null;
  editingBlockId = null;
  editingWorkId = null;
  editingCategoryId = null;
  editingTagId = null;
  editingPresetId = null;
  notifiedKey = null;
  drafts.queueDraft = { task: "", workId: "", subtaskId: "", extraLinks: [] };
  drafts.pendingUpdate = { text: "", image: null, subtaskDone: false, costLabel: "", costAmount: "", extraLinks: [] };
  settingsOpen = false;
  persistAndRender();
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
function renderTimerBlock({ label, phaseLabel, durationMin, elapsed, isBreak, paused, pausedMin, workId, subtaskId }) {
  const durationMs = durationMin * 60000;
  const overtime = !paused && elapsed > durationMs;
  const pct = Math.min(100, (elapsed / durationMs) * 100);
  return `
    <div class="wl-timer ${paused ? "is-paused" : ""}">
      <div class="wl-timer-top">
        <span class="wl-timer-phase ${isBreak ? "is-break" : ""}">${paused ? `${ICONS.pause} 일시정지` : `${isBreak ? ICONS.coffee : ICONS.square} ${phaseLabel}`}</span>
        <span class="wl-timer-clock ${overtime ? "is-overtime" : ""}" id="wl-timer-clock">${formatClock(elapsed)}</span>
      </div>
      <div class="wl-timer-task">${escapeHtml(label)}</div>
      <div class="wl-timer-bar"><div class="wl-timer-bar-fill ${overtime ? "is-overtime" : ""}" id="wl-timer-bar-fill" style="width:${pct}%"></div></div>
      <div class="wl-hint">목표 ${durationMin}분${overtime ? " · 목표 시간을 초과했어요" : ""}${pausedMin > 0 ? ` · 일시정지 ${pausedMin}분은 빠짐` : ""}</div>
      ${!isBreak ? renderSessionSegments() : ""}
      ${!isBreak ? renderLinkedWorkChips() : ""}
      <div class="wl-timer-actions">
        ${!isBreak ? `
          <button class="wl-btn wl-btn--primary" data-action="finishEarly">${ICONS.check} 완료</button>
          <button class="wl-btn wl-btn--ghost" data-action="togglePauseSession">${paused ? `${ICONS.resume} 계속` : `${ICONS.pause} 일시정지`}</button>
          <button class="wl-btn wl-btn--ghost" data-action="toggleSwitchForm">${ICONS.chevron} 할일 전환</button>
          <button class="wl-btn wl-btn--quiet" data-action="cancelBlock">${ICONS.x} 중단</button>
        ` : `<button class="wl-btn wl-btn--primary wl-btn--full" data-action="skipBreak">${ICONS.check} 휴식 종료</button>`}
      </div>
      ${!isBreak && switchFormOpen ? renderSwitchForm() : ""}
      ${isBreak ? renderSessionRating() : ""}
      ${isBreak && workId ? renderSessionUpdateComposer(workId, subtaskId) : ""}
    </div>`;
}

function workName(workId) {
  const w = workId ? state.works.find((x) => x.id === workId) : null;
  return w ? w.name : "연결 없음";
}
// The 할일 this session has already covered, so a switch doesn't hide history.
function renderSessionSegments() {
  const active = state.activeBlock;
  const done = active.segments || [];
  if (done.length === 0) return "";
  const soFar = Math.max(0, Math.round(segmentElapsedMs(active) / 60000));
  return `
    <div class="wl-seg-track">
      ${done.map((s) => `<span class="wl-seg">${escapeHtml(workName(s.workId))} <b>${s.minutes}분</b></span>`).join("")}
      <span class="wl-seg is-current">${escapeHtml(workName(active.workId))} <b id="wl-seg-current">${soFar}분째</b></span>
    </div>`;
}
// 할일 planned into this block but not currently running — one tap switches.
function renderLinkedWorkChips() {
  const active = state.activeBlock;
  const linked = (active.linkedWorks || []).filter((l) => l.workId !== active.workId);
  if (linked.length === 0) return "";
  return `
    <div class="wl-chip-row">
      ${linked.map((l, i) => {
        const w = state.works.find((x) => x.id === l.workId);
        const sub = l.subtaskId && w ? (w.subtasks || []).find((s) => s.id === l.subtaskId) : null;
        return `
        <button class="wl-chip is-action" data-action="switchToLinkedWork" data-index="${i}">
          ${ICONS.chevron} ${escapeHtml(workName(l.workId))}${sub ? ` · ${escapeHtml(sub.name)}` : ""}
        </button>`;
      }).join("")}
    </div>`;
}
function renderSwitchForm() {
  const d = drafts.switchDraft;
  const activeWorks = state.works.filter((w) => !w.archived);
  const selected = activeWorks.find((w) => w.id === d.workId);
  return `
    <div class="wl-switch-form">
      <div class="wl-hint">지금까지 한 시간은 그대로 기록되고, 타이머는 멈추지 않아요.</div>
      <div class="wl-field-row wl-field-row--tight">
        <select class="wl-select" data-select="switchWork">
          <option value="">할일 선택</option>
          ${activeWorks.map((w) => `<option value="${w.id}" ${d.workId === w.id ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("")}
        </select>
        ${selected && selected.subtasks.length > 0 ? `
          <select class="wl-select" data-select="switchSub">
            <option value="">하위 할일 선택 안 함</option>
            ${selected.subtasks.map((st) => `<option value="${st.id}" ${d.subtaskId === st.id ? "selected" : ""}>${escapeHtml(st.name)}</option>`).join("")}
          </select>` : ""}
      </div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="이제 할 일 (비우면 유지)" data-draft="switchTask" data-enter-action="switchSessionWork" value="${escapeAttr(d.task)}" />
        <button class="wl-btn wl-btn--primary" data-action="switchSessionWork">전환</button>
      </div>
    </div>`;
}

// 방금 끝낸 세션을 스스로 평가하는 자리. 고르지 않으면 "보통"과 같아서
// 점수가 그대로이므로, 굳이 누르지 않아도 흐름이 막히지 않습니다.
function renderSessionRating() {
  const day = todayKey();
  const block = (state.blocksByDate[day] || []).find((b) => b.id === state.activeBlock.id);
  if (!block) return "";
  const base = blockBasePoints(block);
  const chosen = SESSION_RATINGS.find((r) => r.id === block.rating);
  return `
    <div class="wl-rating">
      <div class="wl-hint">이번 세션 어땠나요? — 점수가 ±1점 움직입니다</div>
      <div class="wl-rating-row">
        ${SESSION_RATINGS.map((r) => {
          const points = base <= 0 ? 0 : Math.max(0, base + r.adjust);
          return `
          <button class="wl-rating-btn ${block.rating === r.id ? "is-on" : ""} is-${r.id}"
                  data-action="rateSession" data-rating="${r.id}" title="${escapeAttr(r.hint)}">
            <span class="wl-rating-label">${r.label}</span>
            <span class="wl-rating-points">${points}점</span>
          </button>`;
        }).join("")}
      </div>
      <div class="wl-hint">${base <= 0
        ? "25분 이하로 끝난 블록이라 점수가 없어요. 평가는 기록으로만 남습니다."
        : (chosen ? `${escapeHtml(chosen.hint)} · 현재 ${block.points}점` : `고르지 않으면 "보통"과 같아요 · 현재 ${block.points}점`)}</div>
    </div>`;
}

function renderSessionUpdateComposer(workId, subtaskId) {
  const draft = drafts.pendingUpdate;
  const w = state.works.find((x) => x.id === workId);
  const subtask = subtaskId && w ? w.subtasks.find((s) => s.id === subtaskId) : null;
  return `
    <div class="wl-session-update">
      <div class="wl-hint">방금 세션 기록 — "기록"을 누르면 바로 저장되고, 안 눌러도 휴식을 끝낼 때 저장돼요</div>
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" placeholder="무엇을 했나요?" data-draft="pendingUpdateText" data-enter-action="savePendingUpdate" value="${escapeAttr(draft.text)}" />
        ${renderImagePicker({ value: draft.image || null, pickAction: "pickPendingUpdateImage", clearAction: "clearPendingUpdateImage" })}
      </div>
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" placeholder="쓴 비용 (선택)" data-draft="pendingUpdateCostLabel" value="${escapeAttr(draft.costLabel)}" />
        <input class="wl-input wl-input--num" placeholder="금액" inputmode="numeric" data-draft="pendingUpdateCostAmount" data-enter-action="savePendingUpdate" value="${escapeAttr(draft.costAmount)}" />
        <button class="wl-btn wl-btn--ghost" data-action="savePendingUpdate">${ICONS.check} 기록</button>
      </div>
      <div class="wl-hint" style="margin-top:8px">${escapeHtml(workName(workId))}${subtask ? ` · ${escapeHtml(subtask.name)}` : ""}에 기록됨</div>
      ${draft.extraLinks.map((l, i) => renderWorkLinkRow({
        workId: l.workId, subtaskId: l.subtaskId,
        workSelect: "updateExtraWork", subSelect: "updateExtraSub", index: i,
        removeAction: "removeUpdateExtraLink", placeholder: "함께 기록할 할일 선택",
      })).join("")}
      <button class="wl-cost-toggle" data-action="addUpdateExtraLink">${ICONS.plus} 할일 더 연결</button>
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
  const active = state.activeBlock;
  const durationMs = (active.phase === "work" ? WORK_MIN : BREAK_MIN) * 60000;
  const elapsed = activeElapsedMs(active);
  const overtime = !isPaused(active) && elapsed > durationMs;
  const pct = Math.min(100, (elapsed / durationMs) * 100);
  clockEl.textContent = formatClock(elapsed);
  clockEl.classList.toggle("is-overtime", overtime);
  barEl.style.width = `${pct}%`;
  barEl.classList.toggle("is-overtime", overtime);
  const segEl = document.getElementById("wl-seg-current");
  if (segEl) segEl.textContent = `${Math.max(0, Math.round(segmentElapsedMs(active) / 60000))}분째`;
}

function updateSpendTimerDisplay() {
  if (currentTab !== "dashboard" || !state.activeSpend) return;
  const clockEl = document.getElementById("wl-spend-clock");
  const costEl = document.getElementById("wl-spend-cost-live");
  if (!clockEl || !costEl) return;
  const elapsedMs = Date.now() - state.activeSpend.startedAt;
  clockEl.textContent = formatClock(elapsedMs);
  costEl.textContent = spendStatusText(state.activeSpend);
}

function renderQueueItem(item, idx) {
  const w = item.workId ? state.works.find((x) => x.id === item.workId) : null;
  return `
    <li class="wl-queue-item" data-drag-item="queue">
      <span class="wl-drag-handle" data-drag-handle="queue">${ICONS.grip}</span>
      <span class="wl-queue-index">${idx + 1}</span>
      <span class="wl-queue-task">${escapeHtml(item.task)}${w ? `<span class="wl-queue-work"> · ${escapeHtml([w.name, ...(item.extraLinks || []).map((l) => workName(l.workId))].join(" + "))}</span>` : ""}</span>
      <button class="wl-icon-btn" data-action="removeFromQueue" data-id="${item.id}">${ICONS.x}</button>
    </li>`;
}

// One 할일 + 하위 할일 pair. Used for the first link and every extra one, so an
// added 할일 is chosen exactly the same way rather than as a lesser attachment.
function renderWorkLinkRow({ workId, subtaskId, workSelect, subSelect, index, removeAction, placeholder }) {
  const activeWorks = state.works.filter((w) => !w.archived);
  const selected = activeWorks.find((w) => w.id === workId);
  const idx = index != null ? ` data-index="${index}"` : "";
  return `
    <div class="wl-field-row wl-field-row--tight">
      <select class="wl-select" data-select="${workSelect}"${idx}>
        <option value="">${escapeHtml(placeholder)}</option>
        ${activeWorks.map((w) => `<option value="${w.id}" ${workId === w.id ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("")}
      </select>
      ${selected && selected.subtasks.length > 0 ? `
        <select class="wl-select" data-select="${subSelect}"${idx}>
          <option value="">하위 할일 선택 안 함</option>
          ${selected.subtasks.map((st) => `<option value="${st.id}" ${subtaskId === st.id ? "selected" : ""}>${escapeHtml(st.name)}</option>`).join("")}
        </select>` : ""}
      ${removeAction ? `<button class="wl-icon-btn" data-action="${removeAction}" data-index="${index}">${ICONS.x}</button>` : ""}
    </div>`;
}

function renderQueueSection() {
  const draft = drafts.queueDraft;
  const activeWorks = state.works.filter((w) => !w.archived);
  return `
    <div class="wl-queue">
      <div class="wl-card-title">블록 추가</div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="다음 블록에서 할 일" data-draft="queueTask" data-enter-action="addToQueue" value="${escapeAttr(draft.task)}" />
        <button class="wl-btn wl-btn--primary" data-action="addToQueue">${ICONS.plus} 추가</button>
      </div>
      ${activeWorks.length > 0 ? `
        ${renderWorkLinkRow({
          workId: draft.workId, subtaskId: draft.subtaskId,
          workSelect: "queueWork", subSelect: "queueSub", placeholder: "할일 연결 안 함",
        })}
        ${draft.extraLinks.map((l, i) => renderWorkLinkRow({
          workId: l.workId, subtaskId: l.subtaskId,
          workSelect: "queueExtraWork", subSelect: "queueExtraSub", index: i,
          removeAction: "removeQueueExtraLink", placeholder: "함께 할 할일 선택",
        })).join("")}
        ${draft.workId ? `<button class="wl-cost-toggle" data-action="addQueueExtraLink">${ICONS.plus} 할일 더 연결</button>` : ""}` : ""}
      ${state.queue.length > 0 ? `
        <div class="wl-hint" style="margin-top:10px">계획된 블록 ${state.queue.length}개 · 드래그로 순서 변경</div>
        <ul class="wl-queue-list">${state.queue.map(renderQueueItem).join("")}</ul>
        ${!state.activeBlock ? `<button class="wl-btn wl-btn--primary wl-btn--full" data-action="startQueue">${ICONS.play} "${escapeHtml(state.queue[0].task)}" 시작</button>` : ""}
      ` : `<div class="wl-hint" style="margin-top:10px">먼저 계획을 짜두고, 준비되면 "시작"을 눌러 순서대로 진행하세요.</div>`}
    </div>`;
}

// 중단 직후 자리를 지키는 되돌리기. 확인창을 그냥 눌러버린 경우까지 구해줍니다.
function renderCancelUndo() {
  const saved = pendingCancelUndo();
  if (!saved) return "";
  const left = Math.max(1, UNDO_CANCEL_MIN - Math.floor((Date.now() - saved.at) / 60000));
  const worth = saved.points > 0 ? `${saved.minutes}분 · ${saved.points}점` : `${saved.minutes}분`;
  return `
    <div class="wl-undo">
      <div class="wl-undo-text">
        <div class="wl-undo-title">"${escapeHtml(saved.block.task)}" 중단됨</div>
        <div class="wl-hint">버린 ${worth}을 되살릴 수 있어요 · ${left}분 남음</div>
      </div>
      <button class="wl-btn wl-btn--primary" data-action="undoCancelBlock">${ICONS.resume} 되돌리기</button>
    </div>`;
}

function renderTimeBlockColumn() {
  const active = state.activeBlock;
  return `
    <section class="wl-card">
      ${active
        ? renderTimerBlock({
            elapsed: activeElapsedMs(active),
            paused: isPaused(active),
            pausedMin: Math.floor(bankedPause(active, Date.now()).pausedMs / 60000),
            workId: active.workId, subtaskId: active.subtaskId,
            ...(active.phase === "work"
              ? { label: active.task, phaseLabel: "작업 중", durationMin: WORK_MIN, isBreak: false }
              : { label: "휴식", phaseLabel: "휴식 중", durationMin: BREAK_MIN, isBreak: true }),
          })
        : renderCancelUndo() || `<div class="wl-empty wl-empty--pad">진행 중인 블록이 없어요. 아래에서 계획을 짜고 시작해보세요.</div>`}
    </section>
    <section class="wl-card">
      ${renderQueueSection()}
    </section>`;
}

// ---- render: column 2 — project status ----
function renderProjectStatusRow(w) {
  const latest = (w.updates || [])[0];
  const nextSubtask = (w.subtasks || []).find((s) => !s.done);
  const done = (w.subtasks || []).filter((s) => s.done).length;
  const total = (w.subtasks || []).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const stats = workSessionStats(w.id);
  const aging = agingLabel(w.id);
  return `
    <section class="wl-card wl-project-card">
      <div class="wl-work-head">
        <div class="wl-work-name" style="margin-bottom:0">${escapeHtml(w.name)}${workTagBadge(w)}</div>
        <span class="wl-aging ${aging.stale ? "is-stale" : ""}">${aging.text}</span>
      </div>
      ${total > 0 ? `
        <div class="wl-progress">
          <div class="wl-progress-bar"><div class="wl-progress-fill" style="width:${pct}%"></div></div>
          <span class="wl-progress-label">${done}/${total}</span>
        </div>` : ""}
      ${stats.minutes > 0 ? `<div class="wl-hint">블록 ${stats.count}개 · 총 ${formatMinutes(stats.minutes)}</div>` : ""}
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
    </section>`;
}

function renderProjectsStatusColumn() {
  // 진행 중인 것만 카드로 세웁니다. 시작도 안 한 프로젝트를 같은 크기로
  // 늘어놓으면 재고를 진행 중인 것처럼 보여주는 셈이고, "다음에 뭘 하지"에
  // 아무 답도 못 줍니다. 대기는 아래에 이름만 한 줄로.
  const wip = wipWorks().sort((a, b) => (workLastTouched(b.id) || 0) - (workLastTouched(a.id) || 0));
  const backlog = backlogWorks();
  const none = wip.length === 0 && backlog.length === 0;
  return `
    <div class="wl-work-head wl-col-head">
      <div class="wl-card-title" style="margin-bottom:0">진행 중 <span class="wl-wip-count ${wip.length >= WIP_LIMIT ? "is-full" : ""}">${wip.length}/${WIP_LIMIT}</span></div>
      <button class="wl-icon-btn" data-action="switchTab" data-tab="works-manage">${ICONS.plus}</button>
    </div>
    ${none ? `<section class="wl-card"><div class="wl-empty wl-empty--pad">아직 할일이 없어요. '할일 관리'에서 추가해보세요.</div></section>` : ""}
    ${!none && wip.length === 0 ? `<section class="wl-card"><div class="wl-empty wl-empty--pad">진행 중인 프로젝트가 없어요. '할일 관리'에서 ${WIP_LIMIT}개까지 올릴 수 있어요.</div></section>` : ""}
    ${wip.map(renderProjectStatusRow).join("")}
    ${backlog.length > 0 ? `
      <section class="wl-card wl-backlog">
        <div class="wl-card-title" style="margin-bottom:8px">대기 ${backlog.length}개</div>
        ${backlog.map((w) => {
          const aging = agingLabel(w.id);
          return `
          <div class="wl-backlog-row">
            <span class="wl-backlog-name">${escapeHtml(w.name)}</span>
            <span class="wl-aging ${aging.stale ? "is-stale" : ""}">${aging.text}</span>
          </div>`;
        }).join("")}
      </section>` : ""}`;
}

// ---- render: column 3 — today summary ----
function renderSpendPresetButtons() {
  return `
    <div class="wl-spend-row">
      ${state.spendPresets.map((p) => `
        <button class="wl-spend-btn" data-action="spendPreset" data-cost="${p.cost}" data-label="${escapeAttr(p.label)}">
          <span>${escapeHtml(p.label)}</span>
          <span class="wl-spend-cost">${p.cost}점</span>
        </button>`).join("")}
    </div>
    <!-- 규칙은 모든 항목이 같으므로 버튼마다 반복하지 않고 여기 한 번만 적습니다. -->
    <div class="wl-hint wl-spend-rule">눌러 둔 점수로 ${SPEND_INCLUDED_MIN / 60}시간, 이후 ${SPEND_MIN_PER_POINT}분마다 1점씩 더</div>
    <div class="wl-field-row wl-field-row--tight">
      <input class="wl-input wl-input--sm" placeholder="다른 것" data-draft="newPresetLabel" value="${escapeAttr(drafts.newPresetLabel)}" />
      <input class="wl-input wl-input--num" placeholder="점" inputmode="numeric" data-draft="newPresetCost" data-enter-action="addSpendPreset" value="${escapeAttr(drafts.newPresetCost)}" />
      <button class="wl-btn wl-btn--ghost" data-action="addSpendPreset">${ICONS.plus}</button>
    </div>`;
}

function renderActiveSpendTimer() {
  const active = state.activeSpend;
  const elapsedMs = Date.now() - active.startedAt;
  return `
    <div class="wl-timer">
      <div class="wl-timer-top">
        <span class="wl-timer-phase is-spend">${ICONS.square} ${escapeHtml(active.label)}</span>
        <span class="wl-timer-clock" id="wl-spend-clock">${formatClock(elapsedMs)}</span>
      </div>
      <div class="wl-hint" id="wl-spend-cost-live">${spendStatusText(active)}</div>
      <div class="wl-timer-actions">
        <button class="wl-btn wl-btn--primary wl-btn--full" data-action="stopSpendTimer">${ICONS.check} 끄기</button>
      </div>
    </div>`;
}

function renderSpendPresetsEditor() {
  return `
    ${state.spendPresets.length === 0 ? `<div class="wl-empty">등록된 소비 항목이 없어요.</div>` : `
      <ul class="wl-tag-list">
        ${state.spendPresets.map((p) => editingPresetId === p.id ? `
          <li class="wl-tag-row">
            <input class="wl-input wl-input--sm" data-draft="editPresetLabel" value="${escapeAttr(editingPresetDraft.label)}" data-enter-action="saveEditSpendPreset" />
            <input class="wl-input wl-input--num" data-draft="editPresetCost" value="${escapeAttr(editingPresetDraft.cost)}" inputmode="numeric" data-enter-action="saveEditSpendPreset" />
            <button class="wl-icon-btn" data-action="saveEditSpendPreset">${ICONS.check}</button>
            <button class="wl-icon-btn" data-action="cancelEditSpendPreset">${ICONS.x}</button>
          </li>` : `
          <li class="wl-tag-row">
            <span class="wl-tag-name">${escapeHtml(p.label)}</span>
            <span class="wl-tag-points">${p.cost}점</span>
            <button class="wl-icon-btn" data-action="editSpendPreset" data-preset="${p.id}">${ICONS.pencil}</button>
            <button class="wl-icon-btn" data-action="removeSpendPreset" data-preset="${p.id}">${ICONS.x}</button>
          </li>`).join("")}
      </ul>`}
    <div class="wl-hint">설정한 점수가 시작하자마자 차감되고 1시간을 쓸 수 있어요. 1시간이 지나면 10분마다 1점씩 추가로 차감돼요.</div>
    <div class="wl-field-row wl-field-row--tight">
      <input class="wl-input wl-input--sm" placeholder="이름" data-draft="newPresetLabel" value="${escapeAttr(drafts.newPresetLabel)}" />
      <input class="wl-input wl-input--num" placeholder="점수" inputmode="numeric" data-draft="newPresetCost" data-enter-action="addSpendPreset" value="${escapeAttr(drafts.newPresetCost)}" />
      <button class="wl-btn wl-btn--ghost" data-action="addSpendPreset">${ICONS.plus}</button>
    </div>`;
}

function renderTodaySummaryColumn() {
  const { todayBlocks, todaySpends, dailyPool, dailySpent, dailyAvailable } = computeToday();
  return `
    <section class="wl-ledger-strip">
      ${figure("오늘 적립", dailyPool)}
      ${figure("오늘 사용", dailySpent)}
      ${figure("오늘 가용", dailyAvailable, dailyAvailable < 0 ? "spend" : "work")}
      ${figure("저축", state.savings, "save")}
    </section>
    <section class="wl-card">
      <div class="wl-work-head">
        <div class="wl-card-title" style="margin-bottom:0">소비</div>
        <button class="wl-icon-btn" data-action="toggleSpendPresetsEdit">${spendPresetsEditOpen ? ICONS.check : ICONS.pencil}</button>
      </div>
      ${spendPresetsEditOpen ? renderSpendPresetsEditor() : (state.activeSpend ? renderActiveSpendTimer() : renderSpendPresetButtons())}
    </section>
    <section class="wl-card">
      <div class="wl-work-head">
        <div class="wl-card-title" style="margin-bottom:0">오늘의 기록</div>
        <button class="wl-icon-btn" data-action="toggleManualBlockForm" title="세션 없이 한 일 기록">${manualBlockOpen ? ICONS.x : ICONS.plus}</button>
      </div>
      ${manualBlockOpen ? renderManualBlockForm() : ""}
      ${todayBlocks.length === 0 && todaySpends.length === 0 ? `<div class="wl-empty">아직 기록이 없어요.</div>` : ""}
      <ul class="wl-log">
        ${mergeLog(todayBlocks, todaySpends).map((item) => item.kind === "block" ? renderBlockLogRow(item.block) : `
          <li class="wl-log-row wl-log-row--spend">
            <span class="wl-log-time">${formatTime(item.at)}</span>
            <div class="wl-log-main"><div class="wl-log-label">${escapeHtml(item.label)}</div></div>
            <span class="wl-log-points">-${item.cost}</span>
          </li>`).join("")}
      </ul>
    </section>`;
}

function manualPreviewText() {
  const p = manualBlockPreview();
  if (!p) return "시작 시각과 소요시간을 넣으면 점수가 미리 보여요.";
  return `${formatTime(p.startedAt)}–${formatTime(p.completedAt)} · ${p.minutes}분 → <b>${p.points}점</b>`
    + (p.points === 0 ? " (25분 이하는 기록만)" : "");
}
// 입력 중에는 화면을 다시 그리지 않고 미리보기 줄만 바꿉니다. render()는
// innerHTML을 통째로 갈아끼우기 때문에, 타이핑 중에 부르면 방금 누른 칸이
// 사라져 포커스가 날아갑니다.
function updateManualPreview() {
  const el = document.getElementById("wl-manual-preview");
  if (el) el.innerHTML = manualPreviewText();
  const btn = document.getElementById("wl-manual-add");
  if (btn) btn.disabled = !(manualBlockPreview() && drafts.manualBlock.task.trim());
}

// 타이머 없이 한 일을 직접 적어 넣는 폼. 시작 시각을 직접 넣기 때문에
// 완료 후 소요시간만 고치는 우회로와 달리 기록된 시간대가 실제와 맞습니다.
function renderManualBlockForm() {
  const d = drafts.manualBlock;
  const p = manualBlockPreview();
  return `
    <div class="wl-manual">
      <div class="wl-hint">타이머를 안 켜고 한 일을 기록해요. 점수는 평소 규칙 그대로 계산됩니다.</div>
      ${renderWorkLinkRow({
        workId: d.workId, subtaskId: d.subtaskId,
        workSelect: "manualWork", subSelect: "manualSub", placeholder: "할일 연결 안 함",
      })}
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="무엇을 했나요?" data-draft="manualTask" data-enter-action="addManualBlock" value="${escapeAttr(d.task)}" />
      </div>
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" type="date" data-draft="manualDate" value="${escapeAttr(d.date)}" />
        <input class="wl-input wl-input--sm" type="time" data-draft="manualTime" value="${escapeAttr(d.time)}" />
        <input class="wl-input wl-input--num" placeholder="분" inputmode="numeric" data-draft="manualMinutes" data-enter-action="addManualBlock" value="${escapeAttr(d.minutes)}" />
      </div>
      <div class="wl-hint" id="wl-manual-preview">${manualPreviewText()}</div>
      <button class="wl-btn wl-btn--primary wl-btn--full" id="wl-manual-add" data-action="addManualBlock"${p && d.task.trim() ? "" : " disabled"}>${ICONS.plus} 기록 추가</button>
    </div>`;
}

// Notes written during a session, so the log shows what actually happened and
// not just the task that was planned.
function blockNotes(blockId) {
  const out = [];
  state.works.forEach((w) => (w.updates || []).forEach((u) => {
    if (u.blockId === blockId && !u.auto) out.push(u.text);
  }));
  return out;
}
// 보통(또는 평가 안 함)은 배지를 달지 않습니다 — 눈에 띄어야 하는 건 양 끝뿐이에요.
function ratingBadge(b) {
  const r = SESSION_RATINGS.find((x) => x.id === b.rating);
  if (!r || r.adjust === 0) return "";
  return ` <span class="wl-rating-badge is-${r.id}">${r.label}</span>`;
}
function renderBlockLogRow(b) {
  // A stretch that rounded to zero minutes (switching 할일 right after a
  // switch, or a block ended immediately) is noise in the log.
  const segs = blockSegments(b).filter((s) => s.minutes > 0);
  if (segs.length === 0) return "";
  const tasks = [...new Set(segs.map((s) => s.task).filter(Boolean))];
  // 직접 입력한 기록은 메모와 할일 이름이 같은 문장이라 두 번 찍힙니다.
  const notes = blockNotes(b.id).filter((n) => !tasks.some((t) => n === t || n.endsWith(`] ${t}`)));
  return `
    <li class="wl-log-row wl-log-row--block">
      <span class="wl-log-time wl-log-time--range">${formatTime(blockStartedAt(b))}<span class="wl-log-dash">–</span>${formatTime(b.completedAt)}</span>
      <div class="wl-log-main">
        <div class="wl-log-works">
          ${segs.map((s) => `<span class="wl-log-work">${escapeHtml(workName(s.workId))}<b>${s.minutes}분</b></span>`).join("")}
        </div>
        ${tasks.length ? `<div class="wl-log-label">${escapeHtml(tasks.join(" · "))}${ratingBadge(b)}${b.manual ? ` <span class="wl-rating-badge">직접 입력</span>` : ""}</div>` : ""}
        ${notes.map((n) => `<div class="wl-log-note">${escapeHtml(n)}</div>`).join("")}
      </div>
      <span class="wl-log-points">+${blockPoints(b)}</span>
      <button class="wl-icon-btn wl-log-del" data-action="removeBlock" data-block="${b.id}" title="기록 삭제">${ICONS.x}</button>
    </li>`;
}

// ---- render: column 4 — savings + goals ----
function renderSavingsCard() {
  const saved = state.savings;
  const inDebt = saved < 0;
  // Math.min alone let a negative value through as a negative CSS width, which
  // is an invalid declaration — the bar then rendered full instead of empty.
  const passes = inDebt ? 0 : Math.floor(saved / OFFDAY_COST);
  const towardNext = inDebt ? 0 : saved % OFFDAY_COST;
  const pct = Math.max(0, Math.min(100, Math.round((towardNext / OFFDAY_COST) * 100)));
  const canUse = saved >= OFFDAY_COST;
  return `
    <section class="wl-card wl-card--center">
      ${ICONS.piggy}
      <div class="wl-save-total ${inDebt ? "is-debt" : ""}">${saved}점</div>
      ${passes > 0 ? `<div class="wl-save-passes">휴무권 ${passes}장</div>` : ""}
      <div class="wl-progress">
        <div class="wl-progress-bar"><div class="wl-progress-fill is-save" style="width:${pct}%"></div></div>
        <span class="wl-progress-label ${inDebt ? "is-debt" : ""}">${inDebt ? `0점까지 ${-saved}` : `${towardNext}/${OFFDAY_COST}`}</span>
      </div>
      <button class="wl-btn wl-btn--primary wl-btn--full" data-action="useOffDay" ${!canUse ? "disabled" : ""}>휴무권 사용 (-${OFFDAY_COST}점)</button>
      ${inDebt
        ? `<div class="wl-hint">쓴 만큼 저축에서 빠졌어요. 0으로 돌아오려면 ${-saved}점이 필요해요.</div>`
        : !canUse ? `<div class="wl-hint">쓰지 않고 남긴 포인트가 매일 저녁 여기로 쌓여요.</div>` : ""}
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

function renderGoalTierPreview(t, totalRevenue) {
  const unlocked = totalRevenue >= t.targetAmount;
  const pct = unlocked ? 100 : Math.min(100, Math.round((totalRevenue / t.targetAmount) * 100));
  return `
    <div class="wl-goal-next">
      ${t.image ? `<img src="${t.image}" class="wl-goal-next-img wl-lightbox-trigger" alt="${escapeAttr(t.label)}" />` : `<div class="wl-goal-next-img wl-goal-next-img--empty">${ICONS.sparkles}</div>`}
      <div class="wl-goal-next-body">
        <div class="wl-goal-next-label">${escapeHtml(t.label)}${unlocked ? `<span class="wl-goal-next-badge">구매 가능</span>` : ""}</div>
        <div class="wl-progress">
          <div class="wl-progress-bar"><div class="wl-progress-fill is-sales" style="width:${pct}%"></div></div>
          <span class="wl-progress-label">${pct}%</span>
        </div>
        <div class="wl-hint">제품가 ${t.actualPrice.toLocaleString()}원 · 목표 ${t.targetAmount.toLocaleString()}원</div>
      </div>
    </div>`;
}

function renderCategoryGoalCard(c, totalRevenue) {
  const tiers = c.tiers.slice().sort((a, b) => a.targetAmount - b.targetAmount);
  const nextTier = tiers.find((t) => t.targetAmount > totalRevenue);
  const expanded = !!expandedGoalCats[c.id];
  return `
    <section class="wl-card wl-goal-cat-card">
      <button class="wl-goal-cat-toggle" data-action="toggleGoalCategory" data-cat="${c.id}">
        <span class="wl-goal-cat-name">${escapeHtml(c.name)}</span>
        <span class="wl-goal-cat-toggle-icon ${expanded ? "is-expanded" : ""}">${ICONS.chevron}</span>
      </button>
      ${expanded
        ? (tiers.length > 0
            ? `<div class="wl-goal-tier-list">${tiers.map((t) => renderGoalTierPreview(t, totalRevenue)).join("")}</div>`
            : `<div class="wl-empty" style="margin-top:10px">등록된 가격대가 없어요.</div>`)
        : (nextTier ? renderGoalTierPreview(nextTier, totalRevenue) : `<div class="wl-empty" style="margin-top:10px">이 카테고리 목표를 모두 달성했어요.</div>`)}
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

function columnLabel(text) {
  return `<div class="wl-col-label">${escapeHtml(text)}</div>`;
}

function renderDashboard() {
  return `
    <div class="wl-dashboard-grid">
      <div class="wl-dash-col">${columnLabel("타임 블록")}${renderTimeBlockColumn()}</div>
      <div class="wl-dash-col">${renderProjectsStatusColumn()}</div>
      <div class="wl-dash-col">${columnLabel("오늘 요약")}${renderTodaySummaryColumn()}</div>
      <div class="wl-dash-col">${columnLabel("저축 · 목표")}${renderSavingsCard()}${renderGoalsColumn()}</div>
    </div>`;
}

// Money lives in 할일 관리, not on the dashboard: costs are entered and read
// back here, item by item, against the project's expected sale price.
function renderCostSection(w) {
  const costs = [...(w.costs || [])].sort((a, b) => b.at - a.at);
  const costDraft = drafts.newCost[w.id] || {};
  const costOpen = !!costFormOpen[w.id];
  const total = workCostTotal(w);
  const expected = w.expectedSalePrice;
  return `
    <div class="wl-card-title" style="margin-top:14px">비용</div>
    <div class="wl-project-money">
      <span>쓴 비용 <b>${total.toLocaleString()}원</b></span>
      <span>판매예상 <b>${expected != null ? `${expected.toLocaleString()}원` : "미설정"}</b></span>
      ${expected != null ? `<span>남는 돈 <b>${(expected - total).toLocaleString()}원</b></span>` : ""}
    </div>
    ${costs.length > 0 ? `
      <ul class="wl-cost-list">
        ${costs.map((c) => `
          <li class="wl-cost-row">
            <span class="wl-cost-date">${escapeHtml(formatKDate(new Date(c.at)))}</span>
            <span class="wl-cost-label">${escapeHtml(c.label || "비용")}</span>
            <span class="wl-cost-amount">${c.amount.toLocaleString()}원</span>
            <button class="wl-icon-btn" data-action="removeWorkCost" data-work="${w.id}" data-cost="${c.id}">${ICONS.x}</button>
          </li>`).join("")}
      </ul>` : ""}
    ${costOpen ? `
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" placeholder="쓴 비용 추가" data-draft="costLabel" data-work="${w.id}" value="${escapeAttr(costDraft.label || "")}" />
        <input class="wl-input wl-input--num" placeholder="금액" inputmode="numeric" data-draft="costAmount" data-work="${w.id}" data-enter-action="addWorkCost" value="${escapeAttr(costDraft.amount || "")}" />
        <button class="wl-btn wl-btn--ghost" data-action="addWorkCost" data-work="${w.id}">${ICONS.check}</button>
        <button class="wl-btn wl-btn--ghost" data-action="toggleCostForm" data-work="${w.id}">${ICONS.x}</button>
      </div>` : `<button class="wl-cost-toggle" data-action="toggleCostForm" data-work="${w.id}">${ICONS.plus} 비용 추가</button>`}`;
}

// ---- render: works-manage tab ----
function renderWorkManageCard(w) {
  const done = w.subtasks.filter((s) => s.done).length;
  const total = w.subtasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isEditing = editingWorkId === w.id;
  const collapsed = !!state.collapsedWorks[w.id];
  const stats = workSessionStats(w.id);
  return `
    <section class="wl-card" data-drag-item="work" data-work="${w.id}">
      <div class="wl-work-head">
        ${isEditing ? `
          <div class="wl-field-row wl-field-row--tight wl-field-row--wrap" style="flex:1;margin:0">
            <input class="wl-input wl-input--sm" data-draft="editWorkName" value="${escapeAttr(editingWorkDraft.name)}" placeholder="할일 이름" data-enter-action="saveEditWork" />
            <input class="wl-input wl-input--num" data-draft="editWorkExpected" value="${escapeAttr(editingWorkDraft.expectedSalePrice)}" placeholder="판매예상" inputmode="numeric" data-enter-action="saveEditWork" />
            <select class="wl-select" data-select="editWorkTag">
              <option value="">태그 없음</option>
              ${state.tags.map((t) => `<option value="${t.id}" ${editingWorkDraft.tagId === t.id ? "selected" : ""}>${escapeHtml(t.name)} (${t.points}점)</option>`).join("")}
            </select>
            <button class="wl-icon-btn" data-action="saveEditWork">${ICONS.check}</button>
            <button class="wl-icon-btn" data-action="cancelEditWork">${ICONS.x}</button>
          </div>` : `
          <div class="wl-work-head-left">
            <span data-drag-handle="work" class="wl-drag-handle" title="드래그해서 순서 변경">${ICONS.grip}</span>
            <button class="wl-work-collapse-toggle" data-action="toggleWorkCollapse" data-work="${w.id}">
              <span class="wl-goal-cat-toggle-icon ${!collapsed ? "is-expanded" : ""}">${ICONS.chevron}</span>
              <span class="wl-work-name">${escapeHtml(w.name)}${workTagBadge(w)}${w.expectedSalePrice != null ? `<span class="wl-work-expected"> · 판매예상 ${w.expectedSalePrice.toLocaleString()}원</span>` : ""}${stats.minutes > 0 ? `<span class="wl-work-expected"> · 총 ${formatMinutes(stats.minutes)}</span>` : ""}</span>
            </button>
          </div>
          <div>
            <button class="wl-wip-toggle ${w.wip ? "is-on" : ""}" data-action="toggleWorkWip" data-work="${w.id}"
                    title="${w.wip ? "대기로 내리기" : "진행 중으로 올리기"}">${w.wip ? "진행 중" : "대기"}</button>
            <button class="wl-icon-btn" data-action="editWork" data-work="${w.id}">${ICONS.pencil}</button>
            <button class="wl-icon-btn" data-action="archiveWork" data-work="${w.id}" title="보관">${ICONS.archive}</button>
            <button class="wl-icon-btn" data-action="removeWork" data-work="${w.id}">${ICONS.trash}</button>
          </div>`}
      </div>
      <div class="wl-progress">
        <div class="wl-progress-bar"><div class="wl-progress-fill" style="width:${pct}%"></div></div>
        <span class="wl-progress-label">${done}/${total}</span>
      </div>
      ${collapsed ? "" : `
        <ul class="wl-subtasks">
          ${w.subtasks.map((st, idx) => {
            const mins = subtaskMinutes(w.id, st.id);
            return `
            <li class="wl-subtask-row" data-drag-item="subtask" data-work="${w.id}">
              <span class="wl-drag-handle" data-drag-handle="subtask">${ICONS.grip}</span>
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
        ${renderCostSection(w)}
        ${(w.updates || []).length > 0 ? `
          <div class="wl-card-title" style="margin-top:14px">세션 기록</div>
          <ul class="wl-session-log">
            ${w.updates.map((u) => {
              const block = u.blockId ? findBlockById(u.blockId) : null;
              const isEditingMin = !!block && editingBlockId === block.id;
              return `
              <li class="wl-session-log-row">
                ${u.image ? `<img src="${u.image}" class="wl-update-img" alt="" />` : ""}
                <div class="wl-session-log-body">
                  <div class="wl-session-log-text">${escapeHtml(u.text)}</div>
                  <div class="wl-session-log-meta">${escapeHtml(formatKDate(new Date(u.at)))} ${formatTime(u.at)}</div>
                  ${block ? (isEditingMin ? `
                    <div class="wl-session-log-duration is-editing">
                      소요시간
                      <input class="wl-inline-num" data-draft="editBlockMinutes" value="${escapeAttr(editingBlockMinutesDraft)}" inputmode="numeric" data-enter-action="saveEditBlockMinutes" />분
                      <button class="wl-icon-btn" data-action="saveEditBlockMinutes">${ICONS.check}</button>
                      <button class="wl-icon-btn" data-action="cancelEditBlockMinutes">${ICONS.x}</button>
                    </div>` : `
                    <button class="wl-session-log-duration" data-action="editBlockMinutes" data-block="${block.id}">
                      ${ICONS.pencil} 소요시간 ${blockMinutes(block)}분 · 수정
                    </button>`) : ""}
                </div>
                <button class="wl-icon-btn" data-action="removeWorkUpdate" data-work="${w.id}" data-update="${u.id}">${ICONS.x}</button>
              </li>`;
            }).join("")}
          </ul>` : ""}
      `}
    </section>`;
}

function renderArchivedWorksSection(archived) {
  return `
    <section class="wl-card">
      <button class="wl-goal-cat-toggle" data-action="toggleArchiveSection">
        <span class="wl-goal-cat-name">보관함 (${archived.length})</span>
        <span class="wl-goal-cat-toggle-icon ${archivedSectionOpen ? "is-expanded" : ""}">${ICONS.chevron}</span>
      </button>
      ${archivedSectionOpen ? `
        <ul class="wl-archive-list">
          ${archived.map((w) => `
            <li class="wl-archive-row">
              <span class="wl-work-name">${escapeHtml(w.name)}</span>
              <button class="wl-btn wl-btn--ghost" data-action="unarchiveWork" data-work="${w.id}">복원</button>
              <button class="wl-icon-btn" data-action="removeWork" data-work="${w.id}">${ICONS.trash}</button>
            </li>`).join("")}
        </ul>` : ""}
    </section>`;
}

function renderWorksManage() {
  const active = state.works.filter((w) => !w.archived);
  const archived = state.works.filter((w) => w.archived);
  return `
    <div class="wl-body">
      <section class="wl-card">
        <div class="wl-field-row wl-field-row--wrap">
          <input class="wl-input" placeholder="새 할일 이름" data-draft="newWorkName" data-enter-action="addWork" value="${escapeAttr(drafts.newWorkName)}" />
          <input class="wl-input wl-input--num" placeholder="판매예상(선택)" inputmode="numeric" data-draft="newWorkExpected" data-enter-action="addWork" value="${escapeAttr(drafts.newWorkExpected)}" />
          <select class="wl-select" data-select="newWorkTag">
            <option value="">태그 없음</option>
            ${state.tags.map((t) => `<option value="${t.id}" ${drafts.newWorkTag === t.id ? "selected" : ""}>${escapeHtml(t.name)} (${t.points}점)</option>`).join("")}
          </select>
          <button class="wl-btn wl-btn--primary" data-action="addWork">${ICONS.plus} 추가</button>
        </div>
      </section>
      ${active.length === 0 ? `<div class="wl-empty wl-empty--pad">등록된 할일이 없어요. 위에서 하나 추가해보세요.</div>` : `
        <div class="wl-work-head wl-col-head">
          <span class="wl-hint">할일 ${active.length}개 · 진행 중 ${wipWorks().length}/${WIP_LIMIT}</span>
          <button class="wl-cost-toggle" data-action="toggleAllWorkCollapse">
            ${anyWorkExpanded() ? "모두 접기" : "모두 펴기"}
          </button>
        </div>`}
      ${active.map(renderWorkManageCard).join("")}
      ${archived.length > 0 ? renderArchivedWorksSection(archived) : ""}
      ${renderTagManageSection()}
    </div>`;
}

function renderTagRow(t) {
  if (editingTagId === t.id) {
    return `
      <li class="wl-tag-row">
        <input class="wl-input wl-input--sm" data-draft="editTagName" value="${escapeAttr(editingTagDraft.name)}" data-enter-action="saveEditTag" />
        <input class="wl-input wl-input--num" data-draft="editTagPoints" value="${escapeAttr(editingTagDraft.points)}" inputmode="numeric" data-enter-action="saveEditTag" />
        <button class="wl-icon-btn" data-action="saveEditTag">${ICONS.check}</button>
        <button class="wl-icon-btn" data-action="cancelEditTag">${ICONS.x}</button>
      </li>`;
  }
  return `
    <li class="wl-tag-row">
      <span class="wl-tag-name">${escapeHtml(t.name)}</span>
      <span class="wl-tag-points">${t.points}점</span>
      <button class="wl-icon-btn" data-action="editTag" data-tag="${t.id}">${ICONS.pencil}</button>
      <button class="wl-icon-btn" data-action="removeTag" data-tag="${t.id}">${ICONS.x}</button>
    </li>`;
}

function renderTagManageSection() {
  return `
    <section class="wl-card">
      <div class="wl-card-title">태그 관리 · 블록 완료 점수</div>
      ${state.tags.length === 0 ? `<div class="wl-empty">등록된 태그가 없어요.</div>` : `<ul class="wl-tag-list">${state.tags.map(renderTagRow).join("")}</ul>`}
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="태그 이름" data-draft="newTagName" value="${escapeAttr(drafts.newTagName)}" />
        <input class="wl-input wl-input--num" placeholder="점수" inputmode="numeric" data-draft="newTagPoints" data-enter-action="addTag" value="${escapeAttr(drafts.newTagPoints)}" />
        <button class="wl-btn wl-btn--ghost" data-action="addTag">${ICONS.plus}</button>
      </div>
    </section>`;
}

// ---- render: goals-manage tab ----
function renderCategoryManageCard(c, totalRevenue, idx) {
  const tiers = c.tiers.slice().sort((a, b) => a.targetAmount - b.targetAmount);
  const draft = drafts.newTier[c.id] || {};
  const isEditingName = editingCategoryId === c.id;
  return `
    <section class="wl-card" data-drag-item="category">
      <div class="wl-work-head">
        ${isEditingName ? `
          <div class="wl-field-row wl-field-row--tight" style="flex:1;margin:0">
            <input class="wl-input wl-input--sm" data-draft="editCategoryName" value="${escapeAttr(editingCategoryDraft)}" data-enter-action="saveEditCategory" />
            <button class="wl-icon-btn" data-action="saveEditCategory">${ICONS.check}</button>
            <button class="wl-icon-btn" data-action="cancelEditCategory">${ICONS.x}</button>
          </div>` : `
          <div class="wl-work-head-left">
            <span data-drag-handle="category" class="wl-drag-handle" title="드래그해서 순서 변경">${ICONS.grip}</span>
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
            ${typeof Notification !== "undefined" ? `
              <button class="wl-icon-btn ${Notification.permission === "granted" ? "is-active" : ""}" data-action="requestNotifications" title="${Notification.permission === "granted" ? "타이머 알림 켜짐" : "타이머 알림 받기"}">${ICONS.bell}</button>
            ` : ""}
            ${floatingTimerSupported() ? `
              <button class="wl-icon-btn ${floatingTimerOn ? "is-active" : ""}" data-action="toggleFloatingTimer" title="${floatingTimerOn ? "떠 있는 타이머 닫기" : "타이머를 화면 위에 띄우기"}">${ICONS.pip}</button>
            ` : ""}
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
      ${floatingTimerNote ? `<div class="wl-savebar wl-savebar--error">${escapeHtml(floatingTimerNote)}</div>` : ""}
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

function renderResetSection() {
  const blockCount = Object.values(state.blocksByDate).reduce((a, list) => a + list.length, 0);
  const spendCount = Object.values(state.spendsByDate).reduce((a, list) => a + list.length, 0);
  const armed = (scope, label, warning) => `
    <div class="wl-reset-armed">
      <div class="wl-reset-warning">${warning}</div>
      <div class="wl-settings-actions">
        <button class="wl-btn wl-btn--danger" data-action="confirmReset" data-scope="${scope}">${label}</button>
        <button class="wl-btn wl-btn--ghost" data-action="cancelReset">취소</button>
      </div>
    </div>`;
  return `
    <div class="wl-reset">
      <div class="wl-settings-label">초기화</div>
      <div class="wl-hint">지금 저장된 기록: 블록 ${blockCount}개 · 소비 ${spendCount}건 · 저축 ${state.savings}점 · 할일 ${state.works.length}개</div>
      ${resetConfirm === "data"
        ? armed("data", "기록 지우기", `블록·소비·저축·수익 기록과 세션 기록을 모두 지웁니다. 할일 목록, 태그, 소비 항목, 목표 설정은 남습니다. 되돌릴 수 없어요.`)
        : resetConfirm === "all"
          ? armed("all", "전부 지우기", `할일, 태그, 소비 항목, 목표까지 포함해 처음 상태로 되돌립니다. 되돌릴 수 없어요.`)
          : `
            <div class="wl-settings-actions">
              <button class="wl-btn wl-btn--ghost" data-action="askReset" data-scope="data">기록만 초기화</button>
              <button class="wl-btn wl-btn--ghost" data-action="askReset" data-scope="all">전체 초기화</button>
            </div>`}
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
          </div>
          ${state ? renderResetSection() : ""}` : ""}
      </div>
    </div>`;
}

function renderImageLightbox() {
  return `
    <div class="wl-lightbox-overlay" data-action="closeLightbox">
      <img src="${lightboxImage.src}" alt="${escapeAttr(lightboxImage.alt)}" class="wl-lightbox-img" />
      <button class="wl-icon-btn wl-lightbox-close" data-action="closeLightbox">${ICONS.x}</button>
    </div>`;
}

function render() {
  const root = document.getElementById("app");
  // innerHTML replacement below recreates the dashboard grid from scratch,
  // which would otherwise reset its horizontal swipe position on mobile
  // every time any action triggers a re-render.
  const prevGrid = root.querySelector(".wl-dashboard-grid");
  const prevScrollLeft = prevGrid ? prevGrid.scrollLeft : 0;
  let html = "";
  if (phase === "loading") html = renderLoading();
  else if (phase === "loadError") html = renderLoadError();
  else if (state) html = renderShell();
  root.innerHTML = html;
  renderedDay = todayKey();
  if (state) syncTimerWindow();
  if (settingsOpen) root.insertAdjacentHTML("beforeend", renderSettingsOverlay());
  if (lightboxImage) root.insertAdjacentHTML("beforeend", renderImageLightbox());
  if (prevScrollLeft) {
    const newGrid = root.querySelector(".wl-dashboard-grid");
    if (newGrid) newGrid.scrollLeft = prevScrollLeft;
  }
  updateSaveIndicator();
}

// ---- event wiring ----
function runAction(name, ds) {
  switch (name) {
    case "finishEarly": finishEarly(); break;
    case "togglePauseSession": togglePauseSession(); break;
    case "rateSession": rateSession(ds.rating); break;
    case "undoCancelBlock": undoCancelBlock(); break;
    case "toggleManualBlockForm": toggleManualBlockForm(); break;
    case "addManualBlock": addManualBlock(); break;
    case "removeBlock": removeBlock(ds.block); break;
    case "skipBreak": skipBreak(); break;
    case "cancelBlock": cancelBlock(); break;
    case "spendPreset": startSpendTimer(ds.label, Number(ds.cost)); break;
    case "stopSpendTimer": stopSpendTimer(); break;
    case "useOffDay": useOffDay(); break;
    case "toggleSpendPresetsEdit": toggleSpendPresetsEdit(); break;
    case "addSpendPreset": addSpendPreset(); break;
    case "removeSpendPreset": removeSpendPreset(ds.preset); break;
    case "editSpendPreset": startEditSpendPreset(ds.preset); break;
    case "saveEditSpendPreset": saveEditSpendPreset(); break;
    case "cancelEditSpendPreset": cancelEditSpendPreset(); break;
    case "openSettings": openSettings(); break;
    case "requestNotifications": requestNotifications(); break;
    case "toggleFloatingTimer": toggleFloatingTimer(); break;
    case "closeSettings": closeSettings(); break;
    case "saveSettings": submitSettings(); break;
    case "testSettings": testSettingsForm(); break;
    case "logout": doLogout(); break;
    case "askReset": askReset(ds.scope); break;
    case "cancelReset": cancelReset(); break;
    case "confirmReset": doReset(ds.scope); break;
    case "switchTab": switchTab(ds.tab); break;
    case "retryLoad": boot(); break;
    case "addWork": addWork(); break;
    case "removeWork": removeWork(ds.work); break;
    case "editWork": startEditWork(ds.work); break;
    case "saveEditWork": saveEditWork(); break;
    case "cancelEditWork": cancelEditWork(); break;
    case "toggleWorkCollapse": toggleWorkCollapse(ds.work); break;
    case "toggleAllWorkCollapse": toggleAllWorkCollapse(); break;
    case "archiveWork": archiveWork(ds.work); break;
    case "toggleWorkWip": toggleWorkWip(ds.work); break;
    case "unarchiveWork": unarchiveWork(ds.work); break;
    case "toggleArchiveSection": toggleArchiveSection(); break;
    case "addSubtask": addSubtask(ds.work); break;
    case "toggleSubtask": toggleSubtask(ds.work, ds.sub); break;
    case "removeSubtask": removeSubtask(ds.work, ds.sub); break;
    case "addWorkCost": addWorkCost(ds.work); break;
    case "removeWorkCost": removeWorkCost(ds.work, ds.cost); break;
    case "removeWorkUpdate": removeWorkUpdate(ds.work, ds.update); break;
    case "editBlockMinutes": startEditBlockMinutes(ds.block); break;
    case "saveEditBlockMinutes": saveEditBlockMinutes(); break;
    case "cancelEditBlockMinutes": cancelEditBlockMinutes(); break;
    case "toggleCostForm": toggleCostForm(ds.work); break;
    case "clearPendingUpdateImage": drafts.pendingUpdate.image = null; render(); break;
    case "togglePendingSubtaskDone": drafts.pendingUpdate.subtaskDone = !drafts.pendingUpdate.subtaskDone; render(); break;
    case "savePendingUpdate": savePendingSessionUpdate(); break;
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
    case "toggleSwitchForm": toggleSwitchForm(); break;
    case "switchSessionWork": switchSessionWork(); break;
    case "switchToLinkedWork": switchSessionWork(ds.index); break;
    case "addQueueExtraLink": addQueueExtraLink(); break;
    case "removeQueueExtraLink": removeQueueExtraLink(ds.index); break;
    case "addUpdateExtraLink": addUpdateExtraLink(); break;
    case "removeUpdateExtraLink": removeUpdateExtraLink(ds.index); break;
    case "toggleGoalCategory": toggleGoalCategoryExpand(ds.cat); break;
    case "addTag": addTag(); break;
    case "removeTag": removeTag(ds.tag); break;
    case "editTag": startEditTag(ds.tag); break;
    case "saveEditTag": saveEditTag(); break;
    case "cancelEditTag": cancelEditTag(); break;
    case "closeLightbox": closeImageLightbox(); break;
  }
}

function onRootClick(e) {
  const trigger = e.target.closest(".wl-lightbox-trigger");
  if (trigger) {
    e.preventDefault();
    openImageLightbox(trigger.src, trigger.alt);
    return;
  }
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
    case "newWorkName": drafts.newWorkName = value; break;
    case "newWorkExpected": drafts.newWorkExpected = clampNumeric(); break;
    case "editWorkName": editingWorkDraft.name = value; break;
    case "editWorkExpected": editingWorkDraft.expectedSalePrice = clampNumeric(); break;
    case "newSubtask": drafts.newSubtask[el.dataset.work] = value; break;
    case "newTagName": drafts.newTagName = value; break;
    case "newTagPoints": drafts.newTagPoints = clampNumeric(); break;
    case "editTagName": editingTagDraft.name = value; break;
    case "editTagPoints": editingTagDraft.points = clampNumeric(); break;
    case "newPresetLabel": drafts.newPresetLabel = value; break;
    case "newPresetCost": drafts.newPresetCost = clampNumeric(); break;
    case "editPresetLabel": editingPresetDraft.label = value; break;
    case "editPresetCost": editingPresetDraft.cost = clampNumeric(); break;
    case "editBlockMinutes": editingBlockMinutesDraft = clampNumeric(); break;
    case "pendingUpdateText": drafts.pendingUpdate.text = value; break;
    case "pendingUpdateCostLabel": drafts.pendingUpdate.costLabel = value; break;
    case "pendingUpdateCostAmount": drafts.pendingUpdate.costAmount = clampNumeric(); break;
    case "manualTask": drafts.manualBlock.task = value; updateManualPreview(); break;
    case "manualDate": drafts.manualBlock.date = value; updateManualPreview(); break;
    case "manualTime": drafts.manualBlock.time = value; updateManualPreview(); break;
    case "manualMinutes": drafts.manualBlock.minutes = clampNumeric(); updateManualPreview(); break;
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
    case "switchTask": drafts.switchDraft.task = value; break;
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
    if (kind === "manualWork") { drafts.manualBlock.workId = select.value; drafts.manualBlock.subtaskId = ""; render(); }
    if (kind === "manualSub") { drafts.manualBlock.subtaskId = select.value; render(); }
    if (kind === "queueWork") { drafts.queueDraft.workId = select.value; drafts.queueDraft.subtaskId = ""; render(); }
    if (kind === "queueSub") { drafts.queueDraft.subtaskId = select.value; }
    if (kind === "queueExtraWork") { const l = drafts.queueDraft.extraLinks[Number(select.dataset.index)]; if (l) { l.workId = select.value; l.subtaskId = ""; render(); } }
    if (kind === "queueExtraSub") { const l = drafts.queueDraft.extraLinks[Number(select.dataset.index)]; if (l) l.subtaskId = select.value; }
    if (kind === "updateExtraWork") { const l = drafts.pendingUpdate.extraLinks[Number(select.dataset.index)]; if (l) { l.workId = select.value; l.subtaskId = ""; render(); } }
    if (kind === "updateExtraSub") { const l = drafts.pendingUpdate.extraLinks[Number(select.dataset.index)]; if (l) l.subtaskId = select.value; }
    if (kind === "switchWork") { drafts.switchDraft.workId = select.value; drafts.switchDraft.subtaskId = ""; render(); }
    if (kind === "switchSub") { drafts.switchDraft.subtaskId = select.value; }
    if (kind === "newWorkTag") { drafts.newWorkTag = select.value; }
    if (kind === "editWorkTag") { editingWorkDraft.tagId = select.value; }
  }
}

// Reordering runs on pointer events rather than HTML5 drag-and-drop: native
// dragging never fires from touch at all (so it did nothing on the phone) and
// Safari is picky about it even with a mouse. Pointer events behave the same
// everywhere. A drag starts from a grip handle only, so lists still scroll.
function dragItemsFor(kind, scopeWorkId) {
  const sel = scopeWorkId
    ? `[data-drag-item="${kind}"][data-work="${scopeWorkId}"]`
    : `[data-drag-item="${kind}"]`;
  return [...document.querySelectorAll(sel)];
}
function targetIndexAt(items, y) {
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    if (y <= r.bottom) return i;
  }
  return items.length - 1;
}
function markDropTarget() {
  dragSource.items.forEach((el, i) => el.classList.toggle("is-drop-target", i === dragSource.to && i !== dragSource.from));
}
function onPointerDown(e) {
  if (e.button > 0) return;
  const handle = e.target.closest("[data-drag-handle]");
  if (!handle) return;
  const kind = handle.dataset.dragHandle;
  const item = handle.closest(`[data-drag-item="${kind}"]`);
  if (!item) return;
  e.preventDefault();
  const scope = kind === "subtask" ? item.dataset.work : null;
  const items = dragItemsFor(kind, scope);
  const from = items.indexOf(item);
  if (from < 0) return;
  dragSource = { kind, item, items, from, to: from };
  item.classList.add("is-dragging");
  try { handle.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
}
function onPointerMove(e) {
  if (!dragSource) return;
  e.preventDefault();
  dragSource.to = targetIndexAt(dragSource.items, e.clientY);
  markDropTarget();
}
function onPointerUp() {
  if (!dragSource) return;
  const { kind, item, items, from, to } = dragSource;
  item.classList.remove("is-dragging");
  items.forEach((el) => el.classList.remove("is-drop-target"));
  dragSource = null;
  if (to === from || to < 0) return;
  if (kind === "work") reorderWorks(item.dataset.work, items[to].dataset.work);
  else if (kind === "subtask") reorderSubtasks(item.dataset.work, from, to);
  else if (kind === "queue") { reorderArray(state.queue, from, to); persistAndRender(); }
  else if (kind === "category") reorderCategories(from, to);
}
function onPointerCancel() {
  if (!dragSource) return;
  dragSource.item.classList.remove("is-dragging");
  dragSource.items.forEach((el) => el.classList.remove("is-drop-target"));
  dragSource = null;
}

function attachHandlers() {
  const root = document.getElementById("app");
  root.addEventListener("click", onRootClick);
  root.addEventListener("input", onRootInput);
  root.addEventListener("change", onRootChange);
  root.addEventListener("keydown", onRootKeydown);
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerCancel);
  // Closing the floating window from its own controls has to switch the
  // header button back off.
  const pipVideo = document.getElementById("wl-pip-video");
  if (pipVideo) {
    const off = () => { if (floatingTimerOn) { floatingTimerOn = false; render(); } };
    pipVideo.addEventListener("leavepictureinpicture", off);
    pipVideo.addEventListener("webkitpresentationmodechanged", () => {
      if (pipVideo.webkitPresentationMode !== "picture-in-picture") off();
    });
  }
}

attachHandlers();
boot();
