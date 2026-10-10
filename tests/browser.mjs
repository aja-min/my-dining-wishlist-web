import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3001';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1365,height:1000}});
const page=await context.newPage();
const errors=[], external=[];
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',route=>{ const url=new URL(route.request().url());if(url.hostname==='maps.google.com' && url.searchParams.get('output')==='embed')return route.fulfill({contentType:'text/html',body:'<p>Google Maps test frame</p>'});if(url.origin!==new URL(base).origin){external.push(url.href);return route.abort();}return route.continue(); });
await context.route('**/data/shops.csv',async route=>route.fulfill({contentType:'text/csv',body:await readFile(new URL('./fixtures/shops.csv',import.meta.url),'utf8')}));
await context.route('**/api/preview?*',route=>route.fulfill({status:503,body:'{}'}));
const key='ikitai-omise.demo.v1';
const status=label=>page.getByRole('group',{name:'訪問状態'}).getByRole('button',{name:label,exact:true});
const card=name=>page.getByRole('article',{name,exact:true});
async function settle(){await expect(page.getByRole('button',{name:'再読み込み',exact:true})).toBeEnabled();}
async function add(url,person){await page.getByLabel('デモユーザー',{exact:true}).selectOption(person);await page.getByRole('button',{name:'お店を追加',exact:true}).click();await page.getByLabel('Google MapsのURL',{exact:false}).fill(url);await page.getByRole('button',{name:'お店を登録',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await settle();}
async function stored(){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
try {
 await page.goto(base);await settle();await expect(page.locator('article')).toHaveCount(6);await expect(status('まだ')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('searchbox').fill('喫茶');await page.getByLabel('書いた人',{exact:true}).selectOption('なおと');await expect(page.locator('article')).toHaveCount(1);await page.getByLabel('書いた人',{exact:true}).selectOption('あずさ');await expect(page.getByText('条件に合うお店がありません')).toBeVisible();await page.getByRole('button',{name:'絞り込みをクリア'}).click();await expect(page.locator('article')).toHaveCount(8);
 await page.getByLabel('並び順',{exact:true}).selectOption('古い順');assert.equal(await page.locator('article time').first().textContent(),'2026.10.01');
 await add('https://www.google.com/maps/place/Naoto+Cafe','なおと');await expect(card('Naoto Cafe')).toContainText('なおと');
 await add('https://maps.app.goo.gl/azusa-test','あずさ');await expect(card('Google Mapsのお店')).toContainText('あずさ');await expect(card('Google Mapsのお店').locator('.map-unavailable')).toBeVisible();
 await page.reload();await settle();await expect(page.locator('article')).toHaveCount(8);
 await page.getByRole('button',{name:'お店を追加',exact:true}).click();await page.getByLabel('Google MapsのURL',{exact:false}).fill('https://www.google.com/maps/place/Naoto+Cafe');await page.getByRole('button',{name:'お店を登録',exact:true}).click();await expect(page.locator('.message.error')).toContainText('同じURL');await page.getByRole('button',{name:'登録済みのお店を表示'}).click();await expect(card('Naoto Cafe')).toHaveClass(/highlight/);
 await card('Naoto Cafe').getByRole('button',{name:'行った！',exact:true}).click();await expect(card('Naoto Cafe').getByRole('button',{name:'まだに戻す'})).toBeEnabled();await page.reload();await settle();await status('行った').click();await expect(card('Naoto Cafe')).toBeVisible();
 await page.getByLabel('デモユーザー',{exact:true}).selectOption('あずさ');await card('Naoto Cafe').getByRole('button',{name:'まだに戻す'}).click();await settle();await status('まだ').click();await expect(card('Naoto Cafe')).toBeVisible();
 await card('Google Mapsのお店').getByRole('button',{name:'Google Mapsのお店を削除'}).click();await expect(page.getByRole('dialog')).toContainText('Google Mapsのお店');await page.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(card('Google Mapsのお店')).toBeVisible();await card('Google Mapsのお店').getByRole('button',{name:'Google Mapsのお店を削除'}).click();await page.getByRole('button',{name:'削除する',exact:true}).click();await settle();await page.reload();await settle();await expect(card('Google Mapsのお店')).toHaveCount(0);
 // Rapid repeated submits in a single event turn must commit only once.
 await page.getByRole('button',{name:'お店を追加',exact:true}).click();await page.getByLabel('Google MapsのURL',{exact:false}).fill('https://www.google.com/maps/place/Rapid');await page.locator('dialog form').evaluate(form=>{form.requestSubmit();form.requestSubmit();form.requestSubmit();});await expect(page.getByRole('dialog')).not.toBeVisible();await settle();assert.equal((await stored()).rows.filter(row=>row[3]?.includes('/Rapid')).length,1);
 // Saving failure must retain the previously displayed state and persisted values.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});await card('Rapid').getByRole('button',{name:'行った！'}).click();await expect(page.locator('.message.error')).toContainText('保存できません');await expect(card('Rapid').getByRole('button',{name:'行った！'})).toBeEnabled();await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);
 // Keyboard closes the native dialog and restores focus.
 await page.getByRole('button',{name:'お店を追加',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'お店を追加',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'サンプルにリセット'}).click();await page.getByRole('button',{name:'リセットする',exact:true}).click();await settle();await page.reload();await settle();await expect(page.locator('article')).toHaveCount(6);assert.equal((await stored()).rows.length,9);
 // The native map frame is separate from visit and delete actions.
 await page.reload();await settle();await expect(card('喫茶 こもれび').locator('iframe')).toHaveAttribute('src',/output=embed/);
 // Corrupt persistence shows an error and can be reset explicitly.
 await page.evaluate(k=>localStorage.setItem(k,'{bad'),key);await page.reload();await expect(page.locator('.message.error')).toContainText('保存データ');await page.getByRole('button',{name:'サンプルにリセット'}).click();await page.getByRole('button',{name:'リセットする',exact:true}).click();await settle();await expect(page.locator('article')).toHaveCount(6);
 // Empty data state is distinct from a filtered result.
 await page.evaluate(k=>{const data=JSON.parse(localStorage.getItem(k));data.rows=data.rows.slice(0,1);localStorage.setItem(k,JSON.stringify(data));},key);await page.reload();await settle();await expect(page.getByText('お店が登録されていません')).toBeVisible();await page.getByRole('button',{name:'サンプルにリセット'}).click();await page.getByRole('button',{name:'リセットする',exact:true}).click();await settle();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 // Local API boundary must reject all Google data access.
 const api=await context.request.get(base+'/api/shops');assert.equal(api.status(),403);assert.match((await api.json()).error,/デモモード/);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS: combined filters, both authors, persistence, reset, map fallback, duplicate URL, rapid submission, failed save rollback, keyboard/dialog, empty/error states, mobile layout, no external requests, demo API denial');
} finally {await browser.close();}
