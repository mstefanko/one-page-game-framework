import { createHash } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const gameRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const RULES_CONTRACT=Object.freeze({format:'reviewed-rules-source-v1',languageTarget:'ES2022',snapshotVersion:1,ticksPerSecond:60,fixedUnitsPerPixel:256});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Compatibility deliberately means exact reviewed rules-source/content, independent of compiler bytes.
 * Actual emitted shipping bytes are identified separately by game-build-manifest.json for archival audit.
 * Every executable simulation/helper source is included before tree shaking, including pure constants/codecs.
 */
export function fingerprintRulesSources(records,contract=RULES_CONTRACT) {
  const files=records.map(({path,source})=>({path:path.replaceAll('\\','/'),source:String(source).replaceAll('\r\n','\n')})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(new Set(files.map(file=>file.path)).size!==files.length) throw Error('Duplicate rules source identity path.');
  return `sha256:${sha256(JSON.stringify({contract,files}))}`;
}
export async function rulesSourceRecords(root=gameRoot) {
  const files=[];
  async function visit(directory) {
    for(const entry of await readdir(resolve(root,directory),{withFileTypes:true})) {
      const path=`${directory}/${entry.name}`;
      if(entry.isDirectory()) await visit(path);
      else if(/\.ts$/.test(entry.name)&&!/\.(?:test|spec|d)\.ts$/.test(entry.name)) {
        if(!entry.isFile()) throw Error(`Rules source must be a regular contained file: ${path}`);
        files.push(path);
      }
    }
  }
  await visit('packages/game-simulation/src');
  files.push('packages/game-project/src/runtime.ts','packages/game-project/src/types.ts');
  return Promise.all(files.sort().map(async path=>({path,source:await readFile(resolve(root,path),'utf8')})));
}
export async function computeGameIdentity(definitions,canonicalDefinitions) {
  return {rulesBuildId:fingerprintRulesSources(await rulesSourceRecords()),contentId:`sha256:${sha256(canonicalDefinitions(definitions))}`};
}
export async function compilerProvenance(root=gameRoot) {
  const versions={};
  for(const name of ['vite','esbuild','rolldown']) {
    const metadata=JSON.parse(await readFile(resolve(root,'node_modules',name,'package.json'),'utf8'));
    versions[name]=metadata.version;
  }
  return {...versions,node:process.version};
}
/** This hashes the actual final output, never an independently compiled proxy of shipping code. */
export function buildArtifactManifest(bundle,identity,compiler) {
  const artifacts=Object.values(bundle).filter(item=>item.fileName!=='game-build-manifest.json').map(item=>{
    const bytes=item.type==='chunk'?Buffer.from(item.code):typeof item.source==='string'?Buffer.from(item.source):Buffer.from(item.source);
    return {path:item.fileName,bytes:bytes.byteLength,sha256:sha256(bytes)};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return {format:'shipping-artifacts-v1',compatibilityPolicy:'exact-reviewed-rules-source-and-content',rulesContract:RULES_CONTRACT,identity,compiler,artifacts,artifactSetId:`sha256:${sha256(JSON.stringify(artifacts))}`};
}
