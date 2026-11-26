import { createMemo, createUniqueId, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import './Cloud.css';

/**
 * Realistic cloud, after Beau Jackson's CSS-Tricks article
 * "Drawing Realistic Clouds with SVG and CSS".
 *
 * Each layer is a small circle pushed far out of the way. Its box-shadows
 * (one per "puff") are offset back into the cloud's box, so only the
 * shadows show. An SVG filter (fractal noise feeding a displacement map)
 * then roughens the union of puffs into a cloud edge.
 *
 * Puffs: a row of medium ones forms a flattish base, and a few larger ones
 * build the domed top. Their sizes and positions come from `seed`, so each
 * seed gives both a different outline and different noise.
 *
 * Three layers give depth: a bright silhouette, grey-blue shading on the
 * underside, and a sunlit highlight on top.
 *
 * Values are tuned for a 500 × 275 box and scaled from `width` / `height`.
 */

const REF_W = 500;
const REF_H = 275;
const BASE_FREQUENCY = 0.012;
/** Diameter of the off-screen source circle, in reference px. */
const SOURCE = 100;
/** How far the source circle is moved out of the way, in reference px. */
const AWAY = 700;
/** Room around the puffs for blur, spread and displacement, in reference px. */
const PAD = 200;

type Puff = { x: number; y: number; d: number; top: boolean };

type Layer = {
  name: string;
  /** Which puffs this layer draws. */
  puffs: 'all' | 'base' | 'top';
  /** Shift and resize of each puff, in reference px. */
  dy: number;
  grow: number;
  blur: number;
  color: string;
  octaves: number;
  /** Displacement strength, in reference px. */
  scale: number;
};

const LAYERS: Layer[] = [
  // Silhouette: every puff, bright, most ragged edge.
  { name: 'back', puffs: 'all', dy: 0, grow: 20, blur: 28, color: 'rgba(255, 255, 255, 0.7)', octaves: 4, scale: 170 },
  // Underside shading: base puffs, lowered and shrunk to stay inside the silhouette.
  { name: 'mid', puffs: 'base', dy: 20, grow: -25, blur: 40, color: 'rgba(150, 162, 178, 0.27)', octaves: 2, scale: 150 },
  // Sunlit tops of the big puffs.
  { name: 'front', puffs: 'top', dy: -20, grow: -45, blur: 35, color: 'rgba(255, 255, 255, 0.5)', octaves: 2, scale: 100 },
];

/** Small seeded PRNG (mulberry32), so a seed always gives the same cloud. */
function random(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Puff layout in the 500 × 275 reference box. */
function puffs(seed: number): Puff[] {
  const r = random(seed);
  const between = (lo: number, hi: number) => lo + r() * (hi - lo);
  const out: Puff[] = [];

  // Base: overlapping medium puffs on one line, for a flattish bottom.
  const baseCount = 4 + Math.floor(r() * 2);
  for (let i = 0; i < baseCount; i++) {
    const t = i / (baseCount - 1);
    out.push({ x: 90 + t * 320 + between(-15, 15), y: 190 + between(-10, 8), d: between(110, 150), top: false });
  }

  // Top: a few big puffs, the largest off-centre, smaller toward the ends.
  const topCount = 2 + Math.floor(r() * 2);
  const peak = between(0.3, 0.7);
  for (let i = 0; i < topCount; i++) {
    const t = topCount === 1 ? 0.5 : i / (topCount - 1);
    const x = 170 + t * 160 + between(-20, 20);
    const nearPeak = 1 - Math.min(1, Math.abs(t - peak) * 1.6);
    out.push({ x, y: 140 - nearPeak * 30 + between(-10, 10), d: 140 + nearPeak * 90 + between(-15, 15), top: true });
  }

  return out;
}

export type CloudProps = {
  /** Width of the cloud's box in px. Default 500. */
  width?: number;
  /** Height of the cloud's box in px. Default 55% of width. */
  height?: number;
  /** Shape seed: each value gives a different outline and texture. Default 0. */
  seed?: number;
  class?: string;
  style?: JSX.CSSProperties;
};

export default function Cloud(props: CloudProps) {
  const id = createUniqueId();
  const w = () => props.width ?? REF_W;
  const h = () => props.height ?? w() * (REF_H / REF_W);
  const k = () => w() / REF_W;
  const ky = () => h() / REF_H;
  const layout = createMemo(() => puffs(props.seed ?? 0));

  // Filter region in the source circle's bounding-box units. It must include
  // the source circle itself (Chrome drops the filter otherwise) and reach the
  // puffs, which sit AWAY px down-right of it, plus padding.
  const regionStart = -1;
  const regionSize = (AWAY + Math.max(REF_W, REF_H) + PAD) / SOURCE + 1;

  const shadows = (layer: Layer) => {
    const src = SOURCE * k();
    const away = AWAY * k();
    return layout()
      .filter((p) => layer.puffs === 'all' || (layer.puffs === 'top') === p.top)
      .map((p) => {
        // Shadow centre lands on the puff centre; spread sets its diameter.
        const ox = away + p.x * k() - src / 2;
        const oy = away + (p.y + layer.dy) * ky() - src / 2;
        const spread = ((p.d + layer.grow) * k() - src) / 2;
        return `${ox}px ${oy}px ${layer.blur * k()}px ${spread}px ${layer.color}`;
      })
      .join(', ');
  };

  return (
    <div
      class={['cloud', props.class]}
      style={{ width: `${w()}px`, height: `${h()}px`, ...props.style }}
      aria-hidden="true"
    >
      <svg class="cloud__defs" width="0" height="0">
        <For each={LAYERS}>
          {(layer) => (
            <filter
              id={`${id}-${layer.name}`}
              x={regionStart}
              y={regionStart}
              width={regionSize}
              height={regionSize}
              color-interpolation-filters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={BASE_FREQUENCY / k()}
                numOctaves={layer.octaves}
                seed={props.seed ?? 0}
              />
              <feDisplacementMap in="SourceGraphic" scale={layer.scale * k()} />
            </filter>
          )}
        </For>
      </svg>

      <For each={LAYERS}>
        {(layer) => (
          <div
            class="cloud__layer"
            style={{
              width: `${SOURCE * k()}px`,
              height: `${SOURCE * k()}px`,
              left: `${-AWAY * k()}px`,
              top: `${-AWAY * k()}px`,
              filter: `url(#${id}-${layer.name})`,
              'box-shadow': shadows(layer),
            }}
          />
        )}
      </For>
    </div>
  );
}
