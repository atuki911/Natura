const S = (body: string, vb = '0 0 64 64') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const K = '#2b1a10';

export const ICON = {
  heart: S(`<path d="M32 56 C8 40 4 26 10 16 C16 6 28 8 32 18 C36 8 48 6 54 16 C60 26 56 40 32 56Z" fill="#ff5a5a" stroke="${K}" stroke-width="5"/><path d="M16 20 C18 15 23 14 26 17" stroke="#fff" stroke-width="4" fill="none" opacity=".8"/>`),
  coin: S(`<circle cx="32" cy="34" r="24" fill="#d99a14" stroke="${K}" stroke-width="5"/><circle cx="32" cy="30" r="22" fill="#ffd23f" stroke="${K}" stroke-width="5"/><path d="M32 18 v24 M25 23 h10 a5 5 0 0 1 0 10 h-8 a5 5 0 0 0 0 10 h11" stroke="#b8780a" stroke-width="4" fill="none"/>`),
  star: S(`<path d="M32 5 L40 23 L59 25 L45 38 L49 58 L32 48 L15 58 L19 38 L5 25 L24 23Z" fill="#ffd23f" stroke="${K}" stroke-width="5"/><path d="M24 26 L30 25 L32 18" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>`),
  starEmpty: S(`<path d="M32 5 L40 23 L59 25 L45 38 L49 58 L32 48 L15 58 L19 38 L5 25 L24 23Z" fill="#6a5a4a" stroke="${K}" stroke-width="5"/>`),
  skull: S(`<path d="M32 8 C16 8 10 20 12 32 C13 38 18 40 18 44 L18 52 L46 52 L46 44 C46 40 51 38 52 32 C54 20 48 8 32 8Z" fill="#fff6e6" stroke="${K}" stroke-width="5"/><circle cx="24" cy="31" r="6" fill="${K}"/><circle cx="40" cy="31" r="6" fill="${K}"/><path d="M29 42 L32 37 L35 42Z" fill="${K}"/><path d="M26 52 v-6 M32 52 v-6 M38 52 v-6" stroke="${K}" stroke-width="3"/>`),
  pause: S(`<rect x="14" y="12" width="13" height="40" rx="4" fill="#fff" stroke="${K}" stroke-width="4"/><rect x="37" y="12" width="13" height="40" rx="4" fill="#fff" stroke="${K}" stroke-width="4"/>`),
  play: S(`<path d="M18 10 L52 32 L18 54Z" fill="#fff" stroke="${K}" stroke-width="5"/>`),
  fast: S(`<path d="M8 14 L32 32 L8 50Z M32 14 L56 32 L32 50Z" fill="#fff" stroke="${K}" stroke-width="4"/>`),
  gear: S(`<path d="M32 6 l5 7 8-3 2 8 8 2-3 8 7 5-7 5 3 8-8 2-2 8-8-3-5 7-5-7-8 3-2-8-8-2 3-8-7-5 7-5-3-8 8-2 2-8 8 3Z" fill="#e8e0d0" stroke="${K}" stroke-width="4"/><circle cx="32" cy="32" r="9" fill="#8a7a6a" stroke="${K}" stroke-width="4"/>`),
  book: S(`<path d="M8 14 C18 10 26 12 32 16 C38 12 46 10 56 14 L56 52 C46 48 38 50 32 54 C26 50 18 48 8 52Z" fill="#e5533a" stroke="${K}" stroke-width="4"/><path d="M32 16 V54" stroke="${K}" stroke-width="4"/><path d="M14 20 C20 18 25 19 28 21 M14 28 C20 26 25 27 28 29 M36 21 C40 19 45 18 50 20" stroke="#fff" stroke-width="3" opacity=".8"/>`),
  up: S(`<path d="M32 6 L56 32 L42 32 L42 56 L22 56 L22 32 L8 32Z" fill="#8ad860" stroke="${K}" stroke-width="5"/>`),
  sell: S(`<circle cx="32" cy="32" r="22" fill="#ffd23f" stroke="${K}" stroke-width="5"/><path d="M22 32 h20" stroke="${K}" stroke-width="6"/>`),
  flag: S(`<path d="M16 58 V8" stroke="${K}" stroke-width="6"/><path d="M18 10 C30 4 38 16 52 10 L52 34 C38 40 30 28 18 34Z" fill="#4a8fe0" stroke="${K}" stroke-width="4"/>`),
  check: S(`<path d="M10 34 L26 50 L54 16" stroke="${K}" stroke-width="13" fill="none"/><path d="M10 34 L26 50 L54 16" stroke="#fff" stroke-width="6" fill="none"/>`),
  close: S(`<path d="M14 14 L50 50 M50 14 L14 50" stroke="${K}" stroke-width="13"/><path d="M14 14 L50 50 M50 14 L14 50" stroke="#fff" stroke-width="6"/>`),
  lock: S(`<rect x="12" y="28" width="40" height="30" rx="6" fill="#ffd23f" stroke="${K}" stroke-width="5"/><path d="M20 28 V20 a12 12 0 0 1 24 0 V28" stroke="${K}" stroke-width="5" fill="none"/>`),
  meteor: S(`<path d="M8 8 L34 30" stroke="#ff7a1a" stroke-width="10"/><path d="M14 4 L36 26 M4 16 L28 36" stroke="#ffd23f" stroke-width="5"/><ellipse cx="42" cy="42" rx="15" ry="18" transform="rotate(-40 42 42)" fill="#fff6e6" stroke="${K}" stroke-width="5"/><path d="M33 44 l6-4 6 4 6-4" stroke="#e5533a" stroke-width="4" fill="none"/>`),
  chick: S(`<circle cx="32" cy="36" r="20" fill="#ffd84d" stroke="${K}" stroke-width="5"/><circle cx="26" cy="32" r="4" fill="${K}"/><circle cx="38" cy="32" r="4" fill="${K}"/><path d="M28 40 L36 40 L32 46Z" fill="#f6a21b" stroke="${K}" stroke-width="3"/><path d="M30 16 L32 8 L36 16" stroke="${K}" stroke-width="4" fill="#ffd84d"/>`),
  sword: S(`<path d="M50 8 L56 14 L24 46 L18 40Z" fill="#dfe6ee" stroke="${K}" stroke-width="4"/><path d="M14 36 L28 50" stroke="${K}" stroke-width="7"/><path d="M18 46 L8 56" stroke="#8a5a2b" stroke-width="8"/>`),
  shield: S(`<path d="M32 6 L54 14 C54 36 46 50 32 58 C18 50 10 36 10 14Z" fill="#4a8fe0" stroke="${K}" stroke-width="5"/><path d="M32 14 V50 M18 26 H46" stroke="#ffd23f" stroke-width="5"/>`),
  magic: S(`<path d="M32 4 L38 26 L60 32 L38 38 L32 60 L26 38 L4 32 L26 26Z" fill="#c2a2ff" stroke="${K}" stroke-width="4"/>`),
  wave: S(`<path d="M10 58 V8" stroke="${K}" stroke-width="6"/><path d="M12 10 L54 10 L46 22 L54 34 L12 34Z" fill="#e5533a" stroke="${K}" stroke-width="4"/><circle cx="30" cy="22" r="6" fill="#fff6e6" stroke="${K}" stroke-width="3"/>`),
  map: S(`<path d="M6 14 L22 8 L42 14 L58 8 L58 50 L42 56 L22 50 L6 56Z" fill="#fbefd0" stroke="${K}" stroke-width="4"/><path d="M22 8 V50 M42 14 V56" stroke="${K}" stroke-width="3"/><path d="M12 40 C20 30 30 44 50 22" stroke="#e5533a" stroke-width="4" fill="none" stroke-dasharray="4 5"/>`),
  retry: S(`<path d="M50 30 A18 18 0 1 1 40 15" stroke="${K}" stroke-width="12" fill="none"/><path d="M50 30 A18 18 0 1 1 40 15" stroke="#fff" stroke-width="5" fill="none"/><path d="M36 4 L50 14 L36 24Z" fill="#fff" stroke="${K}" stroke-width="4"/>`),
  sound: S(`<path d="M8 24 H20 L34 12 V52 L20 40 H8Z" fill="#fff" stroke="${K}" stroke-width="4"/><path d="M42 22 C48 28 48 36 42 42 M48 16 C58 26 58 38 48 48" stroke="${K}" stroke-width="4" fill="none"/>`),

  meteorArt: S(`<defs><radialGradient id="mf" cx="40%" cy="35%"><stop offset="0" stop-color="#fff6c0"/><stop offset=".55" stop-color="#ffb02a"/><stop offset="1" stop-color="#e5401a"/></radialGradient></defs>
    <path d="M6 10 C18 18 26 26 34 34 L28 40 C20 32 12 24 6 10Z" fill="#ff7a1a" stroke="${K}" stroke-width="3"/>
    <path d="M14 4 C24 14 32 22 40 30 L36 34 C28 26 20 18 14 4Z" fill="#ffd23f" stroke="${K}" stroke-width="3"/>
    <path d="M2 22 C12 28 20 34 28 42 L24 46 C16 38 8 32 2 22Z" fill="#ffd23f" stroke="${K}" stroke-width="3"/>
    <ellipse cx="42" cy="42" rx="15" ry="18" transform="rotate(-42 42 42)" fill="url(#mf)" stroke="${K}" stroke-width="4"/>
    <path d="M33 47 l5-5 5 4 5-6 5 4" stroke="#fff6e6" stroke-width="3.5" fill="none"/>
    <ellipse cx="38" cy="34" rx="4" ry="2.5" transform="rotate(-42 38 34)" fill="#fff" opacity=".85"/>`),
  chickArt: S(`<ellipse cx="32" cy="58" rx="16" ry="3" fill="#000" opacity=".2"/>
    <path d="M46 8 L46 52" stroke="#8a5a2b" stroke-width="4"/><path d="M41 12 L46 2 L51 12Z" fill="#dfe6ee" stroke="${K}" stroke-width="3"/>
    <circle cx="30" cy="38" r="18" fill="#ffd84d" stroke="${K}" stroke-width="4"/>
    <path d="M13 32 C14 18 46 18 47 32 Z" fill="#6d8fb3" stroke="${K}" stroke-width="3.5"/><circle cx="30" cy="20" r="3" fill="#ffd23f" stroke="${K}" stroke-width="2"/>
    <circle cx="24" cy="37" r="3.6" fill="${K}"/><circle cx="36" cy="37" r="3.6" fill="${K}"/><circle cx="25" cy="35.6" r="1.2" fill="#fff"/><circle cx="37" cy="35.6" r="1.2" fill="#fff"/>
    <path d="M26 43 L34 43 L30 49Z" fill="#f6a21b" stroke="${K}" stroke-width="2.5"/>
    <ellipse cx="18" cy="44" rx="3" ry="2" fill="#ff9aa2"/><ellipse cx="42" cy="44" rx="3" ry="2" fill="#ff9aa2"/>
    <ellipse cx="46" cy="40" rx="5" ry="7" fill="#ffd84d" stroke="${K}" stroke-width="3"/>`),
  cancel: S(`<circle cx="32" cy="32" r="26" fill="#e5533a" stroke="${K}" stroke-width="5"/><path d="M22 22 L42 42 M42 22 L22 42" stroke="#fff" stroke-width="7"/>`),

  itemBomb: S(`<ellipse cx="32" cy="38" rx="18" ry="21" fill="#fff6e6" stroke="${K}" stroke-width="4"/><path d="M16 40 l6-5 6 5 6-5 6 5 6-5" stroke="#e5533a" stroke-width="4" fill="none"/><path d="M32 17 C34 10 40 8 44 10" stroke="#8a6a3a" stroke-width="4" fill="none"/><path d="M44 4 l2 5 5 1 -4 3 1 5 -4-3 -5 2 2-5 -3-4 5 0Z" fill="#ffd23f" stroke="${K}" stroke-width="2"/>`),
  itemFrost: S(`<path d="M14 54 C18 34 30 18 50 8 C48 26 38 44 14 54Z" fill="#bfefff" stroke="${K}" stroke-width="4"/><path d="M14 54 L44 16" stroke="#6fbfff" stroke-width="3"/><path d="M26 38 l-6-4 M32 30 l-6-5 M38 22 l-5-6 M28 40 l6 2 M34 32 l7 1 M40 24 l6 0" stroke="#6fbfff" stroke-width="2.5"/><circle cx="50" cy="44" r="3" fill="#fff" stroke="#6fbfff" stroke-width="2"/><circle cx="44" cy="54" r="2" fill="#fff"/>`),
  itemGold: S(`<path d="M18 26 C12 34 10 52 32 56 C54 52 52 34 46 26 Z" fill="#c8964a" stroke="${K}" stroke-width="4"/><path d="M20 26 C26 22 38 22 44 26" stroke="${K}" stroke-width="4" fill="#a8763a"/><ellipse cx="32" cy="18" rx="9" ry="11" fill="#ffd23f" stroke="${K}" stroke-width="3.5"/><circle cx="22" cy="44" r="5" fill="#ffd23f" stroke="${K}" stroke-width="2.5"/><circle cx="40" cy="46" r="5" fill="#ffd23f" stroke="${K}" stroke-width="2.5"/>`),
  itemHeart: S(`<path d="M32 58 C10 42 4 28 10 18 C16 8 28 10 32 20 C36 10 48 8 54 18 C60 28 54 42 32 58Z" fill="#ff5a6a" stroke="${K}" stroke-width="4"/><path d="M32 26 v18 M23 35 h18" stroke="#fff" stroke-width="6"/>`),
  itemThunder: S(`<path d="M14 30 C14 16 28 8 40 12 C50 6 58 16 54 26 C60 30 56 40 48 40 L18 40 C10 40 8 32 14 30Z" fill="#e8e0f0" stroke="${K}" stroke-width="4"/><path d="M34 40 L26 52 L34 52 L28 62 L44 46 L36 46 L42 40Z" fill="#ffd23f" stroke="${K}" stroke-width="3"/>`),
  shop: S(`<path d="M10 26 L14 12 H50 L54 26Z" fill="#e5533a" stroke="${K}" stroke-width="4"/><path d="M14 12 L18 26 M26 12 L28 26 M38 12 L36 26 M50 12 L46 26" stroke="#fff" stroke-width="3"/><rect x="12" y="26" width="40" height="28" rx="3" fill="#fbefd0" stroke="${K}" stroke-width="4"/><ellipse cx="26" cy="42" rx="6" ry="8" fill="#fff6e6" stroke="${K}" stroke-width="3"/><path d="M38 34 l6 0 l3 6 l-6 12 l-6-12Z" fill="#7fe0ff" stroke="${K}" stroke-width="3"/>`),
  gem: S(`<path d="M18 12 H46 L58 26 L32 56 L6 26Z" fill="#6fd6ff" stroke="${K}" stroke-width="4"/><path d="M6 26 H58 M18 12 L26 26 L32 56 M46 12 L38 26 L32 56 M26 26 L32 12 L38 26" stroke="#2a8ab8" stroke-width="2.5" fill="none"/><path d="M14 22 l4-6" stroke="#fff" stroke-width="3"/>`),
  chest: S(`<rect x="8" y="28" width="48" height="28" rx="4" fill="#b8763a" stroke="${K}" stroke-width="4"/><path d="M8 30 C8 14 56 14 56 30Z" fill="#c8864a" stroke="${K}" stroke-width="4"/><rect x="28" y="30" width="8" height="12" fill="#ffd23f" stroke="${K}" stroke-width="3"/><path d="M8 30 H56" stroke="${K}" stroke-width="3"/><path d="M14 18 l4-8 4 8 M40 12 l4-6 4 6" stroke="#7fe0ff" stroke-width="4" fill="none"/>`),
  music: S(`<path d="M24 46 V12 L50 6 V40" stroke="${K}" stroke-width="6" fill="none"/><ellipse cx="18" cy="48" rx="8" ry="6" fill="#fff" stroke="${K}" stroke-width="4"/><ellipse cx="44" cy="42" rx="8" ry="6" fill="#fff" stroke="${K}" stroke-width="4"/>`),
  tip: S(`<circle cx="32" cy="32" r="26" fill="#4a8fe0" stroke="${K}" stroke-width="5"/><path d="M32 14 V38" stroke="#fff" stroke-width="8"/><circle cx="32" cy="48" r="5" fill="#fff"/>`),
  hero: S(`<circle cx="32" cy="36" r="20" fill="#fff" stroke="${K}" stroke-width="5"/><path d="M26 18 C26 8 32 6 32 6 C34 10 40 8 38 18" fill="#e53935" stroke="${K}" stroke-width="4"/><circle cx="26" cy="34" r="3.5" fill="${K}"/><circle cx="38" cy="34" r="3.5" fill="${K}"/><path d="M28 40 L36 40 L32 47Z" fill="#f6a21b" stroke="${K}" stroke-width="3"/>`),
};

export function starsHtml(n: number, max = 3): string {
  let s = '';
  for (let i = 0; i < max; i++) s += i < n ? ICON.star : ICON.starEmpty;
  return s;
}
