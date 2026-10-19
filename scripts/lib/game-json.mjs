/** Bounds are checked before JSON.parse, including quoted braces and escaped quotes. */
export function boundedJSON(source,maxBytes=2*1024*1024) {
  if(Buffer.byteLength(source,'utf8')>maxBytes) throw new Error(`JSON exceeds ${maxBytes/1024/1024} MiB.`);
  let depth=0,quoted=false,escaped=false;
  for(const c of source) {
    if(quoted) {if(escaped) escaped=false;else if(c==='\\') escaped=true;else if(c==='"') quoted=false;}
    else if(c==='"') quoted=true;
    else if(c==='{'||c==='[') {if(++depth>32) throw new Error('JSON nesting exceeds 32.');}
    else if(c==='}'||c===']') depth--;
  }
  return JSON.parse(source);
}
