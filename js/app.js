import {
  getCredentials, saveCredentials, clearCredentials, hasCredentials,
  testConnection, fetchState, writeState,
} from "./github-api.js";

// ---- config ----
const WORK_MIN = 50;
const BREAK_MIN = 10;
// 15점일 때는 하루 2시간 반만 일해도 4~5일마다 한 장이 찼습니다. 주 5일 기준
// 주 1.6일치 휴무라 너무 헐했어요. 30점이면 같은 페이스로 8~9일에 한 장이고,
// 열심히 한 날 페이스(순증 10점)면 사흘에 한 장입니다 — 많이 할수록 빨리
// 버는 구조는 그대로 둡니다. 그게 이 장부의 목적이라서요.
const OFFDAY_COST = 30;
// 예전에 쓴 휴무권의 값. 로그에 숫자만 남아 있던 시절 기록을 그때 가격으로
// 읽기 위해 남겨둡니다.
const LEGACY_OFFDAY_COST = 15;
const SPEND_INCLUDED_MIN = 60; // a preset's points buy this much time up front
const SPEND_MIN_PER_POINT = 10; // past the included time: 1 more point per 10 minutes
const SIZE_WARN_BYTES = 900 * 1024; // Contents API caps file writes around 1MB

const DEFAULT_SPEND_PRESETS = [
  { label: "게임", cost: 3 },
  { label: "웹서핑", cost: 3 },
];

// 전속계약 5:5가 원칙이라 전역 기본값 하나로 둡니다. 갤러리 수수료만이 아니라
// 세금·수수료처럼 위에서 떼이는 것 전부를 흡수하는 "실수령률"입니다.
const DEFAULT_PAYOUT_RATE = 50;
// 물건값이 수입의 몇 %여야 살 만한가. 보수적으로 5%가 기본값이고, 목표 금액은
// 여기서 자동으로 나옵니다 — 실제 가격만 넣으면 얼마를 벌어야 하는지가 정해집니다.
const DEFAULT_GOAL_RATE = 5;
// 목표를 "돈"이 아니라 "작품 몇 개"로 환산하기 위한 기준가(판매가). 4억은 그냥
// 큰 숫자지만 200개는 현실성이 바로 보입니다.
const DEFAULT_AVG_WORK_PRICE = 4000000;
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

// 클립보드에 있는 사진을 바로 가져옵니다. 맥에서 화면을 캡처하면 파일 없이
// 클립보드에만 들어가는데, 그걸 쓰려고 매번 파일로 저장하는 게 번거로워서요.
// resizeImageFile은 FileReader를 쓰므로 File이든 Blob이든 그대로 받습니다.
// 못 가져온 이유를 구분해 돌려주고, 알리는 건 부르는 쪽이 합니다.
async function readClipboardImage() {
  if (!navigator.clipboard || !navigator.clipboard.read) return { error: "unsupported" };
  let items;
  try {
    items = await navigator.clipboard.read();
  } catch (e) {
    // 권한을 막았거나 사용자 제스처 밖에서 불린 경우
    return { error: e && e.name === "NotAllowedError" ? "denied" : "failed" };
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (!type) continue;
    try {
      return { dataUrl: await resizeImageFile(await item.getType(type)) };
    } catch (e) {
      return { error: "failed" };
    }
  }
  return { error: "empty" };
}
const CLIPBOARD_ERRORS = {
  unsupported: "이 브라우저는 클립보드에서 바로 붙여넣기를 못 해요. 옆의 사진 버튼으로 골라주세요.",
  denied: "클립보드 읽기를 허용해야 붙여넣을 수 있어요.",
  empty: "클립보드에 사진이 없어요.",
  failed: "붙여넣기에 실패했어요. 사진 버튼으로 골라주세요.",
};
// 붙여넣은 사진을 어디에 넣을지는 부른 버튼이 들고 있습니다 — 화면에 사진칸이
// 여럿이라 "지금 고른 칸" 같은 걸 두면 헷갈려서요.
async function pasteImageInto(apply) {
  const { dataUrl, error } = await readClipboardImage();
  if (error) { window.alert(CLIPBOARD_ERRORS[error]); return; }
  apply(dataUrl);
}

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
    weeklyGoalCollapsed: false,
    savings: 0,
    processedDates: [],
    offDayLog: [],
    works: [],
    revenueLog: [],
    categories: [],
    activeBlock: null,
    activeSpend: null,
    cancelledBlock: null,
    payoutRate: DEFAULT_PAYOUT_RATE,
    habits: [],        // { id, name, pinned, retiredAt, createdAt }
    habitLog: {},      // { "2026-09-09": [habitId, ...] }
    weeklyGoals: {},   // { "2026-09-07"(월요일): ["workId:subtaskId", ...] }
    monthlyGoals: {},  // { "2026-09": ["workId", ...] }
    goalRate: DEFAULT_GOAL_RATE,
    avgWorkPrice: DEFAULT_AVG_WORK_PRICE,
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
  s.weeklyGoalCollapsed = !!s.weeklyGoalCollapsed;
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
  if (typeof s.payoutRate !== "number" || !(s.payoutRate > 0)) s.payoutRate = DEFAULT_PAYOUT_RATE;
  s.habits = (s.habits || []).map((h) => ({ ...h, pinned: h.pinned === true, retiredAt: h.retiredAt || null }));
  s.habitLog = s.habitLog || {};
  // 예전에는 타임스탬프 숫자만 넣었습니다. 그때 산 값은 15점이었으니 그대로 둡니다.
  s.offDayLog = (s.offDayLog || []).map((e) =>
    typeof e === "number" ? { at: e, cost: LEGACY_OFFDAY_COST } : e);
  s.weeklyGoals = s.weeklyGoals || {};
  s.monthlyGoals = s.monthlyGoals || {};
  if (typeof s.goalRate !== "number" || !(s.goalRate > 0)) s.goalRate = DEFAULT_GOAL_RATE;
  if (typeof s.avgWorkPrice !== "number" || !(s.avgWorkPrice > 0)) s.avgWorkPrice = DEFAULT_AVG_WORK_PRICE;
  // 목표 금액은 실제 가격에서 파생되는 값이라 저장본과 어긋날 수 없게 매번 맞춥니다.
  // 필수재는 비율을 적용하지 않습니다 — 차값의 20배를 벌어야 한다는 건 말이 안 되고,
  // 필요한 건 "언제까지 그 돈이 있어야 하는가"뿐입니다.
  s.categories.forEach((c) => {
    c.kind = c.kind === "essential" ? "essential" : "luxury";
    c.tiers.forEach((t) => {
      t.targetAmount = c.kind === "essential" ? t.actualPrice : goalTargetFor(t.actualPrice, s.goalRate);
    });
  });
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
// 세션 기록 줄마다 손볼 거리가 넷이나 돼서 목록이 버튼 벽이 됐습니다. 평소엔
// 감춰두고 ⋯ 를 누른 한 줄에서만 폅니다. 한 번에 한 줄이면 충분해요.
let openUpdateId = null;
let editingBlockMinutesDraft = "";
let spendPresetsEditOpen = false;
let notifiedKey = null;
let renderedDay = null;
let resetConfirm = null;
let logScale = "week"; // week | month
let logAnchor = null;
let goalPickerOpen = false;
let habitEditOpen = false;
let exportMsg = "";  // 보고 있는 기간 안의 아무 날짜 (null = 오늘)
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
  saleAmount: {},
  newHabit: "",
  payoutRate: null,
  goalRate: null,
  avgWorkPrice: null,
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
    const leftover = Math.max(0, dailyPoolFromBlocks(blocks) + habitPointsFor(date) - spentTotal(spends));
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

// ---- 습관 ----
// 습관은 할일이 아닙니다. 끝이 없고, 하위 할일도 진행률도 없고, 값어치가
// "얼마나 오래"가 아니라 "빠짐없이"에 있습니다. 그래서 블록이 아니라 체크로
// 다루고, 25분 문턱 같은 시간 규칙이 아예 걸리지 않습니다.
const HABIT_PINNED_MAX = 2;   // 점수를 주는 습관 수 — 새로 들이는 건 한둘이 한계
const HABIT_LIST_MAX = 5;     // 목록 전체. 이 이상은 다 그만두게 된다는 게 통설
function activeHabits() {
  // 지정(점수 받는) 습관을 위로. 매일 먼저 보게 되는 게 그것들이라서요.
  return state.habits.filter((h) => !h.retiredAt)
    .sort((a, b) => (b.pinned === true) - (a.pinned === true));
}
function retiredHabits() {
  return state.habits.filter((h) => h.retiredAt);
}
function habitDone(habitId, day) {
  return (state.habitLog[day] || []).includes(habitId);
}
// 지정 습관은 각 1점, 나머지는 트래킹. 그날 살아있는 습관을 모두 채우면 +1.
// 상한이 구조로 잡혀서(지정 2개) 개수로 점수를 벌 수 없습니다.
function habitPointsFor(day) {
  const done = state.habitLog[day] || [];
  if (done.length === 0) return 0;
  const live = activeHabits();
  const pinned = live.filter((h) => h.pinned && done.includes(h.id)).length;
  const all = live.length > 0 && live.every((h) => done.includes(h.id));
  return pinned + (all ? 1 : 0);
}
// 유예는 두지 않습니다. 대신 최고 기록이 남아서, 끊겨도 세운 건 안 사라집니다.
function habitStreak(habitId) {
  let d = new Date();
  if (!habitDone(habitId, todayKey(d))) d = addDays(d, -1); // 오늘 아직이면 어제부터
  let n = 0;
  while (habitDone(habitId, todayKey(d))) { n += 1; d = addDays(d, -1); }
  return n;
}
function habitBestStreak(habitId) {
  const days = Object.keys(state.habitLog).filter((k) => state.habitLog[k].includes(habitId)).sort();
  let best = 0, run = 0, prev = null;
  days.forEach((k) => {
    run = prev && todayKey(addDays(dateFromKey(prev), 1)) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  });
  return best;
}
function habitCountBetween(habitId, keys) {
  return keys.filter((k) => habitDone(habitId, k)).length;
}
function toggleHabitToday(habitId) {
  const day = todayKey();
  const list = state.habitLog[day] || [];
  state.habitLog[day] = list.includes(habitId) ? list.filter((x) => x !== habitId) : [...list, habitId];
  if (state.habitLog[day].length === 0) delete state.habitLog[day];
  persistAndRender();
}
function addHabit() {
  const name = drafts.newHabit.trim();
  if (!name || activeHabits().length >= HABIT_LIST_MAX) return;
  state.habits.push({
    id: uid(), name,
    pinned: activeHabits().filter((h) => h.pinned).length < HABIT_PINNED_MAX,
    retiredAt: null, createdAt: Date.now(),
  });
  drafts.newHabit = "";
  persistAndRender();
}
function toggleHabitPinned(habitId) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  if (!h.pinned && activeHabits().filter((x) => x.pinned).length >= HABIT_PINNED_MAX) {
    window.alert(`점수를 주는 습관은 ${HABIT_PINNED_MAX}개까지예요.\n먼저 하나를 내려주세요.`);
    return;
  }
  h.pinned = !h.pinned;
  persistAndRender();
}
// 정착 = 졸업. 목록에서 빠져 명예의 전당으로 가고, 지정 자리를 돌려줍니다.
function retireHabit(habitId) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  if (!window.confirm(`"${h.name}"을(를) 정착시킬까요?\n명예의 전당으로 가고 목록에서 빠집니다.`)) return;
  h.retiredAt = Date.now();
  h.pinned = false;
  persistAndRender();
}
function unretireHabit(habitId) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  h.retiredAt = null;
  persistAndRender();
}
function removeHabit(habitId) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h || !window.confirm(`"${h.name}" 습관을 지울까요?\n지금까지의 체크 기록도 함께 사라집니다.`)) return;
  state.habits = state.habits.filter((x) => x.id !== habitId);
  Object.keys(state.habitLog).forEach((k) => {
    state.habitLog[k] = state.habitLog[k].filter((x) => x !== habitId);
    if (state.habitLog[k].length === 0) delete state.habitLog[k];
  });
  persistAndRender();
}

