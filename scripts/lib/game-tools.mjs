import { build } from 'esbuild';
import { readdir,realpath } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { readBoundedSource } from './game-files.mjs';
import { gameRoot,computeGameIdentity } from './game-identity.mjs';
export const EXIT={ok:0,validation:1,usage:2,divergence:3};
export function diagnostic(code,message,{file='',jsonPointer='',repair='Correct the indicated value and retry.'}={}) {return {code,severity:'error',file,jsonPointer,message,repair};}
export async function loadGameModules() {
  const result=await build({absWorkingDir:gameRoot,stdin:{contents:"export * as project from './packages/game-project/src/index.ts'; export * as simulation from './packages/game-simulation/src/index.ts';",resolveDir:gameRoot,sourcefile:'game-tools-entry.ts'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}
export async function loadGame(file=resolve(gameRoot,'examples/game-m1/game.project.json')) {
  file=resolve(file);
  const {project,simulation}=await loadGameModules();
  const base=dirname(file),realBase=await realpath(base);
  let totalBytes=0;
  const readBounded=async path=>{
    const {source,bytes}=await readBoundedSource(path,{root:realBase,maxBytes:Math.min(2*1024*1024,16*1024*1024-totalBytes)});
    totalBytes+=bytes;
    if(totalBytes>16*1024*1024) throw {diagnostics:[diagnostic('GAME_DOCUMENT_SIZE','Game source documents exceed 16 MiB in total.',{file:path})]};
    try {return project.boundedJSON(source);}
    catch(error) {throw {diagnostics:[diagnostic('GAME_JSON_PARSE',error.message,{file:path,repair:'Complete a bounded valid JSON document before retrying.'})]};}
  };
  let definitions;
  const documentFiles={manifest:file};
  if(file.endsWith('game.project.json')) {
    const manifest=await readBounded(file);
    const raw={manifest};
    for(const [kind,idsKey,cap] of [['levels','levelIds',64],['archetypes','archetypeIds',256],['abilities','abilityIds',256],['scenarios','scenarioIds',128]]) {
      if(!Array.isArray(manifest?.[idsKey]) || manifest[idsKey].length>cap) throw {diagnostics:[diagnostic('GAME_MANIFEST_REFERENCES',`Invalid ${idsKey} collection.`,{file,jsonPointer:`/${idsKey}`})]};
      const directory=resolve(base,kind),actualDirectory=await realpath(directory);
      if(!actualDirectory.startsWith(realBase+'/')) throw {diagnostics:[diagnostic('GAME_DOCUMENT_PATH','Document directory escapes the project.',{file:directory})]};
      const names=(await readdir(directory,{withFileTypes:true})).filter(entry=>entry.name.endsWith('.json')&&!entry.isDirectory()).map(entry=>entry.name).sort();
      if(names.length>256) throw {diagnostics:[diagnostic('GAME_DOCUMENT_COUNT',`Too many ${kind} source documents.`,{file:directory})]};
      const byId=new Map();
      for(const name of names) {
        const path=resolve(directory,name),document=await readBounded(path);
        if(typeof document?.id!=='string') throw {diagnostics:[diagnostic('GAME_DOCUMENT_ID','Document needs a stable ID.',{file:path,jsonPointer:'/id'})]};
        if(byId.has(document.id)) throw {diagnostics:[diagnostic('GAME_DOCUMENT_ID_DUPLICATE',`Duplicate stable document ID ${document.id}.`,{file:path,jsonPointer:'/id'})]};
        byId.set(document.id,{document,path});
      }
      for(const [id,entry] of byId) if(!manifest[idsKey].includes(id)) throw {diagnostics:[diagnostic('GAME_DOCUMENT_UNREFERENCED',`Unreferenced ${kind} document ID ${id}.`,{file:entry.path,jsonPointer:'/id',repair:`Add this stable ID to ${idsKey}, or remove the unused document.`})]};
      raw[kind]=[];documentFiles[kind]=[];
      for(const [index,id] of manifest[idsKey].entries()) {
        const entry=byId.get(id);
        if(!entry) throw {diagnostics:[diagnostic('GAME_DOCUMENT_REFERENCE',`Missing ${kind} document ID ${id}.`,{file,jsonPointer:`/${idsKey}/${index}`})]};
        raw[kind].push(entry.document);documentFiles[kind].push(entry.path);
      }
    }
    try {definitions=project.validateDefinitions(raw);} catch(error) {
      if(error.diagnostics) for(const item of error.diagnostics) {
        const match=/^\/(levels|archetypes|abilities|scenarios)\/(\d+)(.*)$/.exec(item.jsonPointer);
        if(match) {item.file=documentFiles[match[1]][Number(match[2])]??file;item.jsonPointer=match[3]||'';}
        else {item.file=file;item.jsonPointer=item.jsonPointer?.replace(/^\/manifest(?=\/|$)/,'')??'';}
      }
      throw error;
    }
  } else {
    const {source}=await readBoundedSource(file,{root:realBase});
    try {definitions=project.parseDefinitions(source);} catch(error) {if(error.diagnostics) {for(const item of error.diagnostics)item.file=file;throw error;}throw {diagnostics:[diagnostic('GAME_JSON_PARSE',error.message,{file})]};}
  }
  return {definitions,identity:await computeGameIdentity(definitions,project.canonicalDefinitions),project,simulation,file,documentFiles};
}
export function firstDifference(expected,actual,path='') {
  if(Object.is(expected,actual)) return null;
  if(typeof expected!==typeof actual || expected===null || actual===null || typeof expected!=='object'||Array.isArray(expected)!==Array.isArray(actual)) return path || '/';
  const keys=[...new Set([...Object.keys(expected),...Object.keys(actual)])].sort((a,b)=>Array.isArray(expected)?Number(a)-Number(b):(a<b?-1:a>b?1:0));
  for(const key of keys) {
    const pointer=`${path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`;
    if(!Object.hasOwn(expected,key)||!Object.hasOwn(actual,key)) return pointer;
    const diff=firstDifference(expected[key],actual[key],pointer);
    if(diff) return diff;
  }
  return null;
}
export function compareCanonical(expected,actual) {
  if(expected===actual) return null;
  try {return firstDifference(JSON.parse(expected),JSON.parse(actual)) ?? '/@canonicalBytes';} catch {return '/@canonicalBytes';}
}
export function reportError(error,file='') {
  const diagnostics=error?.diagnostics ?? [diagnostic(error?.usage?'GAME_USAGE':'GAME_TOOL_FAILURE',error?.message ?? String(error),{file})];
  for(const item of diagnostics) console.error(JSON.stringify({...diagnostic('GAME_VALIDATION','Invalid game definition.',{file}),...item,file:item.file||file}));
  process.exitCode=error?.usage?EXIT.usage:EXIT.validation;
}
export function parseArguments(args,allowed=['project']) {
  const options={};
  for(let i=0;i<args.length;i++) {
    if(!args[i].startsWith('--')) throw Object.assign(new Error(`Unexpected argument ${args[i]}.`),{usage:true});
    const key=args[i].slice(2); const value=args[i+1];
    if(!allowed.includes(key)) {const error=new Error(`Unknown option --${key}.`);error.usage=true;throw error;}
    if(!value || value.startsWith('--')) throw Object.assign(new Error(`Missing value for --${key}.`),{usage:true});
    options[key]=value;i++;
  }
  return options;
}

/** Scenario assertions read canonical authoritative state, with tick zero before stepping. */
export function runNamedScenario(game,scenarioId,tickOverride) {
  const scenario=game.definitions.scenarios.find(s=>s.id===scenarioId);
  if(!scenario) throw {diagnostics:[diagnostic('GAME_SCENARIO_UNKNOWN',`Unknown named scenario ${scenarioId}.`,{file:game.file,jsonPointer:'/scenarioIds'})]};
  const ticks=tickOverride??scenario.ticks;
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>200000) throw {diagnostics:[diagnostic('GAME_TICK_LIMIT','Scenario ticks must be an integer from 1 through 200000.')]};
  const world=game.simulation.createWorld(game.definitions,game.identity,scenarioId);
  const decoder=game.simulation.createInputDecoder();
  const checkpoints=[];
  const records=scenario.actions;
  let cursor=0,assertions=0;
  const assertionsAt=new Map(),commandsAt=new Map();
  for(const assertion of scenario.assertions){const entries=assertionsAt.get(assertion.tick)??[];entries.push(assertion);assertionsAt.set(assertion.tick,entries);}
  for(const command of scenario.commands??[]){const entries=commandsAt.get(command.tick)??[];entries.push({type:command.type});commandsAt.set(command.tick,entries);}
  function assertState(tick) {
    const scheduled=assertionsAt.get(tick);if(!scheduled)return;
    const state=JSON.parse(game.simulation.serializeCheckpoint(world));
    for(const assertion of scheduled) {
      const keys=assertion.path.replace(/^\//,'').split(/[/.]/).filter(Boolean);
      let value=state;
      for(const key of keys) value=value?.[key];
      const difference=firstDifference(assertion.equals,value);
      if(difference!==null) throw {diagnostics:[diagnostic('GAME_SCENARIO_ASSERTION',`At tick ${tick} expected ${JSON.stringify(assertion.equals)}, got ${JSON.stringify(value)}.`,{file:game.documentFiles?.scenarios?.[game.definitions.scenarios.indexOf(scenario)]??game.file,jsonPointer:`${assertion.path}${difference==='/'?'':difference}`,repair:'Inspect the scenario and first differing authoritative field.'})]};
      assertions++;
    }
  }
  assertState(0);
  for(let tick=0;tick<ticks;tick++) {
    const batch=[];
    while(cursor<records.length && records[cursor].tick===tick) batch.push(records[cursor++]);
    if(cursor<records.length&&records[cursor].tick<tick) throw {diagnostics:[diagnostic('GAME_REPLAY_ORDER','Scenario actions must be ordered by tick/slot sequence.',{file:game.file})]};
    const frame=game.simulation.decodeInputRecords(decoder,tick,batch);
    const commands=commandsAt.get(tick);
    if(commands?.length) frame.commands=commands;
    game.simulation.step(world,frame);
    assertState(world.tick);
    if(world.tick%1000===0) checkpoints.push({tick:world.tick,bytes:game.simulation.serializeCheckpoint(world)});
  }
  return {scenarioId,ticks,assertions,assertionsSkipped:scenario.assertions.filter(a=>a.tick>ticks).length,complete:ticks>=scenario.ticks,checkpoints,final:game.simulation.serializeCheckpoint(world)};
}

/** Bounded semantic replay artifact. All state transitions use the same decoder as live input. */
export function runInputReplay(game,artifact) {
  const fail=(code,message,pointer='')=>{throw {diagnostics:[diagnostic(code,message,{jsonPointer:pointer})]};};
  const keys=['snapshotVersion','gameId','rulesBuildId','contentId','scenarioId','initialCheckpoint','ticks','records','checkpoints'];
  if(!artifact||typeof artifact!=='object'||Array.isArray(artifact)||Object.keys(artifact).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(artifact,k))) fail('GAME_REPLAY_FORMAT','Replay has unknown or missing fields.');
  if(artifact.snapshotVersion!==1||artifact.gameId!==game.definitions.manifest.gameId||artifact.rulesBuildId!==game.identity.rulesBuildId||artifact.contentId!==game.identity.contentId) fail('GAME_REPLAY_IDENTITY','Replay version/game/rules/content identity differs from this build.');
  if(!game.definitions.scenarios.some(s=>s.id===artifact.scenarioId)) fail('GAME_SCENARIO_UNKNOWN','Replay scenario is missing.','/scenarioId');
  if(!Number.isSafeInteger(artifact.ticks)||artifact.ticks<1||artifact.ticks>200000) fail('GAME_TICK_LIMIT','Replay tick count must be from 1 through 200000.','/ticks');
  if(!Array.isArray(artifact.records)||artifact.records.length>200000) fail('GAME_REPLAY_RECORD_LIMIT','Replay exceeds 200000 records.','/records');
  if(!Array.isArray(artifact.checkpoints)||artifact.checkpoints.length<1||artifact.checkpoints.length>2000) fail('GAME_REPLAY_CHECKPOINT_LIMIT','Replay needs 1 through 2000 checkpoints.','/checkpoints');
  let world;
  if(artifact.initialCheckpoint===null) world=game.simulation.createWorld(game.definitions,game.identity,artifact.scenarioId);
  else if(typeof artifact.initialCheckpoint==='string') world=game.simulation.restoreCheckpoint(game.definitions,game.identity,artifact.initialCheckpoint);
  else fail('GAME_REPLAY_FORMAT','Initial checkpoint must be a canonical string or null.','/initialCheckpoint');
  if(world.scenarioId!==artifact.scenarioId) fail('GAME_REPLAY_IDENTITY','Initial checkpoint scenario differs.','/scenarioId');
  const start=world.tick,end=start+artifact.ticks;
  if(!Number.isSafeInteger(end)) fail('GAME_TICK_LIMIT','Replay tick range overflows.');
  const records=artifact.records.map((record,index)=>{try{return game.project.validateInputRecord(record);}catch(error){fail('GAME_REPLAY_RECORD',error.message,`/records/${index}`);}});
  for(let i=0;i<records.length;i++) if(records[i].tick<start||records[i].tick>=end||i>0&&records[i].tick<records[i-1].tick) fail('GAME_REPLAY_ORDER','Replay records must retain tick order within the execution range.',`/records/${i}`);
  let lastCheckpoint=start;
  const requested=new Map();
  for(const [i,checkpoint] of artifact.checkpoints.entries()) {
    if(!checkpoint||typeof checkpoint!=='object'||Object.keys(checkpoint).sort().join(',')!=='bytes,tick'||typeof checkpoint.bytes!=='string'||!Number.isSafeInteger(checkpoint.tick)||checkpoint.tick<=lastCheckpoint||checkpoint.tick>end) fail('GAME_REPLAY_FORMAT','Checkpoint ticks must increase within the execution range and include canonical bytes.',`/checkpoints/${i}`);
    requested.set(checkpoint.tick,checkpoint.bytes);lastCheckpoint=checkpoint.tick;
  }
  const decoder=JSON.parse(JSON.stringify(world.decoder));
  const checkpoints=[];
  let cursor=0;
  for(let tick=start;tick<end;tick++) {
    const batch=[];
    while(cursor<records.length&&records[cursor].tick===tick) batch.push(records[cursor++]);
    game.simulation.step(world,game.simulation.decodeInputRecords(decoder,tick,batch));
    if(requested.has(world.tick)) checkpoints.push({tick:world.tick,bytes:game.simulation.serializeCheckpoint(world)});
  }
  return {checkpoints,final:game.simulation.serializeCheckpoint(world)};
}
