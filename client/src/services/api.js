const API_BASE = "/api";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getConfig: () => request("/config"),
  saveConfig: (config) => request("/config", { method: "POST", body: JSON.stringify(config) }),
  updateApiKey: (providerId, apiKey) => request("/config/apikey", { method: "POST", body: JSON.stringify({ providerId, apiKey }) }),
  testConnection: (providerId) => request("/test-connection", { method: "POST", body: JSON.stringify({ providerId }) }),
  getSession: () => request("/session"),
  initSession: (data) => request("/session/init", { method: "POST", body: JSON.stringify(data) }),
  startAuto: () => request("/brainstorm/start-auto", { method: "POST" }),
  startHumanRound: () => request("/brainstorm/start-human-round", { method: "POST" }),
  stopDebate: () => request("/brainstorm/stop", { method: "POST" }),
  resumeAuto: () => request("/brainstorm/resume-auto", { method: "POST" }),
  updateMindmap: () => request("/brainstorm/mindmap", { method: "POST" }),
  getHistory: () => request("/history"),
  getHistoryItem: (id) => request(`/history/${id}`),
  deleteHistory: (id) => request(`/history/${id}`, { method: "DELETE" }),
  loadHistory: (id) => request(`/history/load/${id}`, { method: "POST" }),
};
