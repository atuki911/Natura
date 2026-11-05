// 画面の寸法と、戦闘の座標から画面の座標への変換。
// ゲームの中の座標は 1280x720(論理座標)で考える。実際のキャンバスは 1920x1080 で、
// カメラを 1.5 倍に拡大して描く。こうすると高解像度の画面でも線がにじまない。

export const VIEW = { width: 1280, height: 720 };
export const CANVAS = { width: 1920, height: 1080 };
export const ZOOM = CANVAS.width / VIEW.width;

/** 生成テクスチャの解像度の倍率。テクスチャは ART_SCALE 倍で描き、表示時に 1/ART_SCALE に縮める。 */
export const ART_SCALE = 2;

export const HUD_TOP = 600;

/** 道の奥と手前の y。兵の row(0〜1)をこの間に並べる。 */
export const LANE = { top: 480, bottom: 566 };

/** 空を飛ぶ敵の浮く高さ。 */
export const FLY_HEIGHT = 92;

export const TOWER_BASE_Y = 452;

export const CASTLE_GATE = { x: 120, y: 560 };

export function groundY(row: number): number {
  return LANE.top + row * (LANE.bottom - LANE.top);
}

export const DEPTH = {
  sky: 0,
  background: 5,
  buildings: 20,
  scorch: 30,
  /** 兵とタワーは y に足して重なり順を決める。 */
  actors: 100,
  projectiles: 900,
  effects: 1000,
  numbers: 1100,
  banner: 1500,
  hud: 2000,
  overlay: 3000,
};

/** 論理座標 1280x720 がキャンバス全体に映るようにカメラを合わせる。 */
export function setupCamera(scene: { cameras: { main: { setZoom(z: number): unknown; centerOn(x: number, y: number): unknown } } }): void {
  scene.cameras.main.setZoom(ZOOM);
  scene.cameras.main.centerOn(VIEW.width / 2, VIEW.height / 2);
}
