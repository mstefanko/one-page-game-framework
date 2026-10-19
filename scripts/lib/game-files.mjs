import { constants } from 'node:fs';
import { open,realpath,lstat } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';

/** Open once, reject symlinks/identity changes, and read at most limit+1 bytes even if a writer grows it.
 * Before/after resolved-path and inode checks cover ordinary concurrent editor replacements; this is
 * trusted local tooling, not an adversarial filesystem sandbox (Node has no portable openat API).
 */
export async function readBoundedSource(file,{root,maxBytes=2*1024*1024}={}) {
  const base=await realpath(root);
  const path=resolve(file);
  const fail=(code,message)=>{throw {diagnostics:[{code,severity:'error',file:path,jsonPointer:'',message,repair:'Keep source files inside the project and retry after the current write completes.'}]};};
  let handle;
  try {
    const actual=await realpath(path);
    if(!actual.startsWith(base+'/')) fail('GAME_DOCUMENT_PATH','Document escapes the game project.');
    if((await lstat(path)).isSymbolicLink()) fail('GAME_DOCUMENT_PATH','Source document symlinks are not supported.');
    handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const before=await handle.stat({bigint:true});
    if(!before.isFile()) fail('GAME_DOCUMENT_PATH','Source document must be a regular file.');
    if(before.size>BigInt(maxBytes)) fail('GAME_DOCUMENT_SIZE',`Document exceeds ${maxBytes} bytes.`);
    const resolvedAfterOpen=await realpath(path),named=await lstat(resolvedAfterOpen,{bigint:true});
    if(actual!==resolvedAfterOpen||!resolvedAfterOpen.startsWith(base+'/')||!named.isFile()||before.dev!==named.dev||before.ino!==named.ino) fail('GAME_DOCUMENT_CHANGED','Document path changed while opening; retry validation.');
    const chunks=[];
    let count=0;
    while(count<=maxBytes) {
      const chunk=Buffer.alloc(Math.min(65536,maxBytes+1-count));
      const {bytesRead}=await handle.read(chunk,0,chunk.length,count);
      if(!bytesRead) break;
      chunks.push(chunk.subarray(0,bytesRead));count+=bytesRead;
    }
    if(count>maxBytes) fail('GAME_DOCUMENT_SIZE',`Document exceeds ${maxBytes} bytes.`);
    const after=await handle.stat({bigint:true}),finalNamed=await lstat(path,{bigint:true}),finalResolved=await realpath(path);
    if(!finalNamed.isFile()||finalNamed.dev!==before.dev||finalNamed.ino!==before.ino||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||finalResolved!==actual) fail('GAME_DOCUMENT_CHANGED','Document changed during reading; retry validation.');
    const bytes=Buffer.concat(chunks,count);
    let source;
    try {source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {fail('GAME_DOCUMENT_UTF8','Source document must be valid UTF-8.');}
    return {source,bytes:count};
  } catch(error) {
    if(error.diagnostics) throw error;
    fail(error.code==='ELOOP'?'GAME_DOCUMENT_PATH':'GAME_DOCUMENT_READ',`Cannot read source document: ${error.code??error.message}.`);
  } finally {await handle?.close();}
}

export async function readBoundedJSON(file,maxBytes=2*1024*1024,parse) {
  const path=resolve(file);
  const {source}=await readBoundedSource(path,{root:dirname(path),maxBytes});
  const {boundedJSON}=await import('./game-json.mjs');
  return (parse??boundedJSON)(source,maxBytes);
}
