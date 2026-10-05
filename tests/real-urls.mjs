import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3001';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1365,height:1000}});
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(base);await expect(page.locator('article')).toHaveCount(10);
 await expect(page.getByRole('button',{name:'お店を追加',exact:true})).toBeEnabled();
 await expect(page.locator('article[data-preview-pending="true"]')).toHaveCount(0,{timeout:60000});
 const results=await page.locator('article').evaluateAll(cards=>cards.map(card=>({title:card.getAttribute('data-title'),url:card.querySelector('.maps-link').href,embedUrl:card.querySelector('iframe')?.src})));
 assert.equal(new Set(results.map(r=>r.url)).size,10);
 for(const result of results){assert.match(result.url,/^https:\/\/maps.app.goo.gl\//);assert.ok(result.embedUrl,'All provided place URLs have a native Google Maps embed');}
 const named=results.find(r=>r.title.includes('365'));
 assert.ok(named,'URL解決後の場所名が一覧に反映される');
 await page.getByRole('searchbox').fill('365');await expect(page.locator('article')).toHaveCount(1);await page.getByLabel('書いた人',{exact:true}).selectOption('なおと');await expect(page.locator('article')).toHaveCount(0);await page.getByLabel('書いた人',{exact:true}).selectOption('あずさ');await expect(page.locator('article')).toHaveCount(1);
 await page.getByRole('searchbox').fill('');await page.getByLabel('書いた人',{exact:true}).selectOption('全員');
 await mkdir('test-results',{recursive:true});await writeFile('test-results/real-previews.json',JSON.stringify(results,null,2));
 await page.getByRole('heading',{name:'お店一覧'}).click();await page.locator('iframe').evaluateAll(frames=>frames.forEach(frame=>frame.loading='eager'));await expect.poll(()=>page.frames().filter(frame=>frame.url().startsWith('https://www.google.com/maps/embed')).length,{timeout:30000}).toBe(10);await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});for(const frame of await page.locator('iframe').all()){await frame.scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});}await page.getByRole('heading',{name:'お店一覧'}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/real-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('iframe').evaluateAll(frames=>frames.forEach(frame=>frame.loading='eager'));await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});for(const frame of await page.locator('iframe').all()){await frame.scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});}await page.getByRole('heading',{name:'お店一覧'}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/real-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const blocked=await context.request.get(base+'/api/preview?url='+encodeURIComponent('http://169.254.169.254/latest/meta-data'));assert.equal(blocked.status(),400);
 console.log(JSON.stringify({passed:true,total:results.length,derived:results.filter(r=>r.title!=='Google Mapsのお店').length,nativeMaps:results.filter(r=>r.embedUrl).length}));
} finally {await browser.close();}
