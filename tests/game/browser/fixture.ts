import * as simulation from '../../../packages/game-simulation/src/index';
import type { GameDefinitions,CompatibilityIdentity } from '../../../packages/game-project/src/types';
declare const __GAME_FIXTURE_DEFINITIONS__:GameDefinitions;
declare const __GAME_FIXTURE_IDENTITY__:CompatibilityIdentity;
// This file is bundled only into dist-game-fixture, never the shipping player.
Object.assign(window,{__GAME_FIXTURE__:{
  run(ticks=10000,schedule:number[]=[1]){return simulation.runReplayFixture(__GAME_FIXTURE_DEFINITIONS__,__GAME_FIXTURE_IDENTITY__,ticks,schedule);},
  identity:__GAME_FIXTURE_IDENTITY__,
}});
