const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const enc = new TextEncoder();

async function same(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(x, y);
}

async function roleOf(req, env) {
  if (await same(req.headers.get('x-admin-key'), env.ADMIN_KEY)) return 'admin';
  if (await same(req.headers.get('x-group-key'), env.GROUP_KEY)) return 'member';
  return null;
}

const log = (env, actor, action, detail) =>
  env.DB.prepare('INSERT INTO audit_log(actor,action,detail) VALUES(?,?,?)').bind(actor, action, detail ?? null).run();

const sortedKey = (a) => [...a].sort((x, y) => x - y).join(',');

async function activePlayerIds(env) {
  const { results } = await env.DB.prepare('SELECT id FROM players WHERE archived=0').all();
  return new Set(results.map((r) => r.id));
}

async function addMatch(req, env, role) {
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.w) || !Array.isArray(b.l)) return J({ error: 'w və l massivləri lazımdır' }, 400);
  const w = b.w.map(Number), l = b.l.map(Number), r = Number(b.r);
  if (w.length !== 2 || l.length !== 2) return J({ error: 'hər cütdə 2 oyunçu olmalıdır' }, 400);
  if (![1, 2, 3].includes(r)) return J({ error: 'nəticə 1, 2 və ya 3 olmalıdır' }, 400);
  if (new Set([...w, ...l]).size !== 4) return J({ error: '4 fərqli oyunçu seçin' }, 400);
  const ids = await activePlayerIds(env);
  if (![...w, ...l].every((i) => ids.has(i))) return J({ error: 'oyunçu tapılmadı və ya arxivdədir' }, 400);

  const last = await env.DB.prepare('SELECT * FROM matches WHERE cancelled=0 ORDER BY id DESC LIMIT 1').first();
  if (last && !b.confirm && sortedKey([last.w1, last.w2]) === sortedKey(w) && sortedKey([last.l1, last.l2]) === sortedKey(l) && last.result === r) {
    return J({ error: 'Bu oyun artıq son oyun kimi qeyd olunub', duplicate: true }, 409);
  }
  const by = String(b.by || (role === 'admin' ? 'admin' : 'üzv')).slice(0, 40);
  const comment = b.comment ? String(b.comment).slice(0, 300) : null;
  const res = await env.DB.prepare('INSERT INTO matches(w1,w2,l1,l2,result,created_by,comment) VALUES(?,?,?,?,?,?,?)').bind(w[0], w[1], l[0], l[1], r, by, comment).run();
  const id = res.meta.last_row_id;
  await log(env, by, 'oyun əlavə edildi', `#${id}: ${w} qalib, ${l} məğlub, nəticə ${r}${b.confirm ? ' (təkrar təsdiqləndi)' : ''}`);
  return J({ id }, 201);
}

async function patchMatch(req, env, id) {
  const b = await req.json().catch(() => ({}));
  const m = await env.DB.prepare('SELECT * FROM matches WHERE id=?').bind(id).first();
  if (!m) return J({ error: 'oyun tapılmadı' }, 404);
  const sets = [], vals = [], notes = [];
  if (b.result !== undefined) {
    if (![1, 2, 3].includes(Number(b.result))) return J({ error: 'nəticə 1, 2 və ya 3 olmalıdır' }, 400);
    sets.push('result=?'); vals.push(Number(b.result)); notes.push(`nəticə ${m.result}→${b.result}`);
  }
  if (b.cancelled !== undefined) {
    sets.push('cancelled=?'); vals.push(b.cancelled ? 1 : 0); notes.push(b.cancelled ? 'ləğv edildi' : 'bərpa edildi');
  }
  if (!sets.length) return J({ error: 'dəyişiklik yoxdur' }, 400);
  await env.DB.prepare(`UPDATE matches SET ${sets.join(',')} WHERE id=?`).bind(...vals, id).run();
  await log(env, 'admin', 'oyun dəyişdirildi', `#${id}: ${notes.join(', ')}`);
  return J({ ok: true });
}

