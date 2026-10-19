import { createHash } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { test,expect } from '@playwright/test';
import { loadGame,compareCanonical } from '../../../scripts/lib/game-tools.mjs';

test('built rules produce complete exact Node/browser bytes for 10000 active ticks',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const game=await loadGame();
  const expected=game.simulation.runReplayFixture(game.definitions,game.identity,10000);
  await page.goto('/fixture/');
  await page.waitForFunction(()=>!!(window as any).__GAME_FIXTURE__);
  const actual=await page.evaluate(()=> (window as any).__GAME_FIXTURE__.run(10000));
  expect(actual.checkpoints.length).toBeGreaterThanOrEqual(10);
  expect(actual.checkpoints.map((c:any)=>c.tick)).toEqual(expected.checkpoints.map(c=>c.tick));
  for(let i=0;i<expected.checkpoints.length;i++) {
    const difference=compareCanonical(expected.checkpoints[i].bytes,actual.checkpoints[i].bytes);
    expect(difference,`checkpoint ${expected.checkpoints[i].tick} first differing path`).toBeNull();
    expect(actual.checkpoints[i].bytes).toBe(expected.checkpoints[i].bytes);
  }
  expect(compareCanonical(expected.final,actual.final),'final first differing path').toBeNull();
  expect(actual.final).toBe(expected.final);
  for(const key of ['jumps','hits','guards','freezeTicks','carriedTicks','activeRestores','restarts']) expect(actual.coverage[key],key).toBeGreaterThan(0);
  expect(actual.coverage.restarts).toBe(33);
  const scheduled=await page.evaluate(()=> (window as any).__GAME_FIXTURE__.run(10000,[0,1,0,3,2,5,1]));
  expect(scheduled).toEqual(actual);
  expect(errors).toEqual([]);
  await mkdir(testInfo.outputDir,{recursive:true});
  const evidence=testInfo.outputPath('canonical-replay.json');
  await writeFile(evidence,JSON.stringify({environment:testInfo.project.name,ticks:10000,identity:game.identity,...actual}));
  await testInfo.attach('canonical-replay.json',{path:evidence,contentType:'application/json'});
});

test('production player renders logical pixels and exposes no development bridge',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const manifestResponse=await page.request.get('/game-build-manifest.json');
  expect(manifestResponse.ok()).toBe(true);
  const manifest=await manifestResponse.json();
  expect(manifest.format).toBe('shipping-artifacts-v1');
  expect(manifest.compatibilityPolicy).toBe('exact-reviewed-rules-source-and-content');
  expect(manifest.artifacts.some((artifact:any)=>artifact.path==='index.html')).toBe(true);
  for(const artifact of manifest.artifacts){
    const response=await page.request.get(`/${artifact.path}`);expect(response.ok()).toBe(true);
    const bytes=await response.body();expect(bytes.byteLength).toBe(artifact.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
  }
  await page.goto('/?benchmark&debug=1');
  const canvas=page.locator('.stage canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('[data-mirror]')).toContainText('Health');
  expect(await canvas.getAttribute('width')).toBe('320');
  expect(await canvas.getAttribute('height')).toBe('180');
  expect(await page.evaluate(()=>Object.hasOwn(window,'__GAME_DEV__'))).toBe(false);
  await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true});
  const originalStyle=await canvas.evaluate(node=>({width:(node as HTMLCanvasElement).style.width,height:(node as HTMLCanvasElement).style.height}));
  // Temporarily display at 1x CSS scale to capture actual logical-resolution pixels.
  await canvas.evaluate(node=>{const c=node as HTMLCanvasElement;c.style.width='320px';c.style.height='180px';});
  const screenshot=await canvas.screenshot({path:testInfo.outputPath('game-logical-320x180.png')});
  await testInfo.attach('logical-resolution',{body:screenshot,contentType:'image/png'});
  await canvas.evaluate((node,style)=>{Object.assign((node as HTMLCanvasElement).style,style);},originalStyle);
  await page.setViewportSize({width:300,height:700});
  await expect(page.locator('[data-scale]')).toContainText('FRACTIONAL FIT');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('small-300px.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('real keyboard holds cancel through pause and twenty scene remounts remain operable',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4182');
  await page.waitForFunction(()=> (window as any).__GAME_DEV__?.ready);
  await page.locator('[data-pause]').click();
  await page.locator('.stage').click();
  await page.keyboard.down('ArrowRight');
  await expect.poll(()=>page.evaluate(()=>JSON.parse((window as any).__GAME_DEV__.checkpoint()).decoder.slots[0].held.right)).toBe(true);
  await page.locator('[data-pause]').click();
  await expect(page.locator('[data-pause]')).toHaveText('Resume');
  await page.locator('[data-pause]').click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse((window as any).__GAME_DEV__.checkpoint()).decoder.slots[0].held.right)).toBe(false);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(()=> (window as any).__GAME_DEV__.pause());
  const saved=await page.evaluate(()=> (window as any).__GAME_DEV__.checkpoint());
  await page.evaluate(()=> (window as any).__GAME_DEV__.step());
  await page.evaluate(bytes=> (window as any).__GAME_DEV__.restore(bytes),saved);
  expect(await page.evaluate(()=> (window as any).__GAME_DEV__.checkpoint())).toBe(saved);
  for(let i=0;i<20;i++) {
    await page.evaluate(async()=>{await (window as any).__GAME_DEV__.remount();});
    await page.waitForFunction(()=> (window as any).__GAME_DEV__?.ready);
    expect(await page.locator('.stage canvas').count()).toBe(1);
  }
  // Overlap initializers so disposed sessions resolve after a later mount is already active.
  await page.evaluate(async()=>{await Promise.all([(window as any).__GAME_DEV__.remount(),(window as any).__GAME_DEV__.remount(),(window as any).__GAME_DEV__.remount()]);});
  await page.waitForFunction(()=> (window as any).__GAME_DEV__?.ready);
  expect(await page.locator('.stage canvas').count()).toBe(1);
  const counters=await page.evaluate(()=> (window as any).__GAME_DEV__.counters());
  expect(counters.sessions).toBe(1);
  expect(counters.raf).toBe(1);
  await mkdir(testInfo.outputDir,{recursive:true});
  const evidence=testInfo.outputPath('lifecycle-evidence.json');
  await writeFile(evidence,JSON.stringify({restarts:20,overlappingLateLoads:3,counters,note:'Resource counters are lifecycle evidence, not memory measurements.'}));
  await testInfo.attach('lifecycle-evidence.json',{path:evidence,contentType:'application/json'});
  expect(errors).toEqual([]);
});
