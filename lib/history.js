const fs = require('fs');
const path = require('path');

const HISTORY_PATH = path.join(__dirname, '..', 'history.json');

function load() {
  if (fs.existsSync(HISTORY_PATH)) {
    try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')); }
    catch { return []; }
  }
  return [];
}

function save(records) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(records, null, 2));
}

function add(record) {
  const records = load();
  record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  record.createdAt = new Date().toISOString();
  records.unshift(record);
  if (records.length > 100) records.length = 100;
  save(records);
  return record;
}

function update(id, updates) {
  const records = load();
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  Object.assign(records[idx], updates, { updatedAt: new Date().toISOString() });
  save(records);
  return records[idx];
}

function list() {
  return load().map(r => ({
    id: r.id,
    topic: r.topic,
    mode: r.mode,
    round: r.round,
    maxRounds: r.maxRounds,
    personaNames: r.personaNames || [],
    messageCount: (r.messages || []).length,
    createdAt: r.createdAt
  }));
}

function get(id) {
  return load().find(r => r.id === id) || null;
}

function remove(id) {
  const records = load().filter(r => r.id !== id);
  save(records);
}

module.exports = { add, update, list, get, remove };
