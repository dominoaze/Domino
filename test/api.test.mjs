import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const G = { 'x-group-key': 'test-group' }, A = { 'x-admin-key': 'test-admin' };
const call = (path, { method = 'GET', headers = G, body } = {}) =>
  fetch(BASE + path, { method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
const state = async () => (await call('/api/state')).json();
const ids = {};

test('1. açarsız və yanlış açarla giriş rədd edilir', async () => {
  assert.equal((await call('/api/state', { headers: {} })).status, 401);
  assert.equal((await call('/api/state', { headers: { 'x-group-key': 'sehv' } })).status, 401);
});
test('2. üzv və admin rolları tanınır', async () => {
  assert.equal((await (await call('/api/whoami')).json()).role, 'member');
  assert.equal((await (await call('/api/whoami', { headers: A })).json()).role, 'admin');
});
test('3. üzv admin əməliyyatı edə bilmir', async () => {
  assert.equal((await call('/api/admin/players', { method: 'POST', body: { name: 'X' } })).status, 403);
  assert.equal((await call('/api/admin/log')).status, 403);
});
test('4. admin oyunçu əlavə edir, təkrar ad rədd edilir', async () => {
  for (const n of ['Azər', 'Adil', 'Sabir', 'Niyazi', 'Silinəcək']) {
    const r = await call('/api/admin/players', { method: 'POST', headers: A, body: { name: n } });
    assert.equal(r.status, 201); ids[n] = (await r.json()).id;
  }
  assert.equal((await call('/api/admin/players', { method: 'POST', headers: A, body: { name: 'Azər' } })).status, 409);
  assert.equal((await call('/api/admin/players', { method: 'POST', headers: A, body: { name: '  ' } })).status, 400);
});
test('5. üzv oyun əlavə edir və o siyahıda görünür', async () => {
  const r = await call('/api/matches', { method: 'POST', body: { w: [ids['Azər'], ids['Adil']], l: [ids['Sabir'], ids['Niyazi']], r: 2, by: 'Azər' } });
  assert.equal(r.status, 201);
  const s = await state();
  assert.equal(s.matches.length, 1);
  assert.equal(s.matches[0].result, 2);
  assert.equal(s.players.length, 5);
});
test('6. təkrar oyun xəbərdarlığı: 409, təsdiq ilə 201', async () => {
  const body = { w: [ids['Adil'], ids['Azər']], l: [ids['Niyazi'], ids['Sabir']], r: 2 }; // sıra fərqli, eyni oyun
  const r1 = await call('/api/matches', { method: 'POST', body });
  assert.equal(r1.status, 409); assert.equal((await r1.json()).duplicate, true);
  assert.equal((await call('/api/matches', { method: 'POST', body: { ...body, confirm: true } })).status, 201);
  assert.equal((await state()).matches.length, 2);
});
test('7. fərqli nəticə təkrar sayılmır', async () => {
  const r = await call('/api/matches', { method: 'POST', body: { w: [ids['Azər'], ids['Adil']], l: [ids['Sabir'], ids['Niyazi']], r: 1 } });
  assert.equal(r.status, 201);
});
test('8. yanlış girişlər rədd edilir', async () => {
  const P = (body) => call('/api/matches', { method: 'POST', body });
  assert.equal((await P({ w: [ids['Azər'], ids['Azər']], l: [ids['Sabir'], ids['Niyazi']], r: 1 })).status, 400);
  assert.equal((await P({ w: [ids['Azər'], ids['Sabir']], l: [ids['Sabir'], ids['Niyazi']], r: 1 })).status, 400);
  assert.equal((await P({ w: [ids['Azər'], ids['Adil']], l: [ids['Sabir'], ids['Niyazi']], r: 5 })).status, 400);
  assert.equal((await P({ w: [ids['Azər'], 9999], l: [ids['Sabir'], ids['Niyazi']], r: 1 })).status, 400);
  assert.equal((await P({ w: [ids['Azər']], l: [ids['Sabir']], r: 1 })).status, 400);
});
test('9. admin oyunu ləğv edir, bərpa edir, nəticəni dəyişir', async () => {
  const id = (await state()).matches[0].id;
  assert.equal((await call(`/api/admin/matches/${id}`, { method: 'PATCH', headers: A, body: { cancelled: true } })).status, 200);
  assert.equal((await state()).matches.find((m) => m.id === id).cancelled, 1);
  await call(`/api/admin/matches/${id}`, { method: 'PATCH', headers: A, body: { cancelled: false } });
  assert.equal((await state()).matches.find((m) => m.id === id).cancelled, 0);
  await call(`/api/admin/matches/${id}`, { method: 'PATCH', headers: A, body: { result: 3 } });
  assert.equal((await state()).matches.find((m) => m.id === id).result, 3);
  assert.equal((await call(`/api/admin/matches/${id}`, { method: 'PATCH', headers: A, body: { result: 7 } })).status, 400);
  assert.equal((await call('/api/admin/matches/99999', { method: 'PATCH', headers: A, body: { result: 1 } })).status, 404);
});
test('10. oyunu olmayan oyunçu silinir, oyunu olan arxivlənir', async () => {
  const d = await (await call(`/api/admin/players/${ids['Silinəcək']}`, { method: 'DELETE', headers: A })).json();
  assert.equal(d.result, 'deleted');
  const a = await (await call(`/api/admin/players/${ids['Niyazi']}`, { method: 'DELETE', headers: A })).json();
  assert.equal(a.result, 'archived');
  const s = await state();
  assert.ok(!s.players.find((p) => p.name === 'Silinəcək'));
  assert.equal(s.players.find((p) => p.name === 'Niyazi').archived, 1);
});
test('11. arxivlənmiş oyunçu yeni oyunda istifadə edilə bilmir', async () => {
  const r = await call('/api/matches', { method: 'POST', body: { w: [ids['Azər'], ids['Adil']], l: [ids['Sabir'], ids['Niyazi']], r: 1, confirm: true } });
  assert.equal(r.status, 400);
});
test('12. dəyişiklik tarixçəsi yazılır', async () => {
  const log = await (await call('/api/admin/log', { headers: A })).json();
  const acts = log.map((x) => x.action);
  for (const a of ['oyunçu əlavə edildi', 'oyun əlavə edildi', 'oyun dəyişdirildi', 'oyunçu arxivləndi', 'oyunçu silindi']) assert.ok(acts.includes(a), a);
});
test('13. CSV ixracı işləyir (Azərbaycan hərfləri ilə)', async () => {
  const r = await call('/api/admin/export.csv', { headers: A });
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.ok(t.includes('winner1,winner2,loser1,loser2'));
  assert.ok(t.includes('Azər') && t.includes('Niyazi'));
});
test('14. bilinməyən yol 404, səhifə (statik) 200', async () => {
  assert.equal((await call('/api/yoxdur')).status, 404);
  const r = await fetch(BASE + '/'); assert.equal(r.status, 200);
});
