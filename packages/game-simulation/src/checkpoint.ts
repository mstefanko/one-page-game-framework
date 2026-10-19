import {
  ACTIONS,
  SNAPSHOT_VERSION,
  array,
  boolean,
  boundedJSON,
  canonical,
  integer,
  record,
  string,
} from "../../game-project/src/runtime";
import type {
  CompatibilityIdentity,
  GameDefinitions,
} from "../../game-project/src/runtime";
import { body, embedded, makeIndex, moveActor, overlaps } from "./collision";
import type { ActorState, World } from "./types";
import { MAX_DEFEATED_PLACEMENTS } from "./counters";
const counter = (v: unknown) => integer(v, 0, Number.MAX_SAFE_INTEGER);
const position = (v: unknown) => integer(v, -16777216, 16777216);
const direction = (v: unknown): -1 | 1 => {
  const n = integer(v, -1, 1);
  if (!n) throw Error("Direction must be -1 or 1");
  return n as -1 | 1;
};
function unique(values: readonly (string | number)[]): void {
  if (new Set(values).size !== values.length)
    throw Error("Duplicate checkpoint identity");
}
function state(w: World): unknown {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    gameId: w.definitions.manifest.gameId,
    rulesBuildId: w.identity.rulesBuildId,
    contentId: w.identity.contentId,
    scenarioId: w.scenarioId,
    initialPlayerSlots: w.initialPlayerSlots,
    tick: w.tick,
    levelId: w.levelId,
    status: w.status,
    actors: [...w.actors].sort((a, b) => a.id - b.id),
    platforms: [...w.platforms].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
    decoder: w.decoder,
    rng: w.rng,
    nextEntityId: w.nextEntityId,
    nextExecutionId: w.nextExecutionId,
    motionEpochCounter: w.motionEpochCounter,
    campaign: w.campaign,
  };
}
export function serializeCheckpoint(w: World): string {
  return canonical(state(w));
}
/** Decode a new owned world. The caller replaces its world only after this succeeds. */
export function restoreCheckpoint(
  definitions: GameDefinitions,
  identity: CompatibilityIdentity,
  json: string,
): World {
  const o = record(boundedJSON(json, 2097152, { rejectNegativeZero: true }), [
    "snapshotVersion",
    "gameId",
    "rulesBuildId",
    "contentId",
    "scenarioId",
    "initialPlayerSlots",
    "tick",
    "levelId",
    "status",
    "actors",
    "platforms",
    "decoder",
    "rng",
    "nextEntityId",
    "nextExecutionId",
    "motionEpochCounter",
    "campaign",
  ]);
  if (
    o.snapshotVersion !== SNAPSHOT_VERSION ||
    o.gameId !== definitions.manifest.gameId ||
    o.rulesBuildId !== identity.rulesBuildId ||
    o.contentId !== identity.contentId
  )
    throw Error("Checkpoint version/game/rules/content mismatch");
  const scenarioId = string(o.scenarioId),
    scenario = definitions.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw Error("Checkpoint scenario missing");
  const initialPlayerSlots = array(o.initialPlayerSlots, 4).map((v) =>
    integer(v, 0, 3),
  );
  if (canonical(initialPlayerSlots) !== canonical(scenario.playerSlots))
    throw Error("Checkpoint player identity mismatch");
  const tick = counter(o.tick),
    levelId = string(o.levelId),
    level = definitions.levels.find((l) => l.id === levelId);
  if (!level) throw Error("Checkpoint level missing");
  if (!["playing", "won", "lost"].includes(o.status as string))
    throw Error("Checkpoint status invalid");
  const actors: ActorState[] = array(o.actors, 256).map((v) => {
    const a = record(v, [
        "id",
        "spawnId",
        "archetypeId",
        "slot",
        "team",
        "x",
        "y",
        "vx",
        "vy",
        "facing",
        "health",
        "grounded",
        "coyoteTicks",
        "jumpBuffer",
        "attackBuffer",
        "bufferedAbility",
        "freezeTicks",
        "stunTicks",
        "motionEpoch",
        "riderId",
        "execution",
        "ai",
      ]),
      spawnId = string(a.spawnId),
      spawn = level.spawns.find((s) => s.id === spawnId),
      archetypeId = string(a.archetypeId),
      d = definitions.archetypes.find((d) => d.id === archetypeId);
    if (
      !spawn ||
      !d ||
      spawn.archetypeId !== archetypeId ||
      a.slot !== spawn.slot ||
      a.team !== spawn.team
    )
      throw Error("Checkpoint actor placement mismatch");
    const ai = record(a.ai, ["direction", "decisionTicks"]),
      attackBuffer = integer(a.attackBuffer, 0, d.attackBufferTicks),
      bufferedAbility =
        a.bufferedAbility === null ? null : string(a.bufferedAbility);
    if (
      (attackBuffer === 0) !== (bufferedAbility === null) ||
      (bufferedAbility !== null && !d.abilities.includes(bufferedAbility))
    )
      throw Error("Checkpoint attack buffer invalid");
    let execution: ActorState["execution"] = null;
    if (a.execution !== null) {
      const e = record(a.execution, ["id", "abilityId", "tick", "hits"]),
        abilityId = string(e.abilityId),
        ability = definitions.abilities.find((b) => b.id === abilityId);
      if (!ability || !d.abilities.includes(abilityId))
        throw Error("Checkpoint execution ability invalid");
      execution = {
        id: integer(e.id, 1, Number.MAX_SAFE_INTEGER),
        abilityId,
        tick: integer(
          e.tick,
          0,
          ability.startup + ability.active + ability.recovery - 1,
        ),
        hits: array(e.hits, 256).map((v) => {
          const h = record(v, ["targetId", "count", "lastTick"]);
          return {
            targetId: integer(h.targetId, 1, Number.MAX_SAFE_INTEGER),
            count: integer(h.count, 1, ability.maxHits),
            lastTick: integer(h.lastTick, 0, Math.max(0, tick - 1)),
          };
        }),
      };
      unique(execution.hits.map((h) => h.targetId));
      if (
        execution.hits.some(
          (h, i, items) => i > 0 && items[i - 1].targetId >= h.targetId,
        )
      )
        throw Error("Hit ledger ordering invalid");
      if (tick === 0 && execution.hits.length)
        throw Error("Hit ledger predates world");
    }
    return {
      id: integer(a.id, 1, Number.MAX_SAFE_INTEGER),
      spawnId,
      archetypeId,
      slot: spawn.slot,
      team: spawn.team,
      x: position(a.x),
      y: position(a.y),
      vx: integer(a.vx, -8192, 8192),
      vy: integer(a.vy, -8192, 8192),
      facing: direction(a.facing),
      health: integer(a.health, 0, d.health),
      grounded: boolean(a.grounded),
      coyoteTicks: integer(a.coyoteTicks, 0, d.coyoteTicks),
      jumpBuffer: integer(a.jumpBuffer, 0, d.jumpBufferTicks),
      attackBuffer,
      bufferedAbility,
      freezeTicks: integer(
        a.freezeTicks,
        0,
        Math.max(...definitions.abilities.map((a) => a.hitStopTicks)),
      ),
      stunTicks: integer(
        a.stunTicks,
        0,
        Math.max(...definitions.abilities.map((a) => a.stunTicks)),
      ),
      motionEpoch: integer(a.motionEpoch, 1, Number.MAX_SAFE_INTEGER),
      riderId: a.riderId === null ? null : string(a.riderId),
      execution,
      ai: {
        direction: direction(ai.direction),
        decisionTicks: counter(ai.decisionTicks),
      },
    };
  });
  unique(actors.map((a) => a.id));
  unique(actors.map((a) => a.spawnId));
  unique(actors.flatMap((a) => (a.execution ? [a.execution.id] : [])));
  if (actors.length !== level.spawns.length)
    throw Error("Checkpoint actor collection incomplete");
  if (actors.some((a, i) => i > 0 && actors[i - 1].id >= a.id))
    throw Error("Actor ordering invalid");
  for (const a of actors)
    if (
      a.execution?.hits.some(
        (h) =>
          h.targetId === a.id ||
          !actors.some((b) => b.id === h.targetId && b.team !== a.team),
      )
    )
      throw Error("Checkpoint hit target missing or invalid");
  const platforms = array(o.platforms, 32).map((v) => {
    const p = record(v, ["id", "x", "y", "direction", "blocked"]),
      id = string(p.id),
      d = level.platforms.find((p) => p.id === id);
    if (!d || p.y !== d.y) throw Error("Checkpoint platform missing");
    return {
      id,
      x: integer(p.x, Math.min(d.x, d.endX), Math.max(d.x, d.endX)),
      y: d.y,
      direction: direction(p.direction),
      blocked: boolean(p.blocked),
    };
  });
  unique(platforms.map((p) => p.id));
  if (platforms.length !== level.platforms.length)
    throw Error("Checkpoint platform collection incomplete");
  if (platforms.some((p, i) => i > 0 && platforms[i - 1].id >= p.id))
    throw Error("Platform ordering invalid");
  for (const a of actors)
    if (a.riderId !== null) {
      const p = platforms.find((p) => p.id === a.riderId),
        d = p && level.platforms.find((d) => d.id === p.id),
        b = body(
          a,
          definitions.archetypes.find((d) => d.id === a.archetypeId)!,
        );
      if (
        !p ||
        !d ||
        !a.grounded ||
        b.y + b.height !== p.y ||
        b.x >= p.x + d.width ||
        b.x + b.width <= p.x
      )
        throw Error("Checkpoint rider contact invalid");
    }
  const d = record(o.decoder, ["slots", "lastTick"]),
    slots = array(d.slots, 4).map((v) => {
      const s = record(v, ["held", "axes"]),
        h = record(s.held, ACTIONS),
        axes = record(s.axes, ["moveX"]);
      return {
        held: {
          left: boolean(h.left),
          right: boolean(h.right),
          jump: boolean(h.jump),
          attack: boolean(h.attack),
          heavy: boolean(h.heavy),
          guard: boolean(h.guard),
        },
        axes: { moveX: integer(axes.moveX, -127, 127) },
      };
    });
  if (slots.length !== 4 || d.lastTick !== tick - 1)
    throw Error("Checkpoint decoder tick/slots invalid");
  const c = record(o.campaign, ["visitedLevelIds", "defeatedPlacementIds"]),
    visitedLevelIds = array(c.visitedLevelIds, 64).map((v) => string(v)),
    defeatedPlacementIds = array(
      c.defeatedPlacementIds,
      MAX_DEFEATED_PLACEMENTS,
    ).map((v) => {
      if (typeof v !== "string" || v.length > 520)
        throw Error("Invalid durable placement tuple");
      return v;
    });
  unique(visitedLevelIds);
  unique(defeatedPlacementIds);
  if (
    !visitedLevelIds.includes(levelId) ||
    visitedLevelIds.some((id) => !definitions.levels.some((l) => l.id === id))
  )
    throw Error("Checkpoint campaign map invalid");
  if (
    defeatedPlacementIds.some(
      (id) =>
        !definitions.levels.some(
          (l) =>
            visitedLevelIds.includes(l.id) &&
            l.spawns.some((s) => JSON.stringify([l.id, s.id]) === id),
        ),
    )
  )
    throw Error("Checkpoint durable placement invalid");
  const nextEntityId = integer(o.nextEntityId, 1, Number.MAX_SAFE_INTEGER),
    nextExecutionId = integer(o.nextExecutionId, 1, Number.MAX_SAFE_INTEGER),
    motionEpochCounter = counter(o.motionEpochCounter);
  if (
    actors.some(
      (a) =>
        a.id >= nextEntityId ||
        a.motionEpoch > motionEpochCounter ||
        (a.execution && a.execution.id >= nextExecutionId),
    )
  )
    throw Error("Checkpoint monotonic counter invalid");
  const status = o.status as World["status"];
  const players = actors.filter(
    (a) => a.slot !== null && initialPlayerSlots.includes(a.slot),
  );
  if (
    (status === "playing" && players.some((a) => a.health === 0)) ||
    (status === "lost" && !players.some((a) => a.health === 0)) ||
    (status === "won" &&
      (level.goal.nextLevelId !== null ||
        !players.some(
          (a) =>
            a.health > 0 &&
            overlaps(
              body(
                a,
                definitions.archetypes.find((d) => d.id === a.archetypeId)!,
              ),
              level.goal,
            ),
        )))
  )
    throw Error("Checkpoint flow state invalid");
  const restored: World = {
    definitions,
    identity: { ...identity },
    scenarioId,
    initialPlayerSlots,
    tick,
    levelId,
    status,
    actors,
    platforms,
    decoder: { slots, lastTick: tick - 1 },
    rng: integer(o.rng, 0, 4294967295),
    nextEntityId,
    nextExecutionId,
    motionEpochCounter,
    campaign: { visitedLevelIds, defeatedPlacementIds },
    index: makeIndex(level),
  };
  for (const a of actors) {
    const d = definitions.archetypes.find((d) => d.id === a.archetypeId)!;
    if (a.health > 0 && embedded(restored, body(a, d)))
      throw Error("Checkpoint actor embedded in terrain");
    if (a.grounded) {
      const probe = { ...a };
      moveActor(restored, probe, 0, 0);
      if (!probe.grounded || probe.riderId !== a.riderId)
        throw Error("Checkpoint grounded contact invalid");
    }
    if (
      a.health > 0 &&
      defeatedPlacementIds.includes(JSON.stringify([levelId, a.spawnId]))
    )
      throw Error("Checkpoint defeated placement is alive");
    if (
      a.health === 0 &&
      !defeatedPlacementIds.includes(JSON.stringify([levelId, a.spawnId]))
    )
      throw Error("Checkpoint dead placement is missing its outcome");
    if (a.health === 0 && (a.grounded || a.riderId !== null))
      throw Error("Checkpoint dead actor retains contact");
    if (a.stunTicks > 0 && a.execution !== null)
      throw Error("Checkpoint stunned actor retains execution");
  }
  // Safe exhausted states remain importable so every committed checkpoint can
  // round-trip. A later step rejects exhaustion before consuming input/state.
  return restored;
}
/** First structural difference, used only for exact-byte mismatch diagnostics. */
export function firstDifference(left: string, right: string): string | null {
  if (left === right) return null;
  const a = boundedJSON(left),
    b = boundedJSON(right);
  function visit(x: unknown, y: unknown, path: string): string | null {
    if (x === y) return null;
    if (
      x === null ||
      y === null ||
      typeof x !== "object" ||
      typeof y !== "object" ||
      Array.isArray(x) !== Array.isArray(y)
    )
      return path || "/";
    const xo = x as Record<string, unknown>,
      yo = y as Record<string, unknown>;
    for (const k of [
      ...new Set([...Object.keys(xo), ...Object.keys(yo)]),
    ].sort()) {
      if (!Object.hasOwn(xo, k) || !Object.hasOwn(yo, k)) return `${path}/${k}`;
      const result = visit(xo[k], yo[k], `${path}/${k}`);
      if (result) return result;
    }
    return null;
  }
  return visit(a, b, "") ?? "/canonical-order";
}
