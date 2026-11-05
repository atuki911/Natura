import Phaser from 'phaser';
import { makeBackgroundTextures } from './art/background.ts';
import { makeBuildingTextures } from './art/buildings.ts';
import { makeCreatureTextures } from './art/creatures.ts';
import { makeTreeTextures } from './art/trees.ts';
import { makeUiTextures } from './art/ui.ts';
import type { BattleConfig } from './BattleScene.ts';

// 起動。生成画像があれば先に読み込み、無い部品はコードで描く。

interface Manifest {
  /** テクスチャの key → assets/ からの相対パス */
  images: Record<string, string>;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    // assets/manifest.json に書いた画像は、同じ key のコード製の絵の代わりに使われる。
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-manifest', (_key: string, _type: string, data: Manifest) => {
      for (const [key, path] of Object.entries(data?.images ?? {})) this.load.image(key, `assets/${path}`);
    });
    this.load.on('loaderror', () => {
      // 画像が無くてもコード製の絵で続ける
    });
  }

  create(): void {
    makeBackgroundTextures(this);
    makeBuildingTextures(this);
    makeCreatureTextures(this);
    makeUiTextures(this);
    makeTreeTextures(this);

    const params = new URLSearchParams(location.search);
    const autoplay = params.has('autoplay');
    const debug = params.has('debug');
    if (autoplay || debug || params.has('play')) {
      const config: BattleConfig = {
        mode: 'play',
        autoplay,
        debug,
        seed: params.has('seed') ? Number(params.get('seed')) : undefined,
        speed: params.has('speed') ? Number(params.get('speed')) : undefined,
        startWave: params.has('wave') ? Number(params.get('wave')) : undefined,
        stageId: params.get('stage') ?? undefined,
      };
      this.scene.start('battle', config);
      return;
    }
    if (params.has('map')) {
      this.scene.start('map');
      return;
    }
    this.scene.start('title');
  }
}
