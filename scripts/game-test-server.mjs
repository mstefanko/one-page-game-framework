import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { gameRoot } from './lib/game-identity.mjs';
const port=Number(process.env.GAME_TEST_PORT??4181);
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(request,response)=>{
  try {
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const fixture=pathname.startsWith('/fixture/');
    const directory=resolve(gameRoot,fixture?'dist-game-fixture':'dist-game');
    let relative=fixture?pathname.slice('/fixture/'.length):pathname.slice(1);
    if(relative===''||relative.endsWith('/')) relative+='index.html';
    const file=resolve(directory,relative);
    if(!file.startsWith(directory+'/')) {response.writeHead(403);response.end();return;}
    await stat(file);
    response.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');
    response.setHeader('Cache-Control','no-store');
    response.end(await readFile(file));
  } catch {response.writeHead(404);response.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Built game evidence server http://127.0.0.1:${port}`));
