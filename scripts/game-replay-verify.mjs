import { readBoundedJSON } from './lib/game-files.mjs';
import { loadGame,parseArguments,reportError,compareCanonical,diagnostic,EXIT,runInputReplay } from './lib/game-tools.mjs';
try {
  const options=parseArguments(process.argv.slice(2),['project','expected','ticks','replay']);
  if(options.replay&&options.expected) throw Object.assign(new Error('Use --replay or --expected per verification run.'),{usage:true});
  const game=await loadGame(options.project);
  const ticks=Number(options.ticks??10000);
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>200000) throw {diagnostics:[diagnostic('GAME_TICK_LIMIT','Ticks must be an integer from 1 through 200000.')]};
  const replay=options.replay?await readBoundedJSON(options.replay,16*1024*1024,game.project.boundedJSON):null;
  const actual=replay?runInputReplay(game,replay):game.simulation.runReplayFixture(game.definitions,game.identity,ticks);
  const expected=replay?{checkpoints:replay.checkpoints,final:actual.final}:options.expected?await readBoundedJSON(options.expected,16*1024*1024,game.project.boundedJSON):game.simulation.runReplayFixture(game.definitions,game.identity,ticks);
  const wanted=expected.checkpoints ?? expected.result?.checkpoints;
  if(!Array.isArray(wanted)) throw new Error('Expected artifact needs canonical checkpoints.');
  let divergence=null;
  for(let i=0;i<Math.max(wanted.length,actual.checkpoints.length);i++) {
    const path=compareCanonical(wanted[i]?.bytes??wanted[i]??'null',actual.checkpoints[i]?.bytes??actual.checkpoints[i]??'null');
    if(path) {divergence={checkpoint:i,jsonPointer:path};break;}
  }
  if(!divergence) {const path=compareCanonical(expected.final??expected.result?.final,actual.final);if(path) divergence={checkpoint:'final',jsonPointer:path};}
  if(divergence) {console.error(JSON.stringify(diagnostic('GAME_REPLAY_DIVERGENCE',`Canonical replay differs at checkpoint ${divergence.checkpoint}.`,{jsonPointer:divergence.jsonPointer,repair:'Reproduce with the same build/content and inspect the first differing component.'})));process.exitCode=EXIT.divergence;}
  else console.log(JSON.stringify({ok:true,ticks:replay?.ticks??ticks,checkpoints:actual.checkpoints.length,identity:game.identity}));
} catch(error) {reportError(error);}
