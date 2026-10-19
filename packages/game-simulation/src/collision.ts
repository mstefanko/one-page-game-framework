import { UNIT } from "../../game-project/src/runtime";
import type {
  ArchetypeDefinition,
  LevelDefinition,
  Rect,
} from "../../game-project/src/runtime";
import type { ActorState, Collider, SpatialIndex, World } from "./types";
const BUCKET = 32 * UNIT;
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
export function body(a: ActorState, d: ArchetypeDefinition): Rect {
  return {
    x: a.x + d.body.x,
    y: a.y + d.body.y,
    width: d.body.width,
    height: d.body.height,
  };
}
export function shape(a: ActorState, r: Rect): Rect {
  return {
    x: a.x + (a.facing === 1 ? r.x : -r.x - r.width),
    y: a.y + r.y,
    width: r.width,
    height: r.height,
  };
}
export function makeIndex(level: LevelDefinition): SpatialIndex {
  const buckets = new Map<string, Collider[]>();
  for (const r of level.rectangles) {
    for (
      let y = Math.floor(r.y / BUCKET);
      y <= Math.floor((r.y + r.height - 1) / BUCKET);
      y++
    )
      for (
        let x = Math.floor(r.x / BUCKET);
        x <= Math.floor((r.x + r.width - 1) / BUCKET);
        x++
      ) {
        const key = `${x},${y}`,
          items = buckets.get(key) ?? [];
        items.push({ ...r });
        buckets.set(key, items);
      }
  }
  return { buckets };
}
/** Only swept cells and rectangle buckets are visited. Exact edges use half-open AABBs. */
export function candidates(
  world: World,
  sweep: Rect,
  includePlatforms = true,
): Collider[] {
  const level = world.definitions.levels.find((l) => l.id === world.levelId)!;
  const size = level.tileSize * UNIT,
    cols = level.width / level.tileSize,
    rows = level.height / level.tileSize;
  const found = new Map<string, Collider>();
  const minX = Math.max(0, Math.floor(sweep.x / size)),
    maxX = Math.min(cols - 1, Math.floor((sweep.x + sweep.width) / size)),
    minY = Math.max(0, Math.floor(sweep.y / size)),
    maxY = Math.min(rows - 1, Math.floor((sweep.y + sweep.height) / size));
  for (let row = minY; row <= maxY; row++)
    for (let col = minX; col <= maxX; col++) {
      const tile = level.tiles[row * cols + col];
      if (tile) {
        const id = `tile:${String(row * cols + col).padStart(8, "0")}`;
        found.set(id, {
          id,
          x: col * size,
          y: row * size,
          width: size,
          height: size,
          oneWay: tile === 2,
        });
      }
    }
  for (
    let y = Math.floor(sweep.y / BUCKET);
    y <= Math.floor((sweep.y + sweep.height) / BUCKET);
    y++
  )
    for (
      let x = Math.floor(sweep.x / BUCKET);
      x <= Math.floor((sweep.x + sweep.width) / BUCKET);
      x++
    )
      for (const r of world.index.buckets.get(`${x},${y}`) ?? [])
        found.set(`rect:${r.id}`, { ...r, id: `rect:${r.id}` });
  if (includePlatforms)
    for (const p of world.platforms) {
      const def = level.platforms.find((x) => x.id === p.id)!;
      const r = {
        id: `platform:${p.id}`,
        x: p.x,
        y: p.y,
        width: def.width,
        height: def.height,
        oneWay: true,
      };
      if (
        r.x <= sweep.x + sweep.width &&
        r.x + r.width >= sweep.x &&
        r.y <= sweep.y + sweep.height &&
        r.y + r.height >= sweep.y
      )
        found.set(r.id, r);
    }
  return [...found.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
export function embedded(world: World, b: Rect): boolean {
  return candidates(world, b, false).some((r) => !r.oneWay && overlaps(b, r));
}
export function moveActor(
  world: World,
  actor: ActorState,
  dx: number,
  dy: number,
): void {
  const d = world.definitions.archetypes.find(
    (d) => d.id === actor.archetypeId,
  )!;
  let b = body(actor, d);
  const sweep = {
    x: Math.min(b.x, b.x + dx),
    y: Math.min(b.y, b.y + dy),
    width: b.width + Math.abs(dx),
    height: b.height + Math.abs(dy),
  };
  const colliders = candidates(world, sweep);
  let mx = dx;
  for (const r of colliders) {
    if (r.oneWay || b.y >= r.y + r.height || b.y + b.height <= r.y) continue;
    if (dx > 0 && b.x + b.width <= r.x && b.x + b.width + mx >= r.x)
      mx = Math.min(mx, r.x - b.x - b.width);
    if (dx < 0 && b.x >= r.x + r.width && b.x + mx <= r.x + r.width)
      mx = Math.max(mx, r.x + r.width - b.x);
  }
  actor.x += mx;
  if (mx !== dx) actor.vx = 0;
  b = body(actor, d);
  let my = dy;
  actor.grounded = false;
  actor.riderId = null;
  for (const r of colliders) {
    if (b.x >= r.x + r.width || b.x + b.width <= r.x) continue;
    if (dy >= 0 && b.y + b.height <= r.y && b.y + b.height + my >= r.y) {
      const next = r.y - b.y - b.height;
      if (next < my || !actor.grounded) {
        my = next;
        actor.grounded = true;
        actor.riderId = r.id.startsWith("platform:") ? r.id.slice(9) : null;
      }
    }
    if (
      !r.oneWay &&
      dy < 0 &&
      b.y >= r.y + r.height &&
      b.y + my <= r.y + r.height
    )
      my = Math.max(my, r.y + r.height - b.y);
  }
  actor.y += my;
  if (my !== dy || actor.grounded) actor.vy = 0;
}
