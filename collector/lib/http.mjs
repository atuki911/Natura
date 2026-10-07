// fetch の薄いラッパー（タイムアウト・UA・遅延）
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getText(url, { fetchImpl = globalThis.fetch, userAgent, timeoutMs = 20000, accept } = {}) {
  if (!fetchImpl) throw new Error('fetch が使えません（Node 18 以上が必要です）');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': userAgent || 'NaturaResearchBot/1.0', Accept: accept || '*/*' },
      signal: ctl.signal
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url}`);
      err.status = res.status;
      throw err;
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(url, opts) {
  return JSON.parse(await getText(url, { ...opts, accept: 'application/json' }));
}
