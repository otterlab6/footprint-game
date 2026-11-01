// Minimal Supabase REST client for the leaderboard (no SDK needed).
(() => {
  'use strict';

  const cfg = window.FOOTPRINT_CONFIG || {};
  const enabled = Boolean(cfg.supabaseUrl && cfg.supabaseKey);
  const TIMEOUT_MS = 8000;

  async function request(path, options = {}) {
    if (!enabled) throw new Error('Leaderboard is not configured');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    try {
      const res = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + path, {
        ...options,
        signal: ctrl ? ctrl.signal : undefined,
        headers: {
          apikey: cfg.supabaseKey,
          Authorization: 'Bearer ' + cfg.supabaseKey,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const err = new Error((data && (data.message || data.hint)) || 'HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  window.Leaderboard = {
    enabled,
    /** Top N scores, best first. */
    top(limit = cfg.leaderboardSize || 10) {
      return request(
        '/rest/v1/scores?select=id,name,score,time_ms,created_at&mode=eq.lives3' +
          '&order=score.desc,time_ms.asc,id.asc&limit=' + encodeURIComponent(limit)
      );
    },
    /** Saves a finished run. Resolves to { id, rank }. */
    submit(name, score, timeMs, lang) {
      return request('/rest/v1/rpc/submit_score', {
        method: 'POST',
        body: JSON.stringify({ p_name: name, p_score: score, p_time_ms: Math.round(timeMs), p_lang: lang }),
      });
    },
  };
})();
