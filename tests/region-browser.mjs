import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3103';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const addresses=['〒150-0001 東京都渋谷区神宮前4-1 テスト店','東京都武蔵野市吉祥寺1-2 テスト店','埼玉県和光市下新倉1-2 テスト店','不明な店','東京都不明町1-2 テスト店'];
const csv=['ID,書いた日にち,書いた人,Google mapのURL,行ったかどうか',...addresses.map((a,i)=>`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')},2026-10-07,なおと,https://maps.google.com/?q=${encodeURIComponent(a)},FALSE`)].join('\n');
await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.fulfill({contentType:'text/html',body:'<p>Map</p>'}));
await context.route('**/data/shops.csv',route=>route.fulfill({contentType:'text/csv',body:csv}));
await context.route('**/api/preview?*',route=>route.fulfill({status:503,body:'{}'}));
try{
 await page.goto(base);await expect(page.locator('article')).toHaveCount(5);
 await page.getByLabel('都道府県',{exact:true}).selectOption('東京都');await expect(page.locator('article')).toHaveCount(3);
 await page.getByLabel('区・市町村',{exact:true}).selectOption('渋谷区');await expect(page.locator('article')).toHaveCount(1);
 await page.getByLabel('書いた人',{exact:true}).selectOption('あずさ');await expect(page.locator('article')).toHaveCount(0);
 await page.getByRole('button',{name:'絞り込みをクリア'}).click();await expect(page.locator('article')).toHaveCount(5);await expect(page.getByLabel('都道府県',{exact:true})).toHaveValue('すべて');
 await page.getByLabel('都道府県',{exact:true}).selectOption('特定不可');await expect(page.locator('article')).toHaveCount(1);await expect(page.locator('article')).toContainText('不明な店');
 await page.getByLabel('都道府県',{exact:true}).selectOption('東京都');await page.getByLabel('区・市町村',{exact:true}).selectOption('特定不可');await expect(page.locator('article')).toHaveCount(1);
 await page.getByLabel('都道府県',{exact:true}).selectOption('埼玉県');await expect(page.getByLabel('区・市町村',{exact:true})).toHaveCount(0);await expect(page.locator('article')).toHaveCount(1);
 await page.getByLabel('都道府県',{exact:true}).selectOption('東京都');await expect(page.getByLabel('区・市町村',{exact:true})).toHaveValue('すべて');
 await mkdir('test-results',{recursive:true});
 for(const width of [1365,768,390,320]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
  const boxes=await page.locator('.region-filters select:not([aria-label="タグで絞り込み"])').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};}));
  assert.ok(boxes.every(b=>b.height>=44 && b.left>=0 && b.right<=width));
  assert.ok(boxes[0].right<=boxes[1].left || boxes[0].bottom<=boxes[1].top || boxes[1].right<=boxes[0].left);
  await page.screenshot({path:`test-results/region-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS region UI: combined filters, unknown regions, reset, municipality reset, 1365/768/390/320px layout and 44px controls.');
}finally{await browser.close();}
