import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3107';const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.fulfill({contentType:'text/html',body:'Map'}));
await context.route('**/data/shops.csv',async r=>r.fulfill({contentType:'text/csv',body:await readFile(new URL('./fixtures/shops.csv',import.meta.url),'utf8')}));await context.route('**/api/preview?*',r=>r.fulfill({status:503,body:'{}'}));
try{
 await page.goto(base);await expect(page.locator('article')).toHaveCount(6);
 const target=page.locator('article').nth(2);const id=await target.getAttribute('id');const card=page.locator(`[id="${id}"]`);
 await card.locator('.like-button').evaluate(button=>{for(let i=0;i<10;i++)button.click();});
 await expect(card.locator('.like-count')).toHaveText('10');await expect(page.locator('.saving')).toHaveCount(0);
 await page.getByLabel('並び順',{exact:true}).selectOption('いいねが多い順');await expect(page.locator('article').first()).toHaveAttribute('id',id);
 await page.reload();await expect(card.locator('.like-count')).toHaveText('10');
 await card.locator('.like-button').click();await expect(card.locator('.like-count')).toHaveText('11');await expect(page.locator('.saving')).toHaveCount(0);
 await card.getByRole('button',{name:'行った！',exact:true}).click();await expect(card).toHaveCount(0);await page.getByRole('group',{name:'訪問状態'}).getByRole('button',{name:'行った',exact:true}).click();await expect(card.locator('.like-count')).toHaveText('11');
 await card.getByRole('button',{name:'まだに戻す'}).click();await page.getByRole('group',{name:'訪問状態'}).getByRole('button',{name:'まだ',exact:true}).click();await expect(card.locator('.like-count')).toHaveText('11');
 await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});
 await card.locator('.like-button').click();await expect(page.locator('.message.error')).toContainText('いいねの保存を確認できません');await expect(card.locator('.like-count')).toHaveText('11');await page.evaluate(()=>Storage.prototype.setItem=window.savedSetItem);
 await mkdir('test-results',{recursive:true});
 for(const width of [1365,768,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok((await card.locator('.like-button').boundingBox()).height>=44);await page.screenshot({path:`test-results/likes-${width}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS: 10 rapid clicks, persistent counts, descending order, visit updates, failed save, desktop/mobile layout');
}finally{await browser.close();}
