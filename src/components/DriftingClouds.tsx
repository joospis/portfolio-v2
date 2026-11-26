import { createSignal, For, onSettled } from 'solid-js';
import Cloud from './Cloud';
import './DriftingClouds.css';

/**
 * Randomly generated clouds drifting left to right across their container.
 *
 * Each cloud gets a random size, shape seed, height and speed. Size stands
 * in for distance: small clouds are fainter, slower and sit behind big ones.
 * When a cloud leaves the screen it is replaced by a fresh random one, so the
 * sky never repeats. Only `transform` is animated, so the expensive cloud
 * filters are drawn once per cloud rather than every frame.
 */

type Drifter = {
  id: number;
  seed: number;
  width: number;
  /** Vertical position, % of the container height. */
  top: number;
  /** 0 = far away, 1 = close. */
  depth: number;
  /** Seconds to cross the screen. */
  duration: number;
  /** Negative delay starts the cloud part-way across. */
  delay: number;
};

export type DriftingCloudsProps = {
  /** Clouds on screen at once. Default: one per 220px of container width, at least 5. */
  count?: number;
  /** Smallest and largest cloud width in px. Default 550 and 1300. */
  minWidth?: number;
  maxWidth?: number;
  /** Drift speed in px per second for the nearest clouds. Default 22. */
  speed?: number;
};

export default function DriftingClouds(props: DriftingCloudsProps) {
  const [clouds, setClouds] = createSignal<Drifter[]>([]);
  let container!: HTMLDivElement;
  let nextId = 0;

  const spawn = (midway: boolean): Drifter => {
    const min = props.minWidth ?? 550;
    const max = props.maxWidth ?? 1300;
    const depth = Math.random();
    const width = min + depth * (max - min);
    // Far clouds drift slower, for a parallax feel.
    const speed = (props.speed ?? 22) * (0.35 + 0.65 * depth);
    // Distance from fully off the left edge to fully off the right edge; the
    // cloud's ragged edges spill ~40% past its box on each side.
    const travel = container.clientWidth + width * 1.8;
    const duration = travel / speed;
    return {
      id: nextId++,
      seed: Math.floor(Math.random() * 10000),
      width,
      top: -10 + Math.random() * 70,
      depth,
      duration,
      delay: midway ? -Math.random() * duration : 0,
    };
  };

  const replace = (id: number) => {
    setClouds((list) => list.map((c) => (c.id === id ? spawn(false) : c)));
  };

  onSettled(() => {
    const count = props.count ?? Math.max(8, Math.ceil(container.clientWidth / 220));
    // Start the first batch already spread across the sky.
    setClouds(Array.from({ length: count }, () => spawn(true)));
  });

  return (
    <div class="drifting-clouds" ref={container} aria-hidden="true">
      <For each={clouds()}>
        {(cloud) => (
          <div
            class="drifting-clouds__cloud"
            style={{
              top: `${cloud.top}%`,
              opacity: 0.55 + Math.max(0.45 * -cloud.depth, 0.25),
              'z-index': Math.round(cloud.depth * 100),
              '--cloud-width': `${cloud.width}px`,
              'animation-duration': `${cloud.duration}s`,
              'animation-delay': `${cloud.delay}s`,
            }}
            onAnimationEnd={() => replace(cloud.id)}
          >
            <Cloud width={cloud.width} seed={cloud.seed} />
          </div>
        )}
      </For>
    </div>
  );
}
