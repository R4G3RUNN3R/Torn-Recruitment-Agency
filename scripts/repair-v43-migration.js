const fs = require('node:fs');
const file = 'scripts/apply-v43-global.js';
let s = fs.readFileSync(file, 'utf8');
const replacements = [
  ['`User ${userId}`', '"User " + userId'],
  ['`Global service HTTP ${response.status}`', '"Global service HTTP " + response.status'],
  ['`${playerId}:${observedAt}`', 'String(playerId) + ":" + String(observedAt)'],
  ['`${userId}:${observedAt}`', 'String(userId) + ":" + String(observedAt)'],
  ['`${endpoint}${join}action=player&id=${encodeURIComponent(id)}`', 'endpoint + join + "action=player&id=" + encodeURIComponent(id)'],
  ['`${endpoint}${join}action=meta`', 'endpoint + join + "action=meta"'],
  ['`Global service error: ${normalized.code || "unknown"}`', '"Global service error: " + (normalized.code || "unknown")'],
  ['`Schema mismatch: service ${normalized.schemaVersion}, client ${GlobalCore.GLOBAL_SCHEMA_VERSION}`', '"Schema mismatch: service " + normalized.schemaVersion + ", client " + GlobalCore.GLOBAL_SCHEMA_VERSION'],
  ['`Connected · service ${normalized.serviceVersion || "unknown"}`', '"Connected · service " + (normalized.serviceVersion || "unknown")'],
  ['`Enabled · ${pending} queued`', '"Enabled · " + pending + " queued"'],
  ['` · ${pending} queued`', '" · " + pending + " queued"']
];
for (const [from, to] of replacements) s = s.split(from).join(to);
fs.writeFileSync(file, s);
console.log('Repaired v4.3 migration template quoting.');
