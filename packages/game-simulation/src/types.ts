import type {
  CompatibilityIdentity,
  DecoderState,
  GameDefinitions,
  Rect,
} from "../../game-project/src/runtime";
export interface HitLedger {
  targetId: number;
  count: number;
  lastTick: number;
}
export interface Execution {
  id: number;
  abilityId: string;
  tick: number;
  hits: HitLedger[];
}
export interface ActorState {
  id: number;
  spawnId: string;
  archetypeId: string;
  slot: number | null;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  health: number;
  grounded: boolean;
  coyoteTicks: number;
  jumpBuffer: number;
  attackBuffer: number;
  bufferedAbility: string | null;
  freezeTicks: number;
  stunTicks: number;
  motionEpoch: number;
  riderId: string | null;
  execution: Execution | null;
  ai: { direction: -1 | 1; decisionTicks: number };
}
export interface PlatformState {
  id: string;
  x: number;
  y: number;
  direction: -1 | 1;
  blocked: boolean;
}
export interface Collider extends Rect {
  id: string;
  oneWay: boolean;
}
export interface SpatialIndex {
  buckets: Map<string, Collider[]>;
}
export interface CampaignState {
  visitedLevelIds: string[];
  defeatedPlacementIds: string[];
}
export interface World {
  definitions: GameDefinitions;
  identity: CompatibilityIdentity;
  scenarioId: string;
  initialPlayerSlots: number[];
  tick: number;
  levelId: string;
  status: "playing" | "won" | "lost";
  actors: ActorState[];
  platforms: PlatformState[];
  decoder: DecoderState;
  rng: number;
  nextEntityId: number;
  nextExecutionId: number;
  motionEpochCounter: number;
  campaign: CampaignState;
  index: SpatialIndex;
}
export type TickEvent = {
  type:
    | "jump"
    | "strike"
    | "hit"
    | "guard"
    | "death"
    | "goal"
    | "level"
    | "restart"
    | "platform-blocked";
  tick: number;
  actorId?: number;
  targetId?: number;
  abilityId?: string;
  levelId?: string;
  platformId?: string;
};
export interface ActorObservation {
  id: number;
  spawnId: string;
  archetypeId: string;
  slot: number | null;
  team: number;
  x: number;
  y: number;
  width: number;
  height: number;
  facing: -1 | 1;
  health: number;
  maxHealth: number;
  freezeTicks: number;
  stunTicks: number;
  motionEpoch: number;
  abilityId: string | null;
  abilityTick: number;
  grounded: boolean;
  hurt: Rect;
  push: Rect;
  hit: Rect | null;
}
export interface Observation {
  tick: number;
  levelId: string;
  status: World["status"];
  actors: readonly ActorObservation[];
  platforms: readonly (PlatformState & { width: number; height: number })[];
  goal: Rect & { nextLevelId: string | null };
  campaign: CampaignState;
}
