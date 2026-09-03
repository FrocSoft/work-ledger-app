// GitHub Contents API wrapper — stores/reads the ledger's state.json in a
// private data repo. Credentials (PAT + repo coordinates) live only in
// localStorage; nothing here is hardcoded.

const LS_KEYS = {
  token: "workLedger.ghToken",
  owner: "workLedger.ghOwner",
  repo: "workLedger.ghRepo",
  branch: "workLedger.ghBranch",
  path: "workLedger.ghPath",
};

export function getCredentials() {
  return {
    token: localStorage.getItem(LS_KEYS.token) || "",
    owner: localStorage.getItem(LS_KEYS.owner) || "",
    repo: localStorage.getItem(LS_KEYS.repo) || "",
    branch: localStorage.getItem(LS_KEYS.branch) || "main",
    path: localStorage.getItem(LS_KEYS.path) || "state.json",
  };
}

export function saveCredentials(creds) {
  localStorage.setItem(LS_KEYS.token, (creds.token || "").trim());
  localStorage.setItem(LS_KEYS.owner, (creds.owner || "").trim());
  localStorage.setItem(LS_KEYS.repo, (creds.repo || "").trim());
  localStorage.setItem(LS_KEYS.branch, (creds.branch || "main").trim());
  localStorage.setItem(LS_KEYS.path, (creds.path || "state.json").trim());
}

export function clearCredentials() {
  Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
}

export function hasCredentials() {
  const c = getCredentials();
  return Boolean(c.token && c.owner && c.repo);
}

const API_BASE = "https://api.github.com";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function testConnection(creds) {
  try {
    const res = await fetch(`${API_BASE}/repos/${creds.owner}/${creds.repo}`, {
      headers: authHeaders(creds.token),
    });
    if (res.status === 200) return { ok: true };
    if (res.status === 404) return { ok: false, reason: "notfound" };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "auth" };
    return { ok: false, reason: "unknown", status: res.status };
  } catch (e) {
    return { ok: false, reason: "network" };
  }
}

// Reads state.json. Returns { data: null, sha: null } if the file doesn't
// exist yet (first run) — the caller falls back to defaults.
export async function fetchState() {
  const { token, owner, repo, branch, path } = getCredentials();
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: authHeaders(token) }
  );
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const json = await res.json();
  return { data: JSON.parse(base64ToUtf8(json.content)), sha: json.sha };
}

// Writes state.json. On a sha conflict (someone/something else wrote in
// the meantime) it refetches the current sha and retries once, last-write-wins —
// acceptable for a single-user tool.
export async function writeState(stateObj, sha) {
  const { token, owner, repo, branch, path } = getCredentials();
  const content = utf8ToBase64(JSON.stringify(stateObj));
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const doPut = async (withSha) => {
    const body = { message: `Update ledger state ${new Date().toISOString()}`, content, branch };
    if (withSha) body.sha = withSha;
    return fetch(url, {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  let res = await doPut(sha);
  if (res.status === 409 || res.status === 422) {
    const latest = await fetchState();
    res = await doPut(latest.sha || undefined);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`GitHub write failed: ${res.status} ${errText}`);
  }
  const json = await res.json();
  return json.content.sha;
}
