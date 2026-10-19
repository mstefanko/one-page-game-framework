import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { loadGame } from './lib/game-tools.mjs';

// Initial M1 trend only. Snapshots, content loading, and log generation are not timed.
const game = await loadGame();
const warmup = 2000;
const measured = 10000;
const records = game.simulation.createReplayFixtureRecords(warmup + measured);
const decoder = game.simulation.createInputDecoder();
const frames = [];
let cursor = 0;
for (let tick = 0; tick < warmup + measured; tick++) {
  const batch = [];
  while (records[cursor]?.tick === tick) batch.push(records[cursor++]);
  const frame = game.simulation.decodeInputRecords(decoder, tick, batch);
  if (tick > 0 && tick % 300 === 0) frame.commands = [{type:'restart'}];
  frames.push(frame);
}
const runs = [];
for (let run = 0; run < 5; run++) {
  const world = game.simulation.createWorld(game.definitions, game.identity);
  const samples = [];
  let playingTicks = 0;
  let maxActors = 0;
  for (let tick = 0; tick < frames.length; tick++) {
    const start = performance.now();
    game.simulation.step(world, frames[tick]);
    const elapsed = performance.now() - start;
    if (tick >= warmup) {
      samples.push(elapsed);
      playingTicks += Number(world.status === 'playing');
      maxActors = Math.max(maxActors, world.actors.length);
    }
  }
  samples.sort((a,b)=>a-b);
  runs.push({run:run+1,playingTicks,maxActors,p50ms:samples[Math.floor(samples.length*0.5)],p95ms:samples[Math.floor(samples.length*0.95)],maxMs:samples.at(-1)});
}
console.log(JSON.stringify({scope:'M1 small fixture; trend, not the 40/20 or 100/100 release gate',environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},warmupTicks:warmup,measuredTicks:measured,identity:game.identity,runs},null,2));
