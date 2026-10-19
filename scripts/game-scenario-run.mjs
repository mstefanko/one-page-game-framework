import { loadGame,parseArguments,reportError,diagnostic,runNamedScenario } from './lib/game-tools.mjs';
try {
  const options=parseArguments(process.argv.slice(2),['project','scenario','ticks']);
  const game=await loadGame(options.project);
  const ticks=Number(options.ticks??10000);
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>200000) throw {diagnostics:[diagnostic('GAME_TICK_LIMIT','Ticks must be an integer from 1 through 200000.')]};
  const result=runNamedScenario(game,options.scenario??game.definitions.manifest.initialScenarioId,options.ticks?ticks:undefined);
  console.log(JSON.stringify({ok:true,identity:game.identity,...result}));
} catch(error) {reportError(error);}
