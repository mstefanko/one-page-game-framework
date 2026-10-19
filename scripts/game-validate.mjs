import { loadGame,parseArguments,reportError } from './lib/game-tools.mjs';
try {
  const options=parseArguments(process.argv.slice(2));
  const game=await loadGame(options.project);
  console.log(JSON.stringify({ok:true,identity:game.identity,diagnostics:[]}));
} catch(error) {reportError(error);}
