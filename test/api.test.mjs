const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export default {
  async fetch(req, env) {
    const { pathname: p } = new URL(req.url);

    // Anthropic-də sizin hesabınız üçün açıq olan modellərin siyahısını sorğulayırıq
    if (p === '/api/models') {
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) return J({ error: 'AI açarı qoşulmayıb' }, 501);

      const resp = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01'
        }
      });

      const data = await resp.json();
      return J({ status: resp.status, data });
    }

    return J({ message: 'Model yoxlama rejimi aktivdir. /api/models ünvanına baxın.' });
  }
};