function computeToday() {
  const today = todayKey();
  const todayBlocks = state.blocksByDate[today] || [];
  const todaySpends = state.spendsByDate[today] || [];
  const dailyPool = dailyPoolFromBlocks(todayBlocks) + habitPointsFor(today);
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

// 완료도 한 번 묻습니다. 계속 할 생각이었는데 눌러버리면 블록이 거기서
// 끊기고, 남은 시간은 다음 블록으로 쪼개져 점수 계산이 달라져요. 아직 점수가
// 덜 찼다면 얼마나 더 하면 되는지도 같이 알려줍니다.
function finishEarly() {
  const active = state.activeBlock;
  if (!active) return;
  const minutes = Math.round(activeElapsedMs(active) / 60000);
  const points = computeBlockPoints(segmentsBasePoints(closedSegments(active, Date.now())), minutes);
  const full = computeBlockPoints(segmentsBasePoints(closedSegments(active, Date.now())), WORK_MIN);
  const more = minutes < WORK_MIN && full > points
    ? `\n${WORK_MIN - minutes}분 더 하면 ${full}점이 돼요.`
    : "";
  if (!window.confirm(`${minutes}분 · ${points}점으로 이 블록을 완료할까요?${more}`)) return;
  completeActiveBlock();
}
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
  if (state.activeSpend) {
    window.alert("소비 타이머가 돌아가는 중이에요. 먼저 끄고 시작해주세요.");
    return;
  }
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
  // 작업과 소비가 같이 돌아가는 상태는 애초에 있으면 안 됩니다. 시간은 하나뿐이고
  // 둘 다 켜져 있으면 어느 쪽 기록도 사실이 아니게 돼요.
  if (state.activeBlock) {
    window.alert("작업 블록이 돌아가는 중이에요. 블록을 끝내거나 중단한 뒤에 시작해주세요.");
    return;
  }
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
  // 값을 같이 남깁니다. 가격이 또 바뀌어도 지난 기록이 그때 값 그대로 읽히게요.
  state.offDayLog.push({ at: Date.now(), cost: OFFDAY_COST });
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
function toggleWeeklyGoalCollapse() {
  state.weeklyGoalCollapsed = !state.weeklyGoalCollapsed;
  persistAndRender();
}
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
// 사진은 휴식 때만 붙일 수 있었습니다. 그때를 놓치면 다시 넣을 자리가 없어서,
// 세션 기록 줄에서 언제든 붙이고 바꾸고 뺄 수 있게 했습니다.
function setWorkUpdateImage(workId, updateId, dataUrl) {
  const w = state.works.find((x) => x.id === workId);
  const u = w && (w.updates || []).find((x) => x.id === updateId);
  if (!u) return;
  u.image = dataUrl;
  persistAndRender();
}
function removeWorkUpdateImage(workId, updateId) {
  setWorkUpdateImage(workId, updateId, null);
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
  const actualPrice = Number(draft.actualPrice);
  if (!draft.label || !draft.label.trim() || !actualPrice || actualPrice <= 0) return;
  const c = state.categories.find((x) => x.id === catId);
  if (!c) return;
  const targetAmount = c.kind === "essential" ? actualPrice : goalTargetFor(actualPrice);
  if (draft.editingId) {
    const t = c.tiers.find((x) => x.id === draft.editingId);
    if (t) {
      t.label = draft.label.trim();
      t.targetAmount = targetAmount;
      t.actualPrice = actualPrice;
      t.dueDate = draft.dueDate || null;
      t.image = draft.image || null;
    }
  } else {
    c.tiers.push({ id: uid(), label: draft.label.trim(), targetAmount, actualPrice, dueDate: draft.dueDate || null, image: draft.image || null });
  }
  drafts.newTier[catId] = { label: "", actualPrice: "", dueDate: "", image: null };
  persistAndRender();
}
function startEditTier(catId, tierId) {
  const c = state.categories.find((x) => x.id === catId);
  const t = c && c.tiers.find((x) => x.id === tierId);
  if (!t) return;
  drafts.newTier[catId] = {
    label: t.label, actualPrice: String(t.actualPrice),
    dueDate: t.dueDate || "", image: t.image || null, editingId: t.id,
  };
  render();
}
function cancelEditTier(catId) {
  drafts.newTier[catId] = { label: "", actualPrice: "", dueDate: "", image: null };
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
function switchTab(tab) {
  // 기록 탭은 늘 이번 기간에서 시작합니다 — 지난달을 보다 나갔다 돌아왔는데
  // 여전히 지난달이면 지금이 어디인지 헷갈립니다.
  if (tab === "log") { logScale = "week"; logAnchor = null; goalPickerOpen = false; }
  currentTab = tab;
  render();
}

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

function renderImagePicker({ value, pickAction, pasteAction, clearAction, work, cat }) {
  const extra = `${work ? ` data-work="${work}"` : ""}${cat ? ` data-cat="${cat}"` : ""}`;
  if (value) {
    return `
      <div class="wl-imgpick has-image">
        <img src="${value}" class="wl-imgpick-preview" alt="" />
        <button type="button" class="wl-icon-btn wl-imgpick-clear" data-action="${clearAction}"${extra}>${ICONS.x}</button>
      </div>`;
  }
  return `
    <div class="wl-imgpick-row">
      <label class="wl-imgpick">
        <input type="file" accept="image/*" hidden data-filepick="${pickAction}"${extra} />
        ${ICONS.image}
        <span>사진</span>
      </label>
      <button type="button" class="wl-imgpick wl-imgpick--paste" data-action="${pasteAction}"${extra}>붙여넣기</button>
    </div>`;
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
        ${(() => {
          const subs = selected ? pickableSubtasks(selected, d.subtaskId) : [];
          return subs.length === 0 ? "" : `
          <select class="wl-select" data-select="switchSub">
            <option value="">하위 할일 선택 안 함</option>
            ${subs.map((st) => `<option value="${st.id}" ${d.subtaskId === st.id ? "selected" : ""}>${escapeHtml(st.name)}${st.done ? " (완료됨)" : ""}</option>`).join("")}
          </select>`;
        })()}
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
        ${renderImagePicker({ value: draft.image || null, pickAction: "pickPendingUpdateImage", pasteAction: "pastePendingUpdateImage", clearAction: "clearPendingUpdateImage" })}
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

// 타임블록에 붙일 때는 아직 안 끝낸 하위 할일만 고릅니다. 이미 골라둔 것이
// 그 사이 완료됐다면 그것만은 남겨요 — 목록에서 조용히 사라져 선택이 풀리는
// 쪽이 더 헷갈리니까요.
function pickableSubtasks(w, selectedId) {
  return (w.subtasks || []).filter((st) => !st.done || st.id === selectedId);
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
      ${(() => {
        const subs = selected ? pickableSubtasks(selected, subtaskId) : [];
        return subs.length === 0 ? "" : `
        <select class="wl-select" data-select="${subSelect}"${idx}>
          <option value="">하위 할일 선택 안 함</option>
          ${subs.map((st) => `<option value="${st.id}" ${subtaskId === st.id ? "selected" : ""}>${escapeHtml(st.name)}${st.done ? " (완료됨)" : ""}</option>`).join("")}
        </select>`;
      })()}
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

// 다음에 뭘 할지 정하는 자리 바로 위에 이번 주 약속을 둡니다 — 안 보이는
// 약속은 행동을 이끌지 못합니다. 정해둔 게 없으면 아예 나오지 않습니다.
// 접을 수 있게 둔 이유는 목록이 길어지면 바로 아래 타임블록이 화면 밖으로
// 밀려나서입니다. 접어도 몇/몇은 제목 줄에 남아서 약속 자체는 계속 보입니다.
function renderWeeklyGoalCard() {
  const { total, done, items } = goalProgress("week", new Date());
  if (total === 0) return "";
  const open = !state.weeklyGoalCollapsed;
  return `
    <section class="wl-card">
      <div class="wl-work-head">
        <button class="wl-work-collapse-toggle" data-action="toggleWeeklyGoalCollapse" aria-expanded="${open}">
          <span class="wl-goal-cat-toggle-icon ${open ? "is-expanded" : ""}">${ICONS.chevron}</span>
          <span class="wl-card-title" style="margin-bottom:0">이번 주 목표 <span class="wl-wip-count ${done === total ? "is-full" : ""}">${done}/${total}</span>${done === total ? ` <span class="wl-goal-next-badge">달성</span>` : ""}</span>
        </button>
        ${open ? `<button class="wl-cost-toggle" data-action="switchTab" data-tab="log">기록에서 고치기</button>` : ""}
      </div>
      ${open ? `
        <ul class="wl-goal-list">
          ${items.map((i) => `
            <li class="wl-goal-item ${i.done ? "is-done" : ""}">
              <span class="wl-checkbox ${i.done ? "is-done" : ""}">${i.done ? ICONS.check : ""}</span>
              <span class="wl-goal-item-text">${escapeHtml(i.label)} · <b>${escapeHtml(i.sub)}</b></span>
            </li>`).join("")}
        </ul>` : ""}
    </section>`;
}

function renderTimeBlockColumn(focus = false) {
  const active = state.activeBlock;
  return `
    ${focus ? "" : renderWeeklyGoalCard()}
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
    ${focus ? "" : `
      <section class="wl-card">
        ${renderQueueSection()}
      </section>`}`;
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
            ${latest.image ? `<img src="${latest.image}" class="wl-update-img wl-lightbox-trigger" alt="${escapeAttr(latest.text)}" />` : ""}
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
      <div class="wl-card-title" style="margin-bottom:0">진행 중 <span class="wl-wip-count ${wip.length >= WIP_LIMIT ? "is-full" : ""}">${wip.length}/${WIP_LIMIT}</span>${(() => {
        const g = goalProgress("week", new Date());
        return g.total > 0 ? ` · 이번 주 <span class="wl-wip-count ${g.done === g.total ? "is-full" : ""}">${g.done}/${g.total}</span>` : "";
      })()}</div>
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


// 오늘의 체크. 지정 습관(점수 받는 것)은 점수를 표시하고, 나머지는 기록만.
function renderHabitsCard() {
  const live = activeHabits();
  const retired = retiredHabits();
  const day = todayKey();
  const gained = habitPointsFor(day);
  const allDone = live.length > 0 && live.every((h) => habitDone(h.id, day));
  if (live.length === 0 && retired.length === 0 && !habitEditOpen) {
    return `
      <section class="wl-card">
        <div class="wl-work-head">
          <div class="wl-card-title" style="margin-bottom:0">습관</div>
          <button class="wl-icon-btn" data-action="toggleHabitEdit">${ICONS.plus}</button>
        </div>
        <div class="wl-empty">매일 짧게 하는 일을 여기에. 시간 규칙과 무관하게 체크로 점수를 받습니다.</div>
      </section>`;
  }
  return `
    <section class="wl-card">
      <div class="wl-work-head">
        <div class="wl-card-title" style="margin-bottom:0">습관${live.length > 0 ? ` <span class="wl-wip-count ${allDone ? "is-full" : ""}">오늘 ${gained}점</span>` : ""}</div>
        <button class="wl-icon-btn" data-action="toggleHabitEdit">${habitEditOpen ? ICONS.check : ICONS.pencil}</button>
      </div>
      ${live.length === 0 ? `<div class="wl-empty">진행 중인 습관이 없어요.</div>` : `
        <ul class="wl-habit-list">
          ${live.map((h) => {
            const on = habitDone(h.id, day);
            const cur = habitStreak(h.id);
            const best = habitBestStreak(h.id);
            return `
            <li class="wl-habit-row">
              <button class="wl-checkbox ${on ? "is-done" : ""}" data-action="toggleHabitToday" data-habit="${h.id}">${on ? ICONS.check : ""}</button>
              <div class="wl-habit-body">
                <div class="wl-habit-name ${on ? "is-done" : ""}">${escapeHtml(h.name)}${h.pinned ? ` <span class="wl-habit-pin">1점</span>` : ""}</div>
                <div class="wl-hint">${cur > 0 ? `${cur}일 연속` : "연속 끊김"}${best > 0 ? ` · 최고 ${best}일` : ""}</div>
              </div>
              ${habitEditOpen ? `
                <button class="wl-wip-toggle ${h.pinned ? "is-on" : ""}" data-action="toggleHabitPinned" data-habit="${h.id}" title="점수 지정">${h.pinned ? "지정" : "트래킹"}</button>
                <button class="wl-icon-btn" data-action="retireHabit" data-habit="${h.id}" title="정착시키기">${ICONS.archive}</button>
                <button class="wl-icon-btn" data-action="removeHabit" data-habit="${h.id}">${ICONS.trash}</button>` : ""}
            </li>`;
          }).join("")}
        </ul>
        ${allDone ? `<div class="wl-hint" style="margin-top:8px">오늘 전부 채웠어요 · 보너스 +1점</div>` : ""}`}
      ${habitEditOpen ? `
        <div class="wl-field-row wl-field-row--tight">
          <input class="wl-input wl-input--sm" placeholder="새 습관" data-draft="newHabit" data-enter-action="addHabit" value="${escapeAttr(drafts.newHabit)}" ${live.length >= HABIT_LIST_MAX ? "disabled" : ""} />
          <button class="wl-btn wl-btn--ghost" data-action="addHabit" ${live.length >= HABIT_LIST_MAX ? "disabled" : ""}>${ICONS.plus}</button>
        </div>
        <div class="wl-hint">지정 ${live.filter((h) => h.pinned).length}/${HABIT_PINNED_MAX} · 목록 ${live.length}/${HABIT_LIST_MAX} · 한 번에 하나씩 늘리는 게 자리 잡기 쉬워요</div>` : ""}
      ${retired.length > 0 ? `
        <div class="wl-card-title" style="margin-top:14px">명예의 전당</div>
        <ul class="wl-habit-list">
          ${retired.map((h) => `
            <li class="wl-habit-row is-retired">
              <span class="wl-habit-medal">${ICONS.sparkles}</span>
              <div class="wl-habit-body">
                <div class="wl-habit-name">${escapeHtml(h.name)}</div>
                <div class="wl-hint">최고 ${habitBestStreak(h.id)}일 연속</div>
              </div>
              ${habitEditOpen ? `<button class="wl-wip-toggle" data-action="unretireHabit" data-habit="${h.id}">되돌리기</button>` : ""}
            </li>`).join("")}
        </ul>` : ""}
    </section>`;
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
    ${renderHabitsCard()}
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
        ${[...state.offDayLog].reverse().map((e) => `
          <li class="wl-log-row wl-log-row--save">
            <span class="wl-log-time">${escapeHtml(formatKDate(new Date(e.at)))}</span>
            <span class="wl-log-label">휴무권 사용</span>
            <span class="wl-log-points">-${e.cost}</span>
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

// 물건값이 한 해 실수령의 몇 %인지. 통념상 사치품은 5~10% 선을 넘지 않게
// 잡습니다. 다만 차처럼 필수재는 이 기준이 적용되지 않으므로 색으로 판정하지
// 않고 숫자만 보여줍니다 — 무엇이 사치인지는 사람이 정할 일입니다.
function renderLuxuryRatio(t) {
  const yearly = revenueLast12Months();
  if (yearly <= 0) return "";
  const pct = (t.actualPrice / yearly) * 100;
  // 판정하지 않고 목표 기준과 나란히 놓기만 합니다.
  return `<div class="wl-hint">최근 12개월 실수령 ${formatMoney(yearly)}의 <b>${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%</b> · 목표 기준 ${state.goalRate}%</div>`;
}
function formatMoney(n) {
  const won = Math.round(n);
  if (won >= 100000000) return `${(won / 100000000).toFixed(won % 100000000 === 0 ? 0 : 1)}억원`;
  if (won >= 10000) return `${Math.round(won / 10000).toLocaleString()}만원`;
  return `${won.toLocaleString()}원`;
}

function monthsBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + (td - fd) / 30;
}
// 목표 금액을 작품 개수로 환산합니다. 판매가가 아니라 실수령으로 나눠야
// 정직합니다 — 400만원 작품 하나가 목표를 채우는 건 200만원어치니까요.
function worksNeeded(amount) {
  const perWork = netOf(state.avgWorkPrice);
  if (perWork <= 0 || amount <= 0) return 0;
  return Math.ceil(amount / perWork);
}
function worksNeededText(amount) {
  const n = worksNeeded(amount);
  if (n <= 0) return "";
  return `앞으로 <b>${n.toLocaleString()}개</b> 더 만들면 도달 · ${formatMoney(state.avgWorkPrice)}짜리 기준`;
}
// 필수재는 "얼마를 벌면 살 자격이 되는가"가 아니라 "언제까지 있어야 하는가"라서
// 진행률 바 대신 기한과 그때까지 필요한 월 수입을 보여줍니다.
function renderEssentialTier(t) {
  const need = t.actualPrice;
  const months = t.dueDate ? Math.max(0, Math.round(monthsBetween(todayKey(), t.dueDate))) : null;
  const overdue = t.dueDate && monthsBetween(todayKey(), t.dueDate) <= 0;
  return `
    <div class="wl-goal-next">
      ${t.image ? `<img src="${t.image}" class="wl-goal-next-img wl-lightbox-trigger" alt="${escapeAttr(t.label)}" />` : `<div class="wl-goal-next-img wl-goal-next-img--empty">${ICONS.sparkles}</div>`}
      <div class="wl-goal-next-body">
        <div class="wl-goal-next-label">${escapeHtml(t.label)}<span class="wl-goal-next-badge is-essential">필수</span></div>
        <div class="wl-hint">필요한 돈 ${t.actualPrice.toLocaleString()}원</div>
        ${t.dueDate ? `
          <div class="wl-hint ${overdue ? "wl-tier-pace is-behind" : ""}">${overdue
            ? `${t.dueDate.replace(/-/g, ".")} 기한 지남`
            : `${t.dueDate.replace(/-/g, ".")}까지 ${months > 0 ? `${months}개월` : "한 달 미만"} · 월 <b>${formatMoney(months > 0 ? need / months : need)}</b> 실수령 필요`}</div>`
          : `<div class="wl-hint">기한을 넣으면 월 얼마가 필요한지 계산해요</div>`}
        <div class="wl-hint">${worksNeededText(need)}</div>
      </div>
    </div>`;
}
function renderGoalTierPreview(t, totalRevenue, cat) {
  if (cat && cat.kind === "essential") return renderEssentialTier(t);
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
        ${unlocked ? "" : `<div class="wl-hint">${worksNeededText(t.targetAmount - totalRevenue)}</div>`}
        ${renderLuxuryRatio(t)}
      </div>
    </div>`;
}

function renderCategoryGoalCard(c, totalRevenue) {
  const essential = c.kind === "essential";
  const tiers = c.tiers.slice().sort((a, b) => essential
    ? String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"))
    : a.targetAmount - b.targetAmount);
  const nextTier = essential ? tiers[0] : tiers.find((t) => t.targetAmount > totalRevenue);
  const expanded = !!expandedGoalCats[c.id];
  return `
    <section class="wl-card wl-goal-cat-card">
      <button class="wl-goal-cat-toggle" data-action="toggleGoalCategory" data-cat="${c.id}">
        <span class="wl-goal-cat-name">${escapeHtml(c.name)}${c.kind === "essential" ? `<span class="wl-goal-next-badge is-essential">필수</span>` : ""}</span>
        <span class="wl-goal-cat-toggle-icon ${expanded ? "is-expanded" : ""}">${ICONS.chevron}</span>
      </button>
      ${expanded
        ? (tiers.length > 0
            ? `<div class="wl-goal-tier-list">${tiers.map((t) => renderGoalTierPreview(t, totalRevenue, c)).join("")}</div>`
            : `<div class="wl-empty" style="margin-top:10px">등록된 가격대가 없어요.</div>`)
        : (nextTier ? renderGoalTierPreview(nextTier, totalRevenue, c) : `<div class="wl-empty" style="margin-top:10px">이 카테고리 목표를 모두 달성했어요.</div>`)}
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

// 작업 블록이 돌아가는 동안에는 지금 하는 그것 말고 아무것도 안 보여줍니다.
// 휴식 중에도, 일시정지 중에도 풀어줘요 — 손을 멈춘 김에 다음을 보는 거니까요.
// 탭바는 남겨두니 할일이나 기록은 그대로 갈 수 있고, 홈으로 돌아오면 다시
// 타이머만 보입니다. activeSpend까지 보는 건 안전장치입니다: 원래 둘은 같이
// 돌 수 없지만, 옛 기록에 그런 상태가 남아 있다면 끄기 버튼을 감추면 안 돼요.
function isFocusMode() {
  const a = state.activeBlock;
  return !!(a && a.phase === "work" && !a.pausedAt && !state.activeSpend);
}

function renderDashboard() {
  if (isFocusMode()) {
    return `
      <div class="wl-dashboard-grid wl-dashboard-grid--focus">
        <div class="wl-dash-col">${renderTimeBlockColumn(true)}</div>
      </div>`;
  }
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
// 완성한 뒤에야 팔렸는지 따질 수 있으므로 두 상태를 나눠 둡니다.
// 완성했지만 아직 안 팔린 것들의 예상 실수령 합계가 곧 파이프라인입니다.
// 하위 할일이 남아 있으면 완성이 아닙니다. 버튼을 눌리지 않게 막고
// 몇 개가 남았는지 알려줍니다.
function subtasksLeft(w) {
  return (w.subtasks || []).filter((st) => !st.done).length;
}
function renderSaleRow(w) {
  const draft = drafts.saleAmount[w.id];
  if (w.sale) {
    return `
      <div class="wl-sale is-sold">
        <span>판매됨 · 실수령 <b>${w.sale.amount.toLocaleString()}원</b>
          <span class="wl-hint">${escapeHtml(formatKDate(new Date(w.sale.at)))}</span></span>
        <button class="wl-btn wl-btn--quiet" data-action="unmarkSold" data-work="${w.id}">판매 취소</button>
      </div>`;
  }
  if (!w.completed) {
    const left = subtasksLeft(w);
    return `
      <div class="wl-sale">
        <span class="wl-hint">${left > 0 ? `하위 할일 ${left}개가 남았어요.` : "하위 할일을 다 끝냈어요."}</span>
        <button class="wl-btn wl-btn--ghost" data-action="markCompleted" data-work="${w.id}"${left > 0 ? " disabled" : ""}>${ICONS.check} 완성</button>
      </div>`;
  }
  return `
    <div class="wl-sale">
      <span class="wl-hint">완성 · 판매 대기</span>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--num" placeholder="실수령액" inputmode="numeric"
               data-draft="saleAmount" data-work="${w.id}" data-enter-action="markSold"
               value="${escapeAttr(draft != null ? draft : String(netOf(w.expectedSalePrice)))}" />
        <button class="wl-btn wl-btn--primary" data-action="markSold" data-work="${w.id}">판매됨</button>
      </div>
    </div>`;
}
function savePayoutRate() {
  const v = Number(drafts.payoutRate);
  if (!Number.isFinite(v) || v <= 0 || v > 100) return;
  state.payoutRate = v;
  drafts.payoutRate = null;
  persistAndRender();
}
// 비율을 바꾸면 모든 목표 금액이 따라 움직입니다 — 파생값이니까요.
function saveGoalRate() {
  const v = Number(drafts.goalRate);
  if (!Number.isFinite(v) || v <= 0 || v > 100) return;
  state.goalRate = v;
  state.categories.forEach((c) => c.tiers.forEach((t) => { t.targetAmount = goalTargetFor(t.actualPrice); }));
  drafts.goalRate = null;
  persistAndRender();
}
function saveAvgWorkPrice() {
  const v = Number(drafts.avgWorkPrice);
  if (!Number.isFinite(v) || v <= 0) return;
  state.avgWorkPrice = v;
  drafts.avgWorkPrice = null;
  persistAndRender();
}
// 필수재로 바꾸면 비율로 부풀린 목표 금액을 실제 가격으로 되돌립니다.
function toggleCategoryKind(catId) {
  const c = state.categories.find((x) => x.id === catId);
  if (!c) return;
  c.kind = c.kind === "essential" ? "luxury" : "essential";
  c.tiers.forEach((t) => {
    t.targetAmount = c.kind === "essential" ? t.actualPrice : goalTargetFor(t.actualPrice);
  });
  persistAndRender();
}
function markCompleted(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  if (subtasksLeft(w) > 0) return;
  w.completed = Date.now();
  w.wip = false; // 완성했으면 더는 진행 중이 아닙니다
  persistAndRender();
}
function unmarkCompleted(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w) return;
  w.completed = null;
  persistAndRender();
}
// 판매를 기록하면 그 금액이 그대로 누적 수익 항목이 됩니다 — 목표 진행률은
// 실수령 기준이므로, 판매가가 아니라 손에 들어온 금액이 올라갑니다.
function markSold(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w || w.sale) return;
  const raw = drafts.saleAmount[workId];
  const amount = Math.round(Number(raw != null ? raw : netOf(w.expectedSalePrice)));
  if (!Number.isFinite(amount) || amount <= 0) return;
  const entry = { id: uid(), amount, date: todayKey(), workId: w.id };
  state.revenueLog.unshift(entry);
  w.sale = { amount, at: Date.now(), revenueId: entry.id };
  if (!w.completed) w.completed = Date.now();
  delete drafts.saleAmount[workId];
  persistAndRender();
}
function unmarkSold(workId) {
  const w = state.works.find((x) => x.id === workId);
  if (!w || !w.sale) return;
  if (!window.confirm(`"${w.name}" 판매 기록을 취소할까요?\n누적 수익에서 ${w.sale.amount.toLocaleString()}원이 빠집니다.`)) return;
  state.revenueLog = state.revenueLog.filter((r) => r.id !== w.sale.revenueId);
  w.sale = null;
  persistAndRender();
}

// 판매가에서 실제로 손에 들어오는 금액.
function netOf(amount) {
  return Math.round(amount * (state.payoutRate / 100));
}
// 판매 가능한 작품인지 — 판매예상을 적어둔 것만 판매 대상으로 봅니다.
// 모든 프로젝트가 파는 물건은 아니라서, 없으면 판매 관련 표시를 아예 안 합니다.
function isSellable(w) {
  return w.expectedSalePrice != null;
}
// 최근 12개월 실수령 합계. 월급이 없으면 달력 연도는 1월마다 무너지므로
// 굴러가는 12개월 창으로 봅니다.
function revenueLast12Months() {
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const fromKey = todayKey(from);
  return state.revenueLog
    .filter((r) => r.date >= fromKey)
    .reduce((a, r) => a + r.amount, 0);
}

// 살 만해지는 수입 = 물건값 ÷ 비율. 5%면 물건값의 20배를 벌어야 합니다.
function goalPreviewText(actualPrice, cat) {
  const price = Number(actualPrice);
  const essential = cat && cat.kind === "essential";
  if (!price || price <= 0) {
    return essential
      ? "필요한 돈과 기한을 넣으면 월 얼마가 필요한지 계산해요."
      : `실제 가격을 넣으면 목표 금액이 자동으로 정해져요 (수입의 ${state.goalRate}%).`;
  }
  if (essential) return `${formatMoney(price)} · ${worksNeededText(price)}`;
  return `실제 가격 ${formatMoney(price)} → 누적 수입 <b>${formatMoney(goalTargetFor(price))}</b>을 벌면 살 만해요 · ${worksNeededText(goalTargetFor(price))}`;
}
function updateGoalPreviewFor(catId) {
  const cat = state.categories.find((c) => c.id === catId);
  const el = document.querySelector(`[data-goal-preview="${catId}"]`);
  if (el) el.innerHTML = goalPreviewText((drafts.newTier[catId] || {}).actualPrice, cat);
}
// 입력 중에는 다시 그리지 않고 이 줄만 바꿉니다 — render()는 innerHTML을
// 통째로 갈아끼워서 타이핑 중이면 커서가 날아갑니다.
function goalTargetFor(actualPrice, rate) {
  const r = (rate != null ? rate : state.goalRate) / 100;
  return Math.round((Number(actualPrice) || 0) / r);
}

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
      ${expected != null ? `
        <span>판매예상 <b>${expected.toLocaleString()}원</b></span>
        <span>예상 실수령 <b>${netOf(expected).toLocaleString()}원</b></span>
        <span>남는 돈 <b>${(netOf(expected) - total).toLocaleString()}원</b></span>
      ` : `<span>판매예상 <b>미설정</b></span>`}
    </div>
    ${expected != null && netOf(expected) > 0 ? `
      <div class="wl-hint">재료비가 실수령의 ${Math.round((total / netOf(expected)) * 1000) / 10}% · 실수령률 ${state.payoutRate}% 적용</div>` : ""}
    ${isSellable(w) ? renderSaleRow(w) : ""}
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
            ${w.completed
              // 작품 관리 탭에서는 되돌리기가 주된 동작이라 접힌 영역에 묻지 않습니다.
              ? `<button class="wl-wip-toggle" data-action="unmarkCompleted" data-work="${w.id}" title="할일 관리로 되돌리기">되돌리기</button>`
              : `<button class="wl-wip-toggle ${w.wip ? "is-on" : ""}" data-action="toggleWorkWip" data-work="${w.id}"
                    title="${w.wip ? "대기로 내리기" : "진행 중으로 올리기"}">${w.wip ? "진행 중" : "대기"}</button>`}
            <button class="wl-icon-btn" data-action="editWork" data-work="${w.id}">${ICONS.pencil}</button>
            <button class="wl-icon-btn" data-action="archiveWork" data-work="${w.id}" title="보관">${ICONS.archive}</button>
            <button class="wl-icon-btn" data-action="removeWork" data-work="${w.id}">${ICONS.trash}</button>
          </div>`}
      </div>
      ${w.completed ? "" : `
        <div class="wl-progress">
          <div class="wl-progress-bar"><div class="wl-progress-fill" style="width:${pct}%"></div></div>
          <span class="wl-progress-label">${done}/${total}</span>
        </div>`}
      ${collapsed ? "" : `
        ${w.completed ? "" : `
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
        </div>`}
        ${renderCostSection(w)}
        ${(w.updates || []).length > 0 ? `
          <div class="wl-card-title" style="margin-top:14px">세션 기록</div>
          <ul class="wl-session-log">
            ${w.updates.map((u) => {
              const block = u.blockId ? findBlockById(u.blockId) : null;
              const isEditingMin = !!block && editingBlockId === block.id;
              // 소요시간을 고치는 중이면 닫히면 안 되니 무조건 열어둡니다.
              const open = openUpdateId === u.id || isEditingMin;
              return `
              <li class="wl-session-log-row">
                ${u.image ? `<img src="${u.image}" class="wl-update-img wl-lightbox-trigger" alt="${escapeAttr(u.text)}" />` : ""}
                <div class="wl-session-log-body">
                  <div class="wl-session-log-text">${escapeHtml(u.text)}</div>
                  <div class="wl-session-log-meta">${escapeHtml(formatKDate(new Date(u.at)))} ${formatTime(u.at)}${block ? ` · ${blockMinutes(block)}분` : ""}</div>
                  ${!open ? "" : `
                  <div class="wl-session-log-tools">
                    ${block ? (isEditingMin ? `
                      <div class="wl-session-log-duration is-editing">
                        소요시간
                        <input class="wl-inline-num" data-draft="editBlockMinutes" value="${escapeAttr(editingBlockMinutesDraft)}" inputmode="numeric" data-enter-action="saveEditBlockMinutes" />분
                        <button class="wl-icon-btn" data-action="saveEditBlockMinutes">${ICONS.check}</button>
                        <button class="wl-icon-btn" data-action="cancelEditBlockMinutes">${ICONS.x}</button>
                      </div>` : `
                      <button class="wl-session-log-duration" data-action="editBlockMinutes" data-block="${block.id}">
                        ${ICONS.pencil} 소요시간 수정
                      </button>`) : ""}
                    <label class="wl-session-log-duration">
                      <input type="file" accept="image/*" hidden data-filepick="pickUpdateImage" data-work="${w.id}" data-update="${u.id}" />
                      ${ICONS.image} ${u.image ? "사진 바꾸기" : "사진 추가"}
                    </label>
                    <button class="wl-session-log-duration" data-action="pasteUpdateImage" data-work="${w.id}" data-update="${u.id}">붙여넣기</button>
                    ${u.image ? `<button class="wl-session-log-duration" data-action="removeWorkUpdateImage" data-work="${w.id}" data-update="${u.id}">${ICONS.x} 사진 빼기</button>` : ""}
                    <button class="wl-session-log-duration" data-action="removeWorkUpdate" data-work="${w.id}" data-update="${u.id}">${ICONS.trash} 기록 삭제</button>
                  </div>`}
                </div>
                <button class="wl-icon-btn wl-session-log-more ${open ? "is-open" : ""}" data-action="toggleUpdateTools" data-update="${u.id}" aria-label="${open ? "닫기" : "고치기"}" title="${open ? "닫기" : "고치기"}">⋯</button>
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
  const active = state.works.filter((w) => !w.archived && !w.completed);
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
    </div>`;
}

// 완성한 작품은 할일이 아니라 재고에 가깝습니다. 팔리기 전까지는 손에 남아
// 있는 실물 자산이라, 몇 점이 얼마어치인지 한 줄로 보여줍니다.
function completedWorks() {
  return state.works.filter((w) => !w.archived && w.completed);
}
function renderWorksDone() {
  const done = completedWorks().sort((a, b) => (b.completed || 0) - (a.completed || 0));
  const unsold = done.filter((w) => !w.sale && w.expectedSalePrice != null);
  const sold = done.filter((w) => w.sale);
  const listPrice = unsold.reduce((a, w) => a + w.expectedSalePrice, 0);
  const soldTotal = sold.reduce((a, w) => a + w.sale.amount, 0);
  return `
    <div class="wl-body">
      <section class="wl-card">
        <div class="wl-card-title">실물 자산</div>
        <div class="wl-save-total is-sales">${netOf(listPrice).toLocaleString()}원</div>
        <div class="wl-hint">완성했지만 아직 안 팔린 ${unsold.length}점 · 판매가 합계 ${listPrice.toLocaleString()}원의 실수령 기준</div>
        ${sold.length > 0 ? `<div class="wl-hint" style="margin-top:6px">판매 완료 ${sold.length}점 · 실수령 ${soldTotal.toLocaleString()}원 (누적 수익에 반영됨)</div>` : ""}
      </section>
      ${done.length === 0
        ? `<div class="wl-empty wl-empty--pad">아직 완성한 작품이 없어요. 할일 관리에서 "완성"을 누르면 여기로 옵니다.</div>`
        : done.map(renderWorkManageCard).join("")}
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
    <div class="wl-settings-block">
      <div class="wl-card-title">태그 · 블록 완료 점수</div>
      ${state.tags.length === 0 ? `<div class="wl-empty">등록된 태그가 없어요.</div>` : `<ul class="wl-tag-list">${state.tags.map(renderTagRow).join("")}</ul>`}
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--sm" placeholder="태그 이름" data-draft="newTagName" value="${escapeAttr(drafts.newTagName)}" />
        <input class="wl-input wl-input--num" placeholder="점수" inputmode="numeric" data-draft="newTagPoints" data-enter-action="addTag" value="${escapeAttr(drafts.newTagPoints)}" />
        <button class="wl-btn wl-btn--ghost" data-action="addTag">${ICONS.plus}</button>
      </div>
    </div>`;
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
            <button class="wl-wip-toggle ${c.kind === "essential" ? "is-on" : ""}" data-action="toggleCategoryKind" data-cat="${c.id}"
                    title="${c.kind === "essential" ? "사치품으로 바꾸기" : "필수재로 바꾸기"}">${c.kind === "essential" ? "필수재" : "사치품"}</button>
            <button class="wl-icon-btn" data-action="editCategory" data-cat="${c.id}">${ICONS.pencil}</button>
            <button class="wl-icon-btn" data-action="removeCategory" data-cat="${c.id}">${ICONS.trash}</button>
          </div>`}
      </div>
      <ul class="wl-tiers">${tiers.map((t) => renderTierRow(t, totalRevenue, true, c.id)).join("")}</ul>
      <div class="wl-field-row wl-field-row--tight wl-field-row--wrap">
        <input class="wl-input wl-input--sm" placeholder="가격대 이름" data-draft="tierLabel" data-cat="${c.id}" value="${escapeAttr(draft.label || "")}" />
        <input class="wl-input wl-input--num" placeholder="실제 가격" inputmode="numeric" data-draft="tierActualPrice" data-cat="${c.id}" value="${escapeAttr(draft.actualPrice || "")}" />
        ${c.kind === "essential" ? `<input class="wl-input wl-input--sm" type="date" title="언제까지 필요한가" data-draft="tierDueDate" data-cat="${c.id}" value="${escapeAttr(draft.dueDate || "")}" />` : ""}
        ${renderImagePicker({ value: draft.image || null, pickAction: "pickTierImage", pasteAction: "pasteTierImage", clearAction: "clearTierImage", cat: c.id })}
        <button class="wl-btn wl-btn--ghost" data-action="addTier" data-cat="${c.id}">${draft.editingId ? ICONS.check : ICONS.plus} ${draft.editingId ? "저장" : ""}</button>
        ${draft.editingId ? `<button class="wl-btn wl-btn--ghost" data-action="cancelEditTier" data-cat="${c.id}">${ICONS.x}</button>` : ""}
      </div>
      <div class="wl-hint" data-goal-preview="${c.id}">${goalPreviewText(draft.actualPrice, c)}</div>
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
          <button class="wl-tab ${currentTab === "works-manage" ? "is-active" : ""}" data-action="switchTab" data-tab="works-manage">할일</button>
          <button class="wl-tab ${currentTab === "works-done" ? "is-active" : ""}" data-action="switchTab" data-tab="works-done">작품</button>
          <button class="wl-tab ${currentTab === "goals-manage" ? "is-active" : ""}" data-action="switchTab" data-tab="goals-manage">목표</button>
          <button class="wl-tab ${currentTab === "log" ? "is-active" : ""}" data-action="switchTab" data-tab="log">기록</button>
        </nav>
      </header>
      <div id="wl-save-status" class="wl-savebar"></div>
      ${floatingTimerNote ? `<div class="wl-savebar wl-savebar--error">${escapeHtml(floatingTimerNote)}</div>` : ""}
      ${currentTab === "dashboard" ? renderDashboard()
        : currentTab === "log" ? renderLogView()
        : currentTab === "works-manage" ? renderWorksManage()
        : currentTab === "works-done" ? renderWorksDone()
        : renderGoalsManage()}
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

// 매일 건드릴 값이 아니라 한 번 정해두는 규칙이라, 화면에 늘어놓지 않고
// 설정 안에 둡니다.
function renderRulesSection() {
  return `
    <div class="wl-settings-block">
      <div class="wl-card-title">규칙</div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--num" inputmode="numeric" data-draft="payoutRate" data-enter-action="savePayoutRate" value="${escapeAttr(drafts.payoutRate != null ? drafts.payoutRate : String(state.payoutRate))}" />
        <span class="wl-hint" style="flex:1">% 실수령률 — 판매가에서 실제로 들어오는 비율 (전속 5:5면 50)</span>
        <button class="wl-btn wl-btn--ghost" data-action="savePayoutRate">${ICONS.check}</button>
      </div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--num" inputmode="numeric" data-draft="goalRate" data-enter-action="saveGoalRate" value="${escapeAttr(drafts.goalRate != null ? drafts.goalRate : String(state.goalRate))}" />
        <span class="wl-hint" style="flex:1">% 목표 비율 — 물건값이 수입의 이 비율이면 살 만하다고 봅니다</span>
        <button class="wl-btn wl-btn--ghost" data-action="saveGoalRate">${ICONS.check}</button>
      </div>
      <div class="wl-field-row wl-field-row--tight">
        <input class="wl-input wl-input--num" inputmode="numeric" data-draft="avgWorkPrice" data-enter-action="saveAvgWorkPrice" value="${escapeAttr(drafts.avgWorkPrice != null ? drafts.avgWorkPrice : String(state.avgWorkPrice))}" />
        <span class="wl-hint" style="flex:1">원 평균 작품가 — 목표를 작품 몇 점으로 환산할지의 기준</span>
        <button class="wl-btn wl-btn--ghost" data-action="saveAvgWorkPrice">${ICONS.check}</button>
      </div>
      <div class="wl-hint">${formatMoney(state.avgWorkPrice)}짜리 한 점의 실수령은 ${formatMoney(netOf(state.avgWorkPrice))} · ${formatMoney(1000000)}짜리를 사려면 누적 ${formatMoney(goalTargetFor(1000000))} 필요</div>
    </div>`;
}


// ---- 분석용 내보내기 ----
// state.json에는 이미지가 base64로 박혀 있어 그대로 넘기면 무겁고 쓸모도 없습니다.
// 표로 뽑으면 이미지가 자연히 빠지고, 사람도 도구도 바로 읽습니다.
// 화면에 띄우지 않고 클립보드로만 보냅니다 — 기록은 기록 탭에서 보면 되니까요.
function csvCell(v) {
  const t = String(v == null ? "" : v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function csvRows(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
function buildExport() {
  const hhmm = (ms) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const blocks = [["날짜", "시작", "종료", "분", "점수", "할일", "한일", "평가", "직접입력"]];
  Object.keys(state.blocksByDate).sort().forEach((day) => {
    (state.blocksByDate[day] || []).forEach((b) => {
      blockSegments(b).filter((sg) => sg.minutes > 0).forEach((sg, i) => {
        blocks.push([
          day, i === 0 ? hhmm(blockStartedAt(b)) : "", i === 0 ? hhmm(b.completedAt) : "",
          sg.minutes, i === 0 ? blockPoints(b) : "",
          sg.workId ? workName(sg.workId) : "연결 없음", sg.task || "",
          (SESSION_RATINGS.find((r) => r.id === b.rating) || {}).label || "",
          b.manual ? "예" : "",
        ]);
      });
    });
  });
  const spends = [["날짜", "항목", "점수"]];
  Object.keys(state.spendsByDate).sort().forEach((day) => {
    (state.spendsByDate[day] || []).forEach((sp) => spends.push([day, sp.label, sp.cost]));
  });
  const habits = [["날짜", "습관", "지정"]];
  Object.keys(state.habitLog).sort().forEach((day) => {
    (state.habitLog[day] || []).forEach((id) => {
      const h = state.habits.find((x) => x.id === id);
      habits.push([day, h ? h.name : id, h && h.pinned ? "예" : ""]);
    });
  });
  const works = [["할일", "태그", "상태", "판매예상", "실수령예상", "쓴비용", "판매됨"]];
  state.works.forEach((w) => {
    const tag = w.tagId ? (state.tags.find((t) => t.id === w.tagId) || {}).name : "";
    works.push([
      w.name, tag || "",
      w.archived ? "보관" : w.completed ? "완성" : w.wip ? "진행 중" : "대기",
      w.expectedSalePrice != null ? w.expectedSalePrice : "",
      w.expectedSalePrice != null ? netOf(w.expectedSalePrice) : "",
      workCostTotal(w), w.sale ? w.sale.amount : "",
    ]);
  });
  return [
    `# 작업 장부 내보내기 ${todayKey()}`,
    `# 실수령률 ${state.payoutRate}% · 목표 비율 ${state.goalRate}% · 평균 작품가 ${state.avgWorkPrice}`,
    "", "## 블록", csvRows(blocks),
    "", "## 소비", csvRows(spends),
    "", "## 습관", csvRows(habits),
    "", "## 할일", csvRows(works),
  ].join("\n");
}
async function copyExport() {
  const text = buildExport();
  try {
    await navigator.clipboard.writeText(text);
    exportMsg = `복사했어요 (${text.split("\n").length}줄). 붙여넣어서 분석을 맡기면 됩니다.`;
  } catch (e) {
    // 클립보드가 막힌 경우에만 최후 수단으로 화면에 띄웁니다.
    exportMsg = "복사에 실패했어요. 브라우저에서 클립보드 권한을 확인해주세요.";
  }
  render();
  setTimeout(() => { exportMsg = ""; render(); }, 4000);
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


// ---- 기록 보기: 주별 / 월별 ----
// 대시보드는 "오늘"만 다루고, 지난 기록은 이 오버레이에서 봅니다.
function dateFromKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// 주는 월요일 시작.
function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; }
// 지금 보고 있는 기간의 시작/끝(포함)과 제목.
function logRange() {
  const base = logAnchor ? dateFromKey(logAnchor) : new Date();
  if (logScale === "month") {
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    const to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { from, to, title: `${from.getFullYear()}년 ${from.getMonth() + 1}월` };
  }
  const from = startOfWeek(base);
  const to = addDays(from, 6);
  const label = `${from.getMonth() + 1}.${from.getDate()} – ${to.getMonth() + 1}.${to.getDate()}`;
  return { from, to, title: label };
}
function keysBetween(from, to) {
  const out = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) out.push(todayKey(d));
  return out;
}
// 한 기간의 합계. 프로젝트별 시간은 세그먼트 단위로 나눠 담습니다.
function summarize(keys) {
  let points = 0, spent = 0, minutes = 0, blocks = 0;
  const byWork = {};
  keys.forEach((k) => {
    (state.blocksByDate[k] || []).forEach((b) => {
      points += blockPoints(b);
      const mins = blockMinutes(b);
      if (mins > 0) blocks += 1;
      minutes += mins;
      blockSegments(b).forEach((sg) => {
        if (!(sg.minutes > 0)) return;
        const id = sg.workId || "__none";
        byWork[id] = (byWork[id] || 0) + sg.minutes;
      });
    });
    (state.spendsByDate[k] || []).forEach((sp) => { spent += sp.cost; });
    points += habitPointsFor(k);
  });
  return { points, spent, minutes, blocks, byWork };
}
function shiftLog(dir) {
  const base = logAnchor ? dateFromKey(logAnchor) : new Date();
  const next = logScale === "month" ? addMonths(base, dir) : addDays(base, dir * 7);
  goalPickerOpen = false;
  logAnchor = todayKey(next);
  render();
}
function setLogScale(scale) {
  goalPickerOpen = false;
  logScale = scale;
  logAnchor = null; // 눈금을 바꾸면 이번 주/이번 달로 돌아옵니다
  render();
}

// 단일 계열 막대. 축이 하나뿐이라 범례가 필요 없고, 제목이 무엇인지 말해줍니다.
function renderLogBars(items, unitLabel) {
  const max = items.reduce((a, x) => Math.max(a, x.value), 0);
  if (max <= 0) return `<div class="wl-empty">이 기간에는 기록이 없어요.</div>`;
  return `
    <div class="wl-logbars">
      ${items.map((it) => `
        <div class="wl-logbar ${it.today ? "is-today" : ""}">
          <span class="wl-logbar-label">${escapeHtml(it.label)}</span>
          <span class="wl-logbar-track">
            <span class="wl-logbar-fill" style="width:${Math.round((it.value / max) * 100)}%"></span>
          </span>
          <span class="wl-logbar-value">${it.value > 0 ? `${it.value}${unitLabel}` : ""}</span>
        </div>`).join("")}
    </div>`;
}

// ---- 주간 / 월간 목표 ----
// 수량 목표가 아니라 "이번 주엔 여기까지" 라는 범위 약속입니다. 새로 적는 게
// 아니라 이미 있는 하위 할일(주간)과 작품(월간) 중에서 고르는 것이고, 달성
// 여부는 저장하지 않습니다 — 원래 쓰던 체크박스에서 그때그때 읽습니다.
// 그래야 같은 걸 두 군데서 관리하지 않게 됩니다.
const GOAL_PICK_MAX = 5;
function weekKeyOf(d) { return todayKey(startOfWeek(d)); }
function monthKeyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function goalBucket(scale, date) {
  return scale === "month" ? state.monthlyGoals : state.weeklyGoals;
}
function goalKeyFor(scale, date) {
  return scale === "month" ? monthKeyOf(date) : weekKeyOf(date);
}
function goalPicks(scale, date) {
  return goalBucket(scale)[goalKeyFor(scale, date)] || [];
}
// 고른 항목 하나를 풀어 이름과 달성 여부를 알아냅니다. 대상이 지워졌으면 null.
function resolveGoalPick(scale, pick) {
  if (scale === "month") {
    const w = state.works.find((x) => x.id === pick);
    if (!w) return null;
    return { label: w.name, sub: "완성", done: !!w.completed };
  }
  const [workId, subId] = pick.split(":");
  const w = state.works.find((x) => x.id === workId);
  const st = w && (w.subtasks || []).find((x) => x.id === subId);
  if (!w || !st) return null;
  return { label: w.name, sub: st.name, done: !!st.done };
}
function goalProgress(scale, date) {
  const items = goalPicks(scale, date).map((p) => resolveGoalPick(scale, p)).filter(Boolean);
  return { total: items.length, done: items.filter((i) => i.done).length, items };
}
// 한도는 "아직 안 끝낸 것"만 셉니다. 끝낸 것까지 세면 화요일에 다섯 개를
// 마쳤을 때 남은 닷새 동안 아무것도 더 못 넣게 되고, 목표가 하한이 아니라
// 상한으로 작동합니다.
function openPickCount(scale, list) {
  return list.filter((p) => {
    const r = resolveGoalPick(scale, p);
    return r && !r.done;
  }).length;
}
function toggleGoalPick(scale, pick) {
  const key = goalKeyFor(scale, new Date());
  const bucket = goalBucket(scale);
  const list = bucket[key] || [];
  if (list.includes(pick)) bucket[key] = list.filter((x) => x !== pick);
  else {
    if (openPickCount(scale, list) >= GOAL_PICK_MAX) return;
    bucket[key] = [...list, pick];
  }
  if (bucket[key].length === 0) delete bucket[key];
  persistAndRender();
}
function toggleGoalPicker() { goalPickerOpen = !goalPickerOpen; render(); }
// 지난 기간에 못 지킨 것들. 새 기간은 빈 목록으로 시작하되, 다시 넣기는
// 한 번에 되게 해둡니다 — 자동 이월은 몇 주째 남는 죽은 목록이 됩니다.
function unmetLastPeriod(scale) {
  const prev = scale === "month" ? addMonths(new Date(), -1) : addDays(new Date(), -7);
  return goalProgress(scale, prev).items.filter((i) => !i.done);
}
function carryOverGoals(scale) {
  const prev = scale === "month" ? addMonths(new Date(), -1) : addDays(new Date(), -7);
  const keep = goalPicks(scale, prev).filter((p) => {
    const r = resolveGoalPick(scale, p);
    return r && !r.done;
  });
  if (keep.length === 0) return;
  goalBucket(scale)[goalKeyFor(scale, new Date())] = keep.slice(0, GOAL_PICK_MAX);
  persistAndRender();
}
// 최근 4주(이번 주 제외) 평균 적립 — 목표를 정하지 않아도 페이스가 보입니다.
function recentWeeklyAverage() {
  const weeks = [];
  for (let i = 1; i <= 4; i++) {
    const from = startOfWeek(addDays(new Date(), -7 * i));
    const keys = keysBetween(from, addDays(from, 6));
    if (keys.some((k) => (state.blocksByDate[k] || []).length > 0)) {
      weeks.push(summarize(keys).points);
    }
  }
  if (weeks.length === 0) return null;
  return Math.round(weeks.reduce((a, x) => a + x, 0) / weeks.length);
}


function renderGoalPicker(scale) {
  const picks = goalPicks(scale, new Date());
  const works = state.works.filter((w) => !w.archived);
  // 월간은 작품 하나가 곧 한 줄이라 묶음 머리가 필요 없고, 줄에 작품 이름이
  // 와야 무엇을 고르는지 보입니다. 주간은 프로젝트로 묶고 줄엔 하위 할일 이름.
  const rows = scale === "month"
    ? works.filter((w) => !w.completed).map((w) => ({ pick: w.id, group: null, name: w.name }))
    : works.flatMap((w) => (w.subtasks || []).filter((st) => !st.done)
        .map((st) => ({ pick: `${w.id}:${st.id}`, group: w.name, name: st.name })));
  if (rows.length === 0) {
    return `<div class="wl-empty">고를 ${scale === "month" ? "작품" : "하위 할일"}이 없어요.</div>`;
  }
  let lastLabel = null;
  return `
    <div class="wl-goalpick">
      <div class="wl-hint">진행 중 ${openPickCount(scale, picks)}개 · 한 번에 ${GOAL_PICK_MAX}개까지 (끝낸 건 안 셈)</div>
      ${rows.map((r) => {
        const head = r.group && r.group !== lastLabel ? `<div class="wl-goalpick-work">${escapeHtml(r.group)}</div>` : "";
        lastLabel = r.group;
        const on = picks.includes(r.pick);
        const full = !on && openPickCount(scale, picks) >= GOAL_PICK_MAX;
        return `${head}
          <button class="wl-goalpick-row ${on ? "is-on" : ""}" data-action="toggleGoalPick" data-scale="${scale}" data-pick="${escapeAttr(r.pick)}"${full ? " disabled" : ""}>
            <span class="wl-checkbox ${on ? "is-done" : ""}">${on ? ICONS.check : ""}</span>
            <span class="wl-goalpick-name">${escapeHtml(r.name)}</span>
          </button>`;
      }).join("")}
    </div>`;
}
// 지난 기간은 결과만 보여줍니다 — 지나간 주의 약속을 고쳐 쓸 일은 없으니까요.
function renderPeriodGoals(scale, isCurrent) {
  const when = logAnchor ? dateFromKey(logAnchor) : new Date();
  const { total, done, items } = goalProgress(scale, when);
  const unit = scale === "month" ? "이번 달" : "이번 주";
  const carry = isCurrent && total === 0 ? unmetLastPeriod(scale) : [];
  return `
    <section class="wl-card">
      <div class="wl-work-head">
        <div class="wl-card-title" style="margin-bottom:0">${isCurrent ? unit : (scale === "month" ? "그 달" : "그 주")} 목표${total > 0 ? ` <span class="wl-wip-count ${done === total ? "is-full" : ""}">${done}/${total}</span>` : ""}${total > 0 && done === total ? ` <span class="wl-goal-next-badge">달성</span>` : ""}</div>
        ${isCurrent ? `<button class="wl-cost-toggle" data-action="toggleGoalPicker">${goalPickerOpen ? "닫기" : (total === 0 ? "고르기" : (done === total ? "더 넣기" : "고치기"))}</button>` : ""}
      </div>
      ${total === 0 && !goalPickerOpen
        ? `<div class="wl-empty">${isCurrent ? "아직 정하지 않았어요." : "정해둔 목표가 없었어요."}</div>`
        + (isCurrent && goalPickerOpen ? "" : "")
        : `<ul class="wl-goal-list">
            ${items.map((i) => `
              <li class="wl-goal-item ${i.done ? "is-done" : ""}">
                <span class="wl-checkbox ${i.done ? "is-done" : ""}">${i.done ? ICONS.check : ""}</span>
                <span class="wl-goal-item-text">${escapeHtml(i.label)} · <b>${escapeHtml(i.sub)}</b></span>
              </li>`).join("")}
          </ul>`}
      ${isCurrent && total > 0 && done === total && !goalPickerOpen
        ? `<div class="wl-hint" style="margin-top:8px">이번 ${scale === "month" ? "달" : "주"}치는 다 끝냈어요. 더 하고 싶으면 "더 넣기"로 이어가면 됩니다.</div>` : ""}
      ${carry.length > 0 ? `
        <button class="wl-cost-toggle" data-action="carryOverGoals" data-scale="${scale}">
          ${ICONS.plus} 지난 ${scale === "month" ? "달" : "주"} 미달성 ${carry.length}개 다시 넣기
        </button>` : ""}
      ${isCurrent && goalPickerOpen ? renderGoalPicker(scale) : ""}
    </section>`;
}

function renderLogView() {
  const { from, to, title } = logRange();
  const keys = keysBetween(from, to);
  const sum = summarize(keys);
  const today = todayKey();
  const isMonth = logScale === "month";
  const isCurrentPeriod = goalKeyFor(logScale, from) === goalKeyFor(logScale, new Date());

  // 주간은 하루씩, 월간은 주 단위로 묶습니다 — 31개 막대는 읽히지 않습니다.
  let bars;
  if (isMonth) {
    const weeks = [];
    for (let d = startOfWeek(from); d <= to; d = addDays(d, 7)) {
      const wk = keysBetween(d, addDays(d, 6)).filter((k) => keys.includes(k));
      if (wk.length === 0) continue;
      // 그 주에서 이 달에 속하는 부분만 라벨에 씁니다 — 8월을 보는데 7.27이
      // 적혀 있으면 어느 달을 재고 있는지 헷갈립니다.
      const head = dateFromKey(wk[0]);
      const s = summarize(wk);
      weeks.push({ label: `${head.getMonth() + 1}.${head.getDate()}~`, value: Math.round(s.minutes / 60 * 10) / 10, today: wk.includes(today) });
    }
    bars = renderLogBars(weeks, "시간");
  } else {
    const names = ["월", "화", "수", "목", "금", "토", "일"];
    bars = renderLogBars(keys.map((k, i) => ({
      label: `${names[i]} ${dateFromKey(k).getDate()}`,
      value: summarize([k]).minutes,
      today: k === today,
    })), "분");
  }

  const works = Object.entries(sum.byWork).sort((a, b) => b[1] - a[1]);
  const workMax = works.length ? works[0][1] : 0;

  return `
    <div class="wl-body wl-logbody">
      <div class="wl-log-side">
      <section class="wl-card">
        <div class="wl-log-scale">
          <button class="wl-tab ${!isMonth ? "is-active" : ""}" data-action="setLogScale" data-scale="week">주간</button>
          <button class="wl-tab ${isMonth ? "is-active" : ""}" data-action="setLogScale" data-scale="month">월간</button>
        </div>
        <div class="wl-log-nav">
          <button class="wl-icon-btn" data-action="shiftLog" data-dir="-1">${ICONS.chevron}</button>
          <span class="wl-log-period">${escapeHtml(title)}</span>
          <button class="wl-icon-btn" data-action="shiftLog" data-dir="1"${to >= new Date() ? " disabled" : ""}>${ICONS.chevron}</button>
        </div>

        <div class="wl-ledger-strip">
          <div class="wl-figure"><div class="wl-figure-label">적립</div><div class="wl-figure-value is-work">${sum.points}</div></div>
          <div class="wl-figure"><div class="wl-figure-label">사용</div><div class="wl-figure-value is-spend">${sum.spent}</div></div>
          <div class="wl-figure"><div class="wl-figure-label">작업</div><div class="wl-figure-value">${formatMinutes(sum.minutes)}</div></div>
          <div class="wl-figure"><div class="wl-figure-label">블록</div><div class="wl-figure-value">${sum.blocks}</div></div>
        </div>
        ${(() => {
          if (isMonth) return "";
          const avg = recentWeeklyAverage();
          if (avg == null) return `<div class="wl-hint" style="margin-top:8px">몇 주 쌓이면 지난 평균과 비교해서 보여줄게요.</div>`;
          const diff = sum.points - avg;
          return `<div class="wl-hint" style="margin-top:8px">지난 4주 평균 <b>${avg}점</b>${diff === 0 ? " · 같은 페이스" : ` · ${diff > 0 ? "+" : ""}${diff}점`}</div>`;
        })()}
      </section>

      ${renderPeriodGoals(logScale, isCurrentPeriod)}

      <section class="wl-card">
        <div class="wl-card-title">${isMonth ? "주별 작업 시간" : "일별 작업 시간"}</div>
        ${bars}
      </section>

      ${(() => {
        const live = activeHabits();
        if (live.length === 0) return "";
        const span = keys.length;
        return `
        <section class="wl-card">
          <div class="wl-card-title">습관</div>
          <div class="wl-logbars">
            ${live.map((h) => {
              const n = habitCountBetween(h.id, keys);
              return `
              <div class="wl-logbar">
                <span class="wl-logbar-label is-wide">${escapeHtml(h.name)}</span>
                <span class="wl-logbar-track"><span class="wl-logbar-fill" style="width:${Math.round((n / span) * 100)}%"></span></span>
                <span class="wl-logbar-value">${n}/${span}일</span>
              </div>`;
            }).join("")}
          </div>
        </section>`;
      })()}

      <section class="wl-card">
        <div class="wl-card-title">프로젝트별 시간</div>
          ${works.length === 0 ? `<div class="wl-empty">이 기간에는 기록이 없어요.</div>` : `
            <div class="wl-logbars">
              ${works.map(([id, mins]) => `
                <div class="wl-logbar">
                  <span class="wl-logbar-label is-wide">${escapeHtml(id === "__none" ? "연결 없음" : workName(id))}</span>
                  <span class="wl-logbar-track"><span class="wl-logbar-fill" style="width:${Math.round((mins / workMax) * 100)}%"></span></span>
                  <span class="wl-logbar-value">${formatMinutes(mins)}</span>
                </div>`).join("")}
            </div>`}
      </section>

      </div>
      ${isMonth ? "" : `
        <div class="wl-log-side">
        <section class="wl-card">
          <div class="wl-card-title">블록</div>
            ${keys.every((k) => (state.blocksByDate[k] || []).length === 0)
              ? `<div class="wl-empty">이 주에는 기록이 없어요.</div>`
              : keys.map((k) => {
                  const rows = (state.blocksByDate[k] || []).filter((b) => blockMinutes(b) > 0);
                  if (rows.length === 0) return "";
                  return `
                    <div class="wl-log-day">
                      <div class="wl-hint">${escapeHtml(formatKDate(dateFromKey(k)))}</div>
                      <ul class="wl-log">${rows.map(renderBlockLogRow).join("")}</ul>
                    </div>`;
                }).join("")}
        </section>
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
        <div class="wl-settings-head">
          <div class="wl-settings-title">GitHub 연결 설정</div>
          ${canClose ? `<button class="wl-icon-btn wl-settings-close" data-action="closeSettings" aria-label="닫기" title="닫기">${ICONS.x}</button>` : ""}
        </div>
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
          ${state ? `
            <div class="wl-settings-block">
              <div class="wl-card-title">분석용 내보내기</div>
              <div class="wl-hint">블록 · 소비 · 습관 · 할일을 표로 만들어 클립보드에 복사합니다. 이미지는 빠집니다.</div>
              <div class="wl-settings-actions" style="margin-top:10px">
                <button class="wl-btn wl-btn--ghost" data-action="copyExport">${ICONS.check} 기록 복사</button>
              </div>
              ${exportMsg ? `<div class="wl-hint" style="margin-top:8px">${escapeHtml(exportMsg)}</div>` : ""}
            </div>` : ""}
          ${state ? renderRulesSection() : ""}
          ${state ? renderTagManageSection() : ""}
          <div class="wl-settings-block">
            <div class="wl-settings-label">연결 해제</div>
            <div class="wl-hint">이 브라우저에 저장된 토큰과 저장소 정보만 지웁니다. 기록은 저장소에 그대로 남아요.</div>
            <div class="wl-settings-actions">
              <button class="wl-btn wl-btn--ghost" data-action="logout">로그아웃</button>
            </div>
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
    case "setLogScale": setLogScale(ds.scale); break;
    case "toggleHabitEdit": habitEditOpen = !habitEditOpen; render(); break;
    case "toggleHabitToday": toggleHabitToday(ds.habit); break;
    case "toggleHabitPinned": toggleHabitPinned(ds.habit); break;
    case "addHabit": addHabit(); break;
    case "retireHabit": retireHabit(ds.habit); break;
    case "unretireHabit": unretireHabit(ds.habit); break;
    case "removeHabit": removeHabit(ds.habit); break;
    case "copyExport": copyExport(); break;
    case "toggleGoalPicker": toggleGoalPicker(); break;
    case "toggleGoalPick": toggleGoalPick(ds.scale, ds.pick); break;
    case "carryOverGoals": carryOverGoals(ds.scale); break;
    case "shiftLog": shiftLog(Number(ds.dir)); break;
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
    case "toggleWeeklyGoalCollapse": toggleWeeklyGoalCollapse(); break;
    case "toggleAllWorkCollapse": toggleAllWorkCollapse(); break;
    case "archiveWork": archiveWork(ds.work); break;
    case "toggleWorkWip": toggleWorkWip(ds.work); break;
    case "savePayoutRate": savePayoutRate(); break;
    case "saveGoalRate": saveGoalRate(); break;
    case "saveAvgWorkPrice": saveAvgWorkPrice(); break;
    case "toggleCategoryKind": toggleCategoryKind(ds.cat); break;
    case "markCompleted": markCompleted(ds.work); break;
    case "unmarkCompleted": unmarkCompleted(ds.work); break;
    case "markSold": markSold(ds.work); break;
    case "unmarkSold": unmarkSold(ds.work); break;
    case "unarchiveWork": unarchiveWork(ds.work); break;
    case "toggleArchiveSection": toggleArchiveSection(); break;
    case "addSubtask": addSubtask(ds.work); break;
    case "toggleSubtask": toggleSubtask(ds.work, ds.sub); break;
    case "removeSubtask": removeSubtask(ds.work, ds.sub); break;
    case "addWorkCost": addWorkCost(ds.work); break;
    case "removeWorkCost": removeWorkCost(ds.work, ds.cost); break;
    case "removeWorkUpdate": removeWorkUpdate(ds.work, ds.update); break;
    case "toggleUpdateTools":
      openUpdateId = openUpdateId === ds.update ? null : ds.update;
      editingBlockId = null;   // 다른 줄을 열면 고치던 소요시간은 접습니다
      render();
      break;
    case "removeWorkUpdateImage": removeWorkUpdateImage(ds.work, ds.update); break;
    case "pasteUpdateImage":
      pasteImageInto((url) => setWorkUpdateImage(ds.work, ds.update, url));
      break;
    case "editBlockMinutes": startEditBlockMinutes(ds.block); break;
    case "saveEditBlockMinutes": saveEditBlockMinutes(); break;
    case "cancelEditBlockMinutes": cancelEditBlockMinutes(); break;
    case "toggleCostForm": toggleCostForm(ds.work); break;
    case "clearPendingUpdateImage": drafts.pendingUpdate.image = null; render(); break;
    case "pastePendingUpdateImage":
      pasteImageInto((url) => { drafts.pendingUpdate.image = url; render(); });
      break;
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
    case "pasteTierImage":
      pasteImageInto((url) => {
        drafts.newTier[ds.cat] = { ...(drafts.newTier[ds.cat] || {}), image: url };
        render();
      });
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
  // 설정 패널 바깥의 어두운 곳을 누르면 닫힙니다. target을 직접 확인하는 이유는
  // 패널 안 빈 곳을 눌렀을 때까지 닫히면 곤란해서예요.
  if (e.target.classList && e.target.classList.contains("wl-settings-overlay")) {
    closeSettings();
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
    case "saleAmount": drafts.saleAmount[el.dataset.work] = clampNumeric(); break;
    case "payoutRate": drafts.payoutRate = clampNumeric(); break;
    case "goalRate": drafts.goalRate = clampNumeric(); break;
    case "avgWorkPrice": drafts.avgWorkPrice = clampNumeric(); break;
    case "newHabit": drafts.newHabit = value; break;
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
    case "tierDueDate": {
      const catId = el.dataset.cat;
      drafts.newTier[catId] = { ...(drafts.newTier[catId] || {}), dueDate: value };
      break;
    }
    case "tierActualPrice": {
      const catId = el.dataset.cat;
      drafts.newTier[catId] = { ...(drafts.newTier[catId] || {}), actualPrice: clampNumeric() };
      updateGoalPreviewFor(catId);
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
      } else if (action === "pickUpdateImage") {
        // 이미 저장된 기록이라 초안이 아니라 바로 씁니다.
        setWorkUpdateImage(filePick.dataset.work, filePick.dataset.update, dataUrl);
        return;
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
  // Esc로도 설정 패널을 닫습니다. 입력칸에 포커스가 있어도 동작해야 해서
  // root가 아니라 document에 답니다.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && settingsOpen) closeSettings();
  });
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