async function addPlayer(req, env) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || '').replace(/[<>&"]/g, '').trim();
  if (name.length < 1 || name.length > 30) return J({ error: 'ad 1–30 simvol olmalıdır' }, 400);
  try {
    const res = await env.DB.prepare('INSERT INTO players(name) VALUES(?)').bind(name).run();
    await log(env, 'admin', 'oyunçu əlavə edildi', name);
    return J({ id: res.meta.last_row_id, name }, 201);
  } catch (e) {
    return J({ error: 'bu adda oyunçu artıq var' }, 409);
  }
}

async function removePlayer(env, id) {
  const p = await env.DB.prepare('SELECT * FROM players WHERE id=?').bind(id).first();
  if (!p) return J({ error: 'oyunçu tapılmadı' }, 404);
  const used = await env.DB.prepare('SELECT 1 x FROM matches WHERE ? IN (w1,w2,l1,l2) LIMIT 1').bind(id).first();
  if (used) {
    await env.DB.prepare('UPDATE players SET archived=1 WHERE id=?').bind(id).run();
    await log(env, 'admin', 'oyunçu arxivləndi', p.name);
    return J({ result: 'archived' });
  }
  await env.DB.prepare('DELETE FROM players WHERE id=?').bind(id).run();
  await log(env, 'admin', 'oyunçu silindi', p.name);
  return J({ result: 'deleted' });
}

async function exportCsv(env) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.played_at, a.name w1, b.name w2, c.name l1, d.name l2, m.result, m.cancelled, m.created_by, m.comment
     FROM matches m JOIN players a ON a.id=m.w1 JOIN players b ON b.id=m.w2 JOIN players c ON c.id=m.l1 JOIN players d ON d.id=m.l2 ORDER BY m.id`).all();
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = 'id,played_at,winner1,winner2,loser1,loser2,result,cancelled,created_by,comment';
  const rows = results.map((r) => [r.id, r.played_at, r.w1, r.w2, r.l1, r.l2, r.result, r.cancelled, r.created_by, r.comment].map(q).join(','));
  return new Response('\uFEFF' + [head, ...rows].join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="domino-oyunlar.csv"' } });
}

async function importMatches(req, env) {
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.rows) || !b.rows.length) return J({ error: 'rows massivi lazımdır' }, 400);

  const all = b.rows;
  const rows = [], skipped = [];

  all.forEach((r, i) => {
    if (![1, 2, 3].includes(Number(r.result))) {
      skipped.push({ row: i + 1, reason: 'nəticə 1, 2 və ya 3 olmalıdır' });
      return;
    }
    const names = ['w1', 'w2', 'l1', 'l2'].map((k) => String(r[k] || '').trim());
    if (names.some((n) => !n)) {
      skipped.push({ row: i + 1, reason: 'oyunçu adı boşdur' });
      return;
    }
    if (new Set(names.map((n) => n.toLowerCase())).size !== 4) {
      skipped.push({ row: i + 1, reason: '4 fərqli oyunçu adı olmalıdır (təkrarlanan ad var)' });
      return;
    }
    rows.push(r);
  });

  if (!rows.length) return J({ inserted: 0, created: [], skipped });

  const { results: existing } = await env.DB.prepare('SELECT id,name FROM players').all();
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));

  const toCreate = [...new Set(rows.flatMap((r) => [r.w1, r.w2, r.l1, r.l2].map((x) => String(x).trim())))]
    .filter((n) => !byName.has(n.toLowerCase()));

  if (toCreate.length) {
    await env.DB.batch(toCreate.map((n) => env.DB.prepare('INSERT INTO players(name) VALUES(?)').bind(n)));
    const { results: fresh } = await env.DB.prepare('SELECT id,name FROM players').all();
    fresh.forEach((p) => byName.set(p.name.toLowerCase(), p.id));
  }

  const stmts = rows.map((r) => {
    const [w1, w2, l1, l2] = ['w1', 'w2', 'l1', 'l2'].map((k) => byName.get(String(r[k]).trim().toLowerCase()));
    const comment = r.comment ? String(r.comment).slice(0, 300) : null;
    if (r.played_at) {
      return env.DB.prepare('INSERT INTO matches(w1,w2,l1,l2,result,created_by,comment,played_at) VALUES(?,?,?,?,?,?,?,?)')
        .bind(w1, w2, l1, l2, Number(r.result), 'import', comment, String(r.played_at));
    }
    return env.DB.prepare('INSERT INTO matches(w1,w2,l1,l2,result,created_by,comment) VALUES(?,?,?,?,?,?,?)')
      .bind(w1, w2, l1, l2, Number(r.result), 'import', comment);
  });

  await env.DB.batch(stmts);
  await log(env, 'admin', 'toplu idxal', `${rows.length} oyun əlavə edildi, ${skipped.length} sətir keçildi, ${toCreate.length} yeni oyunçu: ${toCreate.join(', ') || '—'}`);

  return J({ inserted: rows.length, created: toCreate, skipped });
}

async function resetAll(req, env) {
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== 'RESET') return J({ error: 'təsdiq sözü yanlışdır' }, 400);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM matches'),
    env.DB.prepare('DELETE FROM players'),
    env.DB.prepare('DELETE FROM audit_log'),
  ]);
  await log(env, 'admin', 'hamısı sıfırlandı', 'bütün oyunçular və oyunlar silindi');
  return J({ ok: true });
}

function aiPrompt(f) {
  return `Sən dominoçular üçün qısa, canlı xarakteristika yazan köməkçisən. Aşağıdakı statistik faktlara ƏSASƏN (başqa heç bir ədəd uydurma, yalnız verilənləri istifadə et), Azərbaycan dilində, 1–2 cümləlik, təbii və maraqlı bir xarakteristika yaz. Dostcasına bir tonda yaz, şablonlaşmış ifadələrdən (məs. "domino ustası") yayın, hər dəfə fərqli formada yaz. Yalnız mətnin özünü qaytar, dırnaq işarəsi və ya izah əlavə etmə.

Oyunçu: ${f.name}
Oyun sayı: ${f.games}
Qələbə: ${f.wins} (${f.winRate}%)
Məğlubiyyət: ${f.losses}
Xal: ${f.pts}
Elo: ${f.elo}
Cari seriya: ${f.streak}
Ən uzun qələbə seriyası: ${f.maxWinStreak}
Ən uzun məğlubiyyət seriyası: ${f.maxLossStreak}
Böyük (2-3 xallı) qələbə sayı: ${f.bigWins}
Ən yaxşı partnyor: ${f.bestPartner || 'yoxdur'}
Ən çətin partnyor: ${f.worstPartner || 'yoxdur'}
Ən çətin rəqib: ${f.toughestOpponent || 'yoxdur'}
Ən asan rəqib: ${f.easiestOpponent || 'yoxdur'}`;
}

async function characterize(req, env) {
  const b = await req.json().catch(() => null);
  if (!b || !b.playerId || !b.facts) return J({ error: 'playerId və facts lazımdır' }, 400);
  const games = Number(b.games) || 0;
  const cached = await env.DB.prepare('SELECT text, games FROM ai_cache WHERE player_id=?').bind(b.playerId).first();
  if (cached && cached.games === games) return J({ text: cached.text, cached: true });
  if (!env.ANTHROPIC_API_KEY) return J({ error: 'AI açarı qoşulmayıb' }, 501);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: aiPrompt(b.facts) }] }),
  });
  if (!resp.ok) return J({ error: 'AI xətası: ' + (await resp.text()).slice(0, 200) }, 502);
  const data = await resp.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
  if (!text) return J({ error: 'AI cavab vermədi' }, 502);
  await env.DB.prepare(
    "INSERT INTO ai_cache(player_id,games,text) VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET games=excluded.games, text=excluded.text, created_at=datetime('now')"
  ).bind(b.playerId, games, text).run();
  return J({ text, cached: false });
}

async function route(req, env) {
  const { pathname: p } = new URL(req.url), m = req.method;
  if (p === '/api/debug') return J({ hasGroup: !!env.GROUP_KEY, hasAdmin: !!env.ADMIN_KEY, groupLen: (env.GROUP_KEY || '').length, adminLen: (env.ADMIN_KEY || '').length });
  const role = await roleOf(req, env);
  if (!role) return J({ error: 'giriş açarı yanlışdır' }, 401);
  if (p === '/api/whoami' && m === 'GET') return J({ role });
  if (p === '/api/state' && m === 'GET') {
    const [pl, ma] = await Promise.all([
      env.DB.prepare('SELECT id,name,archived FROM players ORDER BY id').all(),
      env.DB.prepare('SELECT id,played_at,w1,w2,l1,l2,result,cancelled,comment FROM matches ORDER BY id').all(),
    ]);
    return J({ players: pl.results, matches: ma.results });
  }
  if (p === '/api/matches' && m === 'POST') return addMatch(req, env, role);
  if (p === '/api/characterize' && m === 'POST') return characterize(req, env);
  if (p.startsWith('/api/admin/')) {
    if (role !== 'admin') return J({ error: 'yalnız admin' }, 403);
    let x;
    if (p === '/api/admin/players' && m === 'POST') return addPlayer(req, env);
    if (p === '/api/admin/import' && m === 'POST') return importMatches(req, env);
    if (p === '/api/admin/reset' && m === 'POST') return resetAll(req, env);
    if ((x = p.match(/^\/api\/admin\/players\/(\d+)$/)) && m === 'DELETE') return removePlayer(env, +x[1]);
    if ((x = p.match(/^\/api\/admin\/matches\/(\d+)$/)) && m === 'PATCH') return patchMatch(req, env, +x[1]);
    if (p === '/api/admin/log' && m === 'GET') return J((await env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all()).results);
    if (p === '/api/admin/export.csv' && m === 'GET') return exportCsv(env);
  }
  return J({ error: 'tapılmadı' }, 404);
}

export default {
  async fetch(req, env) {
    try { return await route(req, env); } catch (e) { return J({ error: 'server xətası', detail: String(e.message || e) }, 500); }
  },
};
