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

  // Açar koda yazılmır, birbaşa təhlükəsiz mühitdən oxunur:
  const apiKey = env.ANTHROPIC_API_KEY;

  if (!apiKey) return J({ error: 'AI açarı qoşulmayıb' }, 501);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'content-type': 'application/json', 
      'x-api-key': apiKey.trim(), 
      'anthropic-version': '2023-06-01' 
    },
    body: JSON.stringify({ 
      model: 'claude-3-haiku-20240307', 
      max_tokens: 150, 
      messages: [{ role: 'user', content: aiPrompt(b.facts) }] 
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return J({ error: 'AI xətası', status: resp.status, detail: errText }, 502);
  }

  const data = await resp.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
  if (!text) return J({ error: 'AI cavab vermədi' }, 502);

  await env.DB.prepare(
    "INSERT INTO ai_cache(player_id,games,text) VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET games=excluded.games, text=excluded.text, created_at=datetime('now')"
  ).bind(b.playerId, games, text).run();

  return J({ text, cached: false });
}

export default {
  async fetch(req, env) {
    try {
      const { pathname: p } = new URL(req.url), m = req.method;

      if (p === '/api/debug') {
        return J({ 
          hasGroup: !!env.GROUP_KEY, 
          hasAdmin: !!env.ADMIN_KEY, 
          hasAiKey: !!env.ANTHROPIC_API_KEY, 
          aiKeyLen: (env.ANTHROPIC_API_KEY || '').length 
        });
      }

      if (p === '/api/characterize' && m === 'POST') return characterize(req, env);

      const role = await roleOf(req, env);
      if (!role) return J({ error: 'giriş açarı yanlışdır' }, 401);

      if (p === '/api/whoami' && m === 'GET') return J({ role });
      
      return J({ error: 'tapılmadı' }, 404);
    } catch (e) { 
      return J({ error: 'server xətası', detail: String(e.message || e) }, 500); 
    }
  },
};
