import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
async function waitUntil(predicate,timeout=3000) {const until=Date.now()+timeout;while(!predicate()){if(Date.now()>until)throw Error('Timed out waiting for validation.');await new Promise(done=>setTimeout(done,20));}}
import { selfTest,inspectSource,checkModuleGraph } from '../../scripts/check-sim-purity.mjs';
import { compareCanonical,firstDifference,loadGame } from '../../scripts/lib/game-tools.mjs';
import { boundedJSON } from '../../scripts/lib/game-json.mjs';

test('purity fixtures include unused helper dependencies before tree shaking',async()=>{assert.deepEqual(await selfTest(),[]);});
test('purity diagnostics distinguish inert syntax and computed/global escapes',async()=>{
  assert.deepEqual(await inspectSource('const label="window Math.random"; // Date.now()\nexport const n=Math.floor(1);','clean.ts'),[]);
  for(const source of ['const x=globalThis["Date"];','const {random}=Math;','const x=Math["min"](1,2);','const f=Math.abs;','export const x=import("./helper");','const p=Promise.resolve(1);','export const x=Math.sin(1);']) assert.ok((await inspectSource(source,'bad.ts')).length>0,source);
});
test('metafile rejects helpers outside the explicitly reviewed boundary',async()=>{
  const dir=await mkdtemp(resolve(tmpdir(),'game-purity-'));
  try {
    await writeFile(resolve(dir,'entry.ts'),'import { x } from "./helper"; export const a=x;');
    await writeFile(resolve(dir,'helper.ts'),'export const x=1;');
    const result=await checkModuleGraph({entryPoints:[resolve(dir,'entry.ts')],allowedRoots:[],allowedFiles:[resolve(dir,'entry.ts')]});
    assert.ok(result.diagnostics.some(d=>d.code==='GAME_PURITY_IMPORT'&&d.file.endsWith('helper.ts')));
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('first complete canonical difference uses escaped JSON pointers',()=>{
  assert.equal(compareCanonical('{"actors":[{"hp":2}]}','{"actors":[{"hp":1}]}'),'/actors/0/hp');
  assert.equal(firstDifference({'a/b':{'~x':1}},{'a/b':{'~x':2}}),'/a~1b/~0x');
  assert.equal(compareCanonical('{"a":1}','{ "a":1}'),'/@canonicalBytes');
  assert.equal(compareCanonical('{"a":1}','{"a":1}'),null);
});
test('source JSON is bounded before parse; strings do not count toward nesting',()=>{
  assert.deepEqual(boundedJSON('{"text":"[[[[{{{\\\""}'),{text:'[[[[{{{"'});
  assert.throws(()=>boundedJSON('['.repeat(33)+'0'+']'.repeat(33)),/nesting/);
  assert.throws(()=>boundedJSON('"'+'x'.repeat(2*1024*1024)+'"'),/2 MiB/);
});
test('Node loads the authoritative simulation without DOM and identity is real SHA-256',async()=>{
  assert.equal(typeof globalThis.document,'undefined');
  const game=await loadGame();
  assert.match(game.identity.rulesBuildId,/^sha256:[0-9a-f]{64}$/);
  assert.match(game.identity.contentId,/^sha256:[0-9a-f]{64}$/);
  assert.equal(typeof game.simulation.createWorld,'function');
  const bundled=await loadGame(resolve('examples/game-m1/definitions.json'));
  assert.deepEqual(bundled.definitions,game.definitions);
  assert.deepEqual(bundled.identity,game.identity);
});

test('document stable IDs survive renames and duplicate IDs or escaping symlinks fail',async()=>{
  const {cp,rename,symlink}=await import('node:fs/promises');
  const dir=await mkdtemp(resolve(tmpdir(),'game-documents-'));
  try {
    await cp(resolve('examples/game-m1'),dir,{recursive:true});
    const original=await loadGame(resolve(dir,'game.project.json'));
    const first=original.definitions.levels[0].id;
    await rename(resolve(dir,'levels',`${first}.json`),resolve(dir,'levels','renamed-source.json'));
    const renamed=await loadGame(resolve(dir,'game.project.json'));
    assert.deepEqual(renamed.identity,original.identity);
    await cp(resolve(dir,'levels','renamed-source.json'),resolve(dir,'levels','duplicate.json'));
    await assert.rejects(loadGame(resolve(dir,'game.project.json')),error=>error.diagnostics?.some(d=>d.code==='GAME_DOCUMENT_ID_DUPLICATE'));
    await rm(resolve(dir,'levels','duplicate.json'));
    await symlink(resolve('examples/game-m1/levels',`${first}.json`),resolve(dir,'levels','outside.json'));
    await assert.rejects(loadGame(resolve(dir,'game.project.json')),error=>error.diagnostics?.some(d=>d.code==='GAME_DOCUMENT_PATH'));
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('dev validation debounces writes and retains the last valid runnable module',async()=>{
  const {cp}=await import('node:fs/promises');
  const {gameDevPlugin}=await import('../../scripts/game-dev-plugin.mjs');
  const dir=await mkdtemp(resolve(tmpdir(),'game-dev-validation-'));
  try {
    await cp(resolve('examples/game-m1'),dir,{recursive:true});
    const file=resolve(dir,'game.project.json'),valid=await readFile(file,'utf8');
    const plugin=gameDevPlugin({projectFile:file}),messages=[];
    await plugin.config();
    const initial=plugin.load('\0virtual:game-definitions');
    let endpoint;
    plugin.configureServer({watcher:{add(){}},middlewares:{use(_path,fn){endpoint=fn;}},moduleGraph:{getModuleById(){},invalidateAll(){}},ws:{send(m){messages.push(m);}},config:{logger:{error(){},info(){}}}});
    for(const name of ['objective.test.ts','fixture.spec.ts','README.md']) assert.equal(plugin.hotUpdate({file:resolve('packages/game-simulation/src',name)}),undefined);
    await writeFile(file,'{"schemaVersion":');
    plugin.hotUpdate({file});
    await waitUntil(()=>messages.some(m=>m.event==='game:diagnostics'&&m.data.diagnostics.length));
    assert.equal(plugin.load('\0virtual:game-definitions'),initial);
    assert.ok(messages.some(m=>m.event==='game:diagnostics'&&m.data.diagnostics.length));
    let response;
    endpoint({}, {setHeader(){},end(body){response=JSON.parse(body);}});
    assert.equal(response.ok,false);
    messages.length=0;
    await writeFile(file,valid);
    plugin.hotUpdate({file});
    plugin.hotUpdate({file});
    await waitUntil(()=>messages.some(m=>m.event==='game:restart'));
    assert.equal(messages.filter(m=>m.event==='game:restart').length,1);
    endpoint({}, {setHeader(){},end(body){response=JSON.parse(body);}});
    assert.equal(response.ok,true);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('CLI scenario, usage and first-difference exit contracts are stable',async()=>{
  const {spawnSync}=await import('node:child_process');
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
  assert.equal(run('scripts/game-validate.mjs','--unknown','x').status,2);
  const unknown=run('scripts/game-scenario-run.mjs','--scenario','missing');
  assert.equal(unknown.status,1);
  assert.equal(JSON.parse(unknown.stderr).code,'GAME_SCENARIO_UNKNOWN');
  const named=run('scripts/game-scenario-run.mjs','--scenario','second-room','--ticks','3');
  assert.equal(named.status,0);
  assert.equal(JSON.parse(named.stdout).scenarioId,'second-room');
  const game=await loadGame();
  const expected=game.simulation.runReplayFixture(game.definitions,game.identity,3);
  const state=JSON.parse(expected.final);state.actors[0].health--;
  expected.final=JSON.stringify(state);
  const dir=await mkdtemp(resolve(tmpdir(),'game-cli-evidence-'));
  try {
    const file=resolve(dir,'expected.json');await writeFile(file,JSON.stringify(expected));
    const result=run('scripts/game-replay-verify.mjs','--ticks','3','--expected',file);
    assert.equal(result.status,3);
    const message=JSON.parse(result.stderr);
    assert.equal(message.code,'GAME_REPLAY_DIVERGENCE');
    assert.equal(message.jsonPointer,'/actors/0/health');
    assert.deepEqual(Object.keys(message).sort(),['code','severity','file','jsonPointer','message','repair'].sort());
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('imported semantic replay validates compatibility and ordered persistent transitions',async()=>{
  const {runInputReplay}=await import('../../scripts/lib/game-tools.mjs');
  const game=await loadGame();
  const world=game.simulation.createWorld(game.definitions,game.identity);
  const record={tick:0,slot:0,sequence:0,heldPatch:{right:true},edges:[{action:'right',kind:'pressed'}]};
  const decoder=game.simulation.createInputDecoder();
  for(let tick=0;tick<3;tick++) game.simulation.step(world,game.simulation.decodeInputRecords(decoder,tick,tick===0?[record]:[]));
  const bytes=game.simulation.serializeCheckpoint(world);
  const artifact={snapshotVersion:1,gameId:game.definitions.manifest.gameId,...game.identity,scenarioId:game.definitions.manifest.initialScenarioId,initialCheckpoint:null,ticks:3,records:[record],checkpoints:[{tick:3,bytes}]};
  assert.equal(runInputReplay(game,artifact).final,bytes);
  assert.throws(()=>runInputReplay(game,{...artifact,rulesBuildId:'edited'}),error=>error.diagnostics?.[0].code==='GAME_REPLAY_IDENTITY');
  assert.throws(()=>runInputReplay(game,{...artifact,records:[{...record,heldPatch:{right:false}}]}),/Held patch disagrees/);
  const dir=await mkdtemp(resolve(tmpdir(),'game-input-replay-'));
  try {
    const file=resolve(dir,'replay.json');await writeFile(file,JSON.stringify(artifact));
    const {spawnSync}=await import('node:child_process');
    const result=spawnSync(process.execPath,['scripts/game-replay-verify.mjs','--replay',file],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).checkpoints,1);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('authoring diagnostics identify the renamed source file and local JSON pointer',async()=>{
  const {cp,rename}=await import('node:fs/promises');
  const dir=await mkdtemp(resolve(tmpdir(),'game-diagnostic-path-'));
  try {
    await cp(resolve('examples/game-m1'),dir,{recursive:true});
    const game=await loadGame(resolve(dir,'game.project.json'));
    const id=game.definitions.levels[0].id;
    const old=resolve(dir,'levels',`${id}.json`),file=resolve(dir,'levels','my-authored-room.json');
    await rename(old,file);
    const raw=JSON.parse(await readFile(file,'utf8'));raw.platforms[0].speed=1.5;
    await writeFile(file,JSON.stringify(raw));
    await assert.rejects(loadGame(resolve(dir,'game.project.json')),error=>{
      const diagnostic=error.diagnostics?.[0];
      assert.equal(diagnostic.file,file);
      assert.match(diagnostic.jsonPointer,/^\/platforms\/0/);
      return true;
    });
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('purity rejects constructor, locale and host metadata variants without inspecting inert strings',async()=>{
  const sources=[
    'export const n=[].constructor.constructor("return Date.now()")();',
    'export const n=__proto__.constructor;',
    'const key="con"+"structor";export const n=[][key][key]("return 1")();',
    'const {constructor: f}=()=>{};export const n=f("return 1");',
    'export const n=new Intl.DateTimeFormat().format(0);',
    'export const n="a"["localeCompare"]("b");',
    'const key=`toLocaleString`;export const n=(1)[key]();',
    'export const n=import.meta.url;',
  ];
  for(const source of sources) assert.ok((await inspectSource(source,'rules.ts')).length>0,source);
  assert.deepEqual(await inspectSource('export const names=["constructor","localeCompare","Intl","import.meta"]; // [].constructor\n','strings.ts'),[]);
});

test('reviewed source identity ignores compiler output while actual shipping artifact identity covers bytes',async()=>{
  const {fingerprintRulesSources,buildArtifactManifest,RULES_CONTRACT}=await import('../../scripts/lib/game-identity.mjs');
  const sources=[{path:'b.ts',source:'export const b=2;\r\n'},{path:'a.ts',source:'export const a=1;\n'}];
  const rulesBuildId=fingerprintRulesSources(sources),identity={rulesBuildId,contentId:'sha256:content'};
  assert.equal(fingerprintRulesSources([...sources].reverse()),rulesBuildId);
  assert.equal(fingerprintRulesSources(sources.map(s=>({...s,source:s.source.replaceAll('\r\n','\n')}))),rulesBuildId);
  assert.notEqual(fingerprintRulesSources([{...sources[0],source:'export const b=3;'},sources[1]]),rulesBuildId);
  assert.notEqual(fingerprintRulesSources([{...sources[0],path:'renamed.ts'},sources[1]]),rulesBuildId);
  assert.notEqual(fingerprintRulesSources(sources,{...RULES_CONTRACT,languageTarget:'future'}),rulesBuildId);
  const bundle={js:{fileName:'game.js',type:'chunk',code:'const actual=1;'},html:{fileName:'index.html',type:'asset',source:'<!doctype html>'}};
  const first=buildArtifactManifest(bundle,identity,{esbuild:'old'}),second=buildArtifactManifest(bundle,identity,{esbuild:'new'});
  assert.equal(first.identity.rulesBuildId,second.identity.rulesBuildId);
  assert.equal(first.artifactSetId,second.artifactSetId);
  const changed=buildArtifactManifest({...bundle,js:{...bundle.js,code:'const actual=2;'}},identity,{esbuild:'new'});
  assert.notEqual(first.artifactSetId,changed.artifactSetId);
  const {createHash}=await import('node:crypto');
  assert.equal(first.artifacts.find(a=>a.path==='game.js').sha256,createHash('sha256').update(bundle.js.code).digest('hex'));
});

test('bounded file reader rejects oversized sparse files, invalid UTF-8 and single-file symlink escapes',async()=>{
  const {readBoundedSource}=await import('../../scripts/lib/game-files.mjs');
  const {open,symlink}=await import('node:fs/promises');
  const dir=await mkdtemp(resolve(tmpdir(),'game-bounded-read-'));
  try {
    const huge=resolve(dir,'large.json'),handle=await open(huge,'w');await handle.truncate(128*1024*1024);await handle.close();
    await assert.rejects(readBoundedSource(huge,{root:dir,maxBytes:1024}),error=>error.diagnostics?.[0].code==='GAME_DOCUMENT_SIZE');
    const invalid=resolve(dir,'utf8.json');await writeFile(invalid,Buffer.from([0x22,0xff,0x22]));
    await assert.rejects(readBoundedSource(invalid,{root:dir}),error=>error.diagnostics?.[0].code==='GAME_DOCUMENT_UTF8');
    const single=resolve(dir,'definitions.json');await symlink(resolve('examples/game-m1/definitions.json'),single);
    await assert.rejects(loadGame(single),error=>error.diagnostics?.[0].code==='GAME_DOCUMENT_PATH');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('named scenario runner compares bounded structural values and applies authored restart commands',async()=>{
  const {runNamedScenario}=await import('../../scripts/lib/game-tools.mjs');
  const game=await loadGame();
  const id='structural-tool-test',levelId=game.definitions.manifest.initialLevelId;
  const initial=game.simulation.createWorld(game.definitions,game.identity);
  const actorId=initial.nextEntityId;
  const scenario={id,levelId,seed:1,playerSlots:[0],ticks:2,actions:[],commands:[{tick:1,type:'restart'}],assertions:[
    {tick:0,path:'/campaign',equals:{visitedLevelIds:[levelId],defeatedPlacementIds:[]}},
    {tick:0,path:'/actors/0/execution',equals:null},
    {tick:2,path:'/actors/0/id',equals:actorId},
  ]};
  const definitions={...game.definitions,scenarios:[...game.definitions.scenarios,scenario]};
  assert.equal(runNamedScenario({...game,definitions},id).assertions,3);
  const wrong={...scenario,assertions:[{tick:0,path:'/campaign',equals:{visitedLevelIds:['wrong'],defeatedPlacementIds:[]}}]};
  assert.throws(()=>runNamedScenario({...game,definitions:{...definitions,scenarios:[...game.definitions.scenarios,wrong]}},id),error=>error.diagnostics?.[0].jsonPointer==='/campaign/visitedLevelIds/0');
});

test('dev watcher revalidates rename/create/delete transactions and removes listeners on close',async()=>{
  const {cp,rename}=await import('node:fs/promises');
  const {EventEmitter}=await import('node:events');
  const {gameDevPlugin}=await import('../../scripts/game-dev-plugin.mjs');
  const dir=await mkdtemp(resolve(tmpdir(),'game-dev-file-events-'));
  const messages=[];
  const watcher=new EventEmitter();watcher.add=()=>{};
  const httpServer=new EventEmitter();
  try {
    await cp(resolve('examples/game-m1'),dir,{recursive:true});
    const manifest=resolve(dir,'game.project.json'),plugin=gameDevPlugin({projectFile:manifest});
    await plugin.config();
    plugin.configureServer({watcher,httpServer,middlewares:{use(){}},moduleGraph:{getModuleById(){},invalidateAll(){}},ws:{send(m){messages.push(m);}},config:{logger:{error(){},info(){}}}});
    const initial=plugin.load('\0virtual:game-definitions');
    const game=await loadGame(manifest),id=game.definitions.levels[0].id;
    const original=resolve(dir,'levels',`${id}.json`),renamed=resolve(dir,'levels','my-renamed-source.json');
    const source=await readFile(original,'utf8');
    await rename(original,renamed);watcher.emit('unlink',original);watcher.emit('add',renamed);
    await waitUntil(()=>messages.some(m=>m.event==='game:restart'));
    assert.equal(plugin.load('\0virtual:game-definitions'),initial);
    messages.length=0;
    await rm(renamed);watcher.emit('unlink',renamed);
    await waitUntil(()=>messages.some(m=>m.event==='game:diagnostics'&&m.data.diagnostics.length));
    assert.equal(messages.filter(m=>m.event==='game:restart').length,0);
    assert.equal(plugin.load('\0virtual:game-definitions'),initial);
    messages.length=0;
    await writeFile(renamed,source);watcher.emit('add',renamed);
    await waitUntil(()=>messages.some(m=>m.event==='game:restart'));
    messages.length=0;
    const newFile=resolve(dir,'levels','new-map.json'),newLevel={...JSON.parse(source),id:'added-map'};
    await writeFile(newFile,JSON.stringify(newLevel));watcher.emit('add',newFile);
    await waitUntil(()=>messages.some(m=>m.event==='game:diagnostics'&&m.data.diagnostics.some(d=>d.code==='GAME_DOCUMENT_UNREFERENCED')));
    const rawManifest=JSON.parse(await readFile(manifest,'utf8'));rawManifest.levelIds.push('added-map');
    await writeFile(manifest,JSON.stringify(rawManifest));plugin.hotUpdate({file:manifest,type:'update'});
    await waitUntil(()=>messages.some(m=>m.event==='game:restart'));
    assert.match(plugin.load('\0virtual:game-definitions'),/added-map/);
    assert.equal(watcher.listenerCount('add'),1);assert.equal(watcher.listenerCount('unlink'),1);
    httpServer.emit('close');assert.equal(watcher.listenerCount('add'),0);assert.equal(watcher.listenerCount('unlink'),0);
    assert.equal(plugin.hotUpdate({file:manifest,type:'delete'}),undefined);
  } finally {httpServer.emit('close');await rm(dir,{recursive:true,force:true});}
});

test('loader enforces aggregate byte/schema caps and rejects duplicate decoded keys before validation',async()=>{
  const {cp}=await import('node:fs/promises');
  const dir=await mkdtemp(resolve(tmpdir(),'game-source-caps-'));
  try {
    await cp(resolve('examples/game-m1'),dir,{recursive:true});
    const manifest=resolve(dir,'game.project.json'),source=await readFile(manifest,'utf8');
    await writeFile(manifest,source.replace('"schemaVersion": 1','"schemaVersion": 1, "schemaVersion": 1'));
    await assert.rejects(loadGame(manifest),error=>error.diagnostics?.[0].code==='GAME_JSON_PARSE'&&/Duplicate/.test(error.diagnostics[0].message));
    const raw=JSON.parse(source);raw.levelIds=Array.from({length:65},(_,i)=>`level-${i}`);
    await writeFile(manifest,JSON.stringify(raw));
    await assert.rejects(loadGame(manifest),error=>error.diagnostics?.[0].code==='GAME_MANIFEST_REFERENCES'&&error.diagnostics[0].jsonPointer==='/levelIds');
    await writeFile(manifest,source);
    for(let i=0;i<12;i++)await writeFile(resolve(dir,'levels',`zz-padding-${i}.json`),JSON.stringify({id:`padding-${i}`})+' '.repeat(1500000));
    await assert.rejects(loadGame(manifest),error=>error.diagnostics?.[0].code==='GAME_DOCUMENT_SIZE');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('bounded reader rejects an atomic path replacement between its first and final read',async()=>{
  const {readBoundedSource}=await import('../../scripts/lib/game-files.mjs');
  const {open,rename}=await import('node:fs/promises');
  const dir=await mkdtemp(resolve(tmpdir(),'game-atomic-read-'));
  const file=resolve(dir,'source.json'),replacement=resolve(dir,'replacement.json');
  await writeFile(file,'"'+'a'.repeat(130000)+'"');
  await writeFile(replacement,'"'+'b'.repeat(130000)+'"');
  const sample=await open(file,'r'),prototype=Object.getPrototypeOf(sample),originalRead=prototype.read;
  await sample.close();
  let replaced=false;
  prototype.read=async function(...args) {
    const result=await originalRead.apply(this,args);
    if(!replaced&&result.bytesRead>0){replaced=true;await rename(replacement,file);}
    return result;
  };
  try {
    await assert.rejects(readBoundedSource(file,{root:dir}),error=>error.diagnostics?.[0].code==='GAME_DOCUMENT_CHANGED');
    assert.equal(replaced,true);
  } finally {prototype.read=originalRead;await rm(dir,{recursive:true,force:true});}
});
