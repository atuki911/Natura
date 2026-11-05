/** UI scale: the interface is designed on a 1280x720 canvas and scaled to the screen (same as the CSS --s unit). */
export function uiScale(): number {
  return Math.max(0.5, Math.min(1.6, Math.min(window.innerHeight / 720, window.innerWidth / 1280)));
}
