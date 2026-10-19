import { resolve,dirname } from 'node:path';
import { loadGame,diagnostic } from './lib/game-tools.mjs';
import { gameRoot,compilerProvenance,buildArtifactManifest } from './lib/game-identity.mjs';
import { checkSimulationPurity } from './check-sim-purity.mjs';

/** Debounced, generation-checked validation preserves the mounted last valid scene for partial writes. */
export function gameDevPlugin({projectFile=resolve(gameRoot,'examples/game-m1/game.project.json')}={}) {
  let current,timer,server;
  let generation=0,closed=false;
  let diagnostics=[],rulesChanged=false;
  const virtuals=new Map([['virtual:game-definitions','\0virtual:game-definitions'],['virtual:game-identity','\0virtual:game-identity']]);
  const roots=[dirname(projectFile),resolve(gameRoot,'packages/game-simulation/src'),resolve(gameRoot,'packages/game-project/src')];
  const relevant=file=>!(/\.(?:test|spec)\.[^.]+$|\.md$/i.test(file))&&roots.some(root=>file.startsWith(root+'/'));
  const read=async()=>{const result=await checkSimulationPurity();if(result.diagnostics.length)throw {diagnostics:result.diagnostics};return loadGame(projectFile);};
  function schedule(file) {
    file=resolve(file);
    if(closed||!relevant(file)) return false;
    clearTimeout(timer);
    const version=++generation;
    rulesChanged ||= !file.endsWith('.json');
    timer=setTimeout(async()=>{
      try {
        const next=await read();
        if(closed||version!==generation) return;
        current=next;diagnostics=[];
        for(const id of virtuals.values()) {const module=server.moduleGraph.getModuleById(id);if(module)server.moduleGraph.invalidateModule(module);}
        server.ws.send({type:'custom',event:'game:diagnostics',data:{diagnostics:[]}});
        if(rulesChanged) {
          rulesChanged=false;server.moduleGraph.invalidateAll();server.ws.send({type:'full-reload',path:'*'});
          server.config.logger.info('Validated game rules changed; reloading the named scenario with the new reviewed rules source.');return;
        }
        server.ws.send({type:'custom',event:'game:restart',data:{definitions:current.definitions,identity:current.identity,reason:`Validated ${file.slice(gameRoot.length+1)} changed; restarting the named scenario.`}});
      } catch(error) {
        if(closed||version!==generation)return;
        diagnostics=error.diagnostics??[diagnostic('GAME_VALIDATION_FAILURE',error.message,{file})];
        server.ws.send({type:'custom',event:'game:diagnostics',data:{diagnostics}});
        for(const item of diagnostics)server.config.logger.error(`${item.file||file}${item.jsonPointer}: ${item.code} ${item.message}`);
      }
    },150);
    return true;
  }
  return {
    name:'game-validated-content',
    async config(){current=await read();return {build:{target:'es2022'}};},
    generateBundle:{order:'post',async handler(_options,bundle){
      const manifest=buildArtifactManifest(bundle,current.identity,await compilerProvenance());
      this.emitFile({type:'asset',fileName:'game-build-manifest.json',source:JSON.stringify(manifest,null,2)+'\n'});
    }},
    resolveId(id){return virtuals.get(id);},
    load(id){
      if(id===virtuals.get('virtual:game-definitions'))return `export default ${JSON.stringify(current.definitions)};`;
      if(id===virtuals.get('virtual:game-identity'))return `export default ${JSON.stringify(current.identity)};`;
    },
    configureServer(value){
      server=value;closed=false;server.watcher.add(roots);
      // Vite's modern hook covers create/update/delete; watch events also include unimported JSON.
      const onAdd=file=>schedule(file),onUnlink=file=>schedule(file);
      server.watcher.on?.('add',onAdd);server.watcher.on?.('unlink',onUnlink);
      server.middlewares.use('/__game/validation',(_request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:diagnostics.length===0,identity:current.identity,diagnostics}));});
      server.httpServer?.once('close',()=>{closed=true;generation++;clearTimeout(timer);server.watcher.off?.('add',onAdd);server.watcher.off?.('unlink',onUnlink);});
    },
    hotUpdate(context){if(schedule(context.file))return [];},
  };
}
