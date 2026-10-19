import { build, transform } from 'esbuild';
import { parse } from 'acorn';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = new Set(['Intl','Date','performance','Promise','window','document','navigator','globalThis','global','self','process','require','module','exports','Buffer','fetch','XMLHttpRequest','WebSocket','Worker','SharedWorker','localStorage','sessionStorage','indexedDB','crypto','eval','Function','setTimeout','setInterval','setImmediate','requestAnimationFrame','queueMicrotask','console','Atomics','SharedArrayBuffer','WeakRef','FinalizationRegistry','__dirname','__filename','URL','URLSearchParams','TextEncoder','TextDecoder','Image','Audio','ImageData','Blob','File','FileReader','AbortController','MutationObserver','ResizeObserver','setImmediate','clearImmediate','clearTimeout','clearInterval','cancelAnimationFrame']);
const math = new Set(['abs','min','max','trunc','floor','ceil','round','sign','clz32','imul']);
const diagnostic = (code,file,message) => ({code,severity:'error',file,jsonPointer:'',message,repair:'Keep authoritative rules synchronous and use only the declared pure runtime helpers.'});
function walk(node, visit, parent) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node,parent);
  for (const [key,value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) walk(child,visit,node);
    else if (value && typeof value === 'object') walk(value,visit,node);
  }
}
function helperMatches(file,helper) {return helper.includes('/') ? file===helper : basename(file)===helper;}
function staticProperty(node, bindings) {
  if(!node) return null;
  if(node.type==='Literal'&&typeof node.value==='string') return node.value;
  if(node.type==='Identifier') return bindings.get(node.name)??null;
  if(node.type==='TemplateLiteral'&&node.expressions.length===0) return node.quasis[0].value.cooked;
  if(node.type==='BinaryExpression'&&node.operator==='+') {const left=staticProperty(node.left,bindings),right=staticProperty(node.right,bindings);return left!==null&&right!==null?left+right:null;}
  return null;
}
const prohibitedMembers=new Set(['constructor','localeCompare','toLocaleString','toLocaleDateString','toLocaleTimeString','toLocaleLowerCase','toLocaleUpperCase']);
function propertyName(node,parent) {
  return parent && ((parent.type === 'MemberExpression' && parent.property === node && !parent.computed) || ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key === node && !parent.computed && !parent.shorthand));
}
export async function inspectSource(source,file,{rngFile='rng.ts',sqrtFile='quantized-length.ts'}={}) {
  const diagnostics=[];
  let code;
  try { code=(await transform(source,{loader:/\.[cm]?jsx?$/.test(file)?'js':'ts',format:'esm',target:'es2022',tsconfigRaw:{compilerOptions:{verbatimModuleSyntax:true}}})).code; }
  catch(error) {return [diagnostic('GAME_PURITY_PARSE',file,error.message)];}
  let ast;
  try {ast=parse(code,{ecmaVersion:'latest',sourceType:'module'});} catch(error) {return [diagnostic('GAME_PURITY_PARSE',file,error.message)];}
  const emit=(code,message)=>diagnostics.push(diagnostic(code,file,message));
  const parents=new WeakMap();
  const bindings=new Map();
  walk(ast,(node,parent)=>{if(parent)parents.set(node,parent);if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&parent?.kind==='const'){const value=staticProperty(node.init,bindings);if(value!==null)bindings.set(node.id.name,value);}});
  walk(ast,(node,parent)=>{
    if(node.type==='MetaProperty'&&node.meta.name==='import') emit('GAME_PURITY_IMPORT_META','import.meta is host/build state and forbidden in authoritative rules.');
    if(node.type==='MemberExpression'||node.type==='Property') {
      const member=node.type==='MemberExpression'?(node.computed?staticProperty(node.property,bindings):node.property.name):(node.computed?staticProperty(node.key,bindings):node.key.name??node.key.value);
      if(prohibitedMembers.has(member)) emit(member==='constructor'?'GAME_PURITY_CONSTRUCTOR':'GAME_PURITY_LOCALE',`Prohibited runtime member ${member}.`);
    }
    if (node.type === 'ImportExpression') emit('GAME_PURITY_DYNAMIC_IMPORT','Dynamic import is forbidden in simulation.');
    if (node.type === 'AwaitExpression' || node.async || node.type === 'YieldExpression') emit('GAME_PURITY_ASYNC','Async, await and generators are forbidden in simulation.');
    if (node.type === 'Identifier' && !propertyName(node,parent)) {
      if(forbidden.has(node.name)) emit('GAME_PURITY_GLOBAL',`Prohibited global ${node.name}.`);
      if(node.name==='Math') {
        if(!parent || parent.type!=='MemberExpression' || parent.object!==node || parent.computed) emit('GAME_PURITY_MATH_ALIAS','Math must be accessed directly with a declared non-computed member.');
        else {
          const call=parents.get(parent);
          if(!call || call.type!=='CallExpression' || call.callee!==parent) emit('GAME_PURITY_MATH_ALIAS','Math methods must be called directly, never aliased.');
          const member=parent.property.name;
          if(!math.has(member) && !(member==='sqrt' && helperMatches(file,sqrtFile))) emit('GAME_PURITY_MATH',`Math.${member} is not allowed in this module.`);
          if(member==='imul' && !helperMatches(file,rngFile)) emit('GAME_PURITY_RNG','Math.imul is restricted to the reviewed RNG helper.');
        }
      }
    }
    if ((node.type==='BinaryExpression' && ['|','&','^','<<','>>','>>>'].includes(node.operator) || node.type==='AssignmentExpression' && ['|=','&=','^=','<<=','>>=','>>>='].includes(node.operator) || node.type==='UnaryExpression' && node.operator==='~') && !helperMatches(file,rngFile)) emit('GAME_PURITY_BITWISE','Bitwise operations are restricted to the reviewed RNG helper.');
  });
  return diagnostics;
}
export async function checkModuleGraph({entryPoints,allowedRoots,allowedFiles=[],rngFile,sqrtFile}) {
  const diagnostics=[];
  const roots=allowedRoots.map(p=>resolve(p));
  const files=new Set(allowedFiles.map(p=>resolve(p)));
  const allowed=p=>files.has(resolve(p)) || roots.some(base=>resolve(p).startsWith(base+'/'));
  let result;
  try {
    result=await build({absWorkingDir:root,entryPoints:entryPoints.map(p=>resolve(p)),bundle:true,outdir:'purity-out',write:false,metafile:true,treeShaking:false,platform:'node',format:'esm',logLevel:'silent',tsconfigRaw:{compilerOptions:{verbatimModuleSyntax:true}},plugins:[{name:'purity-imports',setup(b){b.onResolve({filter:/.*/},args=>{
      if(args.kind==='entry-point') return;
      if(!args.path.startsWith('.') && !args.path.startsWith('/')) {
        diagnostics.push(diagnostic('GAME_PURITY_IMPORT',args.importer,`Runtime import ${args.path} is outside the pure allow-list.`));
        return {path:args.path,external:true};
      }
    });}}]});
  } catch(error) {diagnostics.push(diagnostic('GAME_PURITY_BUILD','',error.message));return {diagnostics,modules:[]};}
  const modules=Object.keys(result.metafile.inputs).map(p=>resolve(root,p)).sort();
  for (const file of modules) {
    if(!allowed(file)) diagnostics.push(diagnostic('GAME_PURITY_IMPORT',relative(root,file),'Runtime helper is outside the pure allow-list.'));
    diagnostics.push(...await inspectSource(await readFile(file,'utf8'),relative(root,file),{rngFile,sqrtFile}));
  }
  return {diagnostics,modules:modules.map(p=>relative(root,p))};
}
async function sourceFiles(directory) {
  const entries=await readdir(directory,{withFileTypes:true});
  const files=[];
  for(const entry of entries) {
    const path=resolve(directory,entry.name);
    if(entry.isDirectory()) files.push(...await sourceFiles(path));
    else if(/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)) files.push(path);
  }
  return files;
}
export async function checkSimulationPurity() {
  const base=resolve(root,'packages/game-simulation/src');
  return checkModuleGraph({entryPoints:await sourceFiles(base),allowedRoots:[base],allowedFiles:[resolve(root,'packages/game-project/src/runtime.ts'),resolve(root,'packages/game-project/src/types.ts')],rngFile:'packages/game-simulation/src/rng.ts',sqrtFile:'packages/game-simulation/src/quantized-length.ts'});
}
export async function selfTest() {
  const base=resolve(root,'scripts/fixtures/game-purity');
  const failures=[];
  for(const kind of ['valid','invalid']) {
    const dir=resolve(base,kind);
    for(const name of await readdir(dir)) {
      const result=await checkModuleGraph({entryPoints:[resolve(dir,name)],allowedRoots:[dir],rngFile:'rng.ts'});
      if((kind==='valid') !== (result.diagnostics.length===0)) failures.push({fixture:`${kind}/${name}`,diagnostics:result.diagnostics});
    }
  }
  return failures;
}
function stagedRelevant() {
  const names=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMR'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(n=>/^(packages\/game-(simulation|project)\/|scripts\/(check-sim-purity|fixtures\/game-purity))/.test(n));
  for(const name of names) {
    const staged=execFileSync('git',['show',`:${name}`],{cwd:root});
    const actual=execFileSync('git',['hash-object',name],{cwd:root,encoding:'utf8'}).trim();
    const indexed=execFileSync('git',['hash-object','--stdin'],{cwd:root,input:staged,encoding:'utf8'}).trim();
    if(actual!==indexed) return {diagnostics:[diagnostic('GAME_PURITY_STAGED_MISMATCH',name,'Staged and working pure module bytes differ; stage the intended complete change before checking.')],skip:false};
  }
  return {diagnostics:[],skip:names.length===0};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.includes('--self-test')) {const failures=await selfTest();if(failures.length){console.error(JSON.stringify({code:'GAME_PURITY_FIXTURE_FAILURE',failures}));process.exitCode=1;}else console.log(JSON.stringify({ok:true,fixtures:'all purity escape and allowed cases'}));} else {
    const staged=process.argv.includes('--staged')?stagedRelevant():{diagnostics:[],skip:false};
    const result=staged.diagnostics.length?staged:staged.skip?{diagnostics:[],modules:[]}:await checkSimulationPurity();
    if(result.diagnostics.length) {for(const entry of result.diagnostics) console.error(JSON.stringify(entry));process.exitCode=1;}
    else console.log(JSON.stringify({ok:true,modules:result.modules}));
    }
  } catch(error) {console.error(JSON.stringify(diagnostic('GAME_PURITY_TOOL','',error.message)));process.exitCode=2;}
}
