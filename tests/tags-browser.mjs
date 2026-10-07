import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3104';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1365,height:1000}});
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.fulfill({contentType:'text/html',body:'Map'}));
await context.route('**/data/shops.csv',async route=>route.fulfill({contentType:'text/csv',body:await readFile(new URL('./fixtures/shops.csv',import.meta.url),'utf8')}));
await context.route('**/api/preview?*',route=>route.fulfill({status:503,body:'{}'}));
const dialog=page.getByRole('dialog');
const first=page.locator('article').first();
const tags=page.getByLabel('タグで絞り込み');
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ikitai-omise.demo.v1')));
async function edit(){await first.getByRole('button',{name:/のタグを編集$/}).click();await expect(dialog).toBeVisible();}
async function save(){await dialog.getByRole('button',{name:'保存する',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.getByText('タグを保存しました。',{exact:true})).toBeVisible();}
try{
 await page.goto(base);await expect(page.locator('article')).toHaveCount(6);
 await edit();await dialog.getByRole('button',{name:'居酒屋',exact:true}).click();await dialog.getByRole('button',{name:'ランチ',exact:true}).click();
 await dialog.getByLabel('自由入力のタグ').fill('記念日');await dialog.getByLabel('自由入力のタグ').press('Enter');await expect(dialog).toBeVisible();
 await save();await expect(first.locator('.tag-badge')).toHaveText(['居酒屋','ランチ','記念日']);
 await page.reload();await expect(first.locator('.tag-badge')).toHaveText(['居酒屋','ランチ','記念日']);
 await tags.selectOption('tag:記念日');await expect(page.locator('article')).toHaveCount(1);
 await edit();await dialog.getByRole('button',{name:'✓ 居酒屋',exact:true}).click();await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(first.locator('.tag-badge')).toHaveText(['居酒屋','ランチ','記念日']);
 await edit();await dialog.getByRole('button',{name:'✓ 居酒屋',exact:true}).click();await dialog.getByRole('button',{name:'✓ ランチ',exact:true}).click();await dialog.getByRole('button',{name:'✓ 記念日',exact:true}).click();await save();await expect(page.locator('article')).toHaveCount(0);
 await tags.selectOption('');await expect(page.locator('article')).toHaveCount(6);
 await edit();await dialog.getByLabel('自由入力のタグ').fill('長'.repeat(33));await dialog.getByRole('button',{name:'保存する',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('32文字');await expect(dialog).toBeVisible();
 await dialog.getByLabel('自由入力のタグ').fill('パン,ケーキ');await save();await expect(first.locator('.tag-badge')).toHaveText(['パン,ケーキ']);
 await tags.selectOption('tag:パン,ケーキ');await expect(page.locator('article')).toHaveCount(1);
 // A failed local write leaves the original saved tag and dialog intact.
 const before=await saved();await edit();await dialog.getByRole('button',{name:'デザート',exact:true}).click();
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});
 await dialog.getByRole('button',{name:'保存する',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('保存できません');assert.deepEqual(await saved(),before);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await save();await expect(first.locator('.tag-badge')).toHaveText(['パン,ケーキ','デザート']);
 await page.getByRole('button',{name:'お店を追加',exact:true}).click();await dialog.getByLabel('Google MapsのURL',{exact:false}).fill('https://www.google.com/maps/place/Tag+Cafe');
 await dialog.getByRole('button',{name:'ビストロ',exact:true}).click();await dialog.getByLabel('自由入力のタグ').fill('新しいタグ');
 await dialog.getByRole('button',{name:'お店を登録',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(tags).toHaveValue('');
 const added=page.getByRole('article',{name:'Tag Cafe',exact:true});await expect(added.locator('.tag-badge')).toHaveText(['ビストロ','新しいタグ']);
 await page.reload();await expect(added.locator('.tag-badge')).toHaveText(['ビストロ','新しいタグ']);
 await added.getByRole('button',{name:/のタグを編集$/}).click();
 await mkdir('test-results',{recursive:true});
 for(const width of [1365,390,320]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
  const sizes=await dialog.locator('.tag-options button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert.ok(sizes.every(n=>n>=44));
  await page.screenshot({path:`test-results/tags-dialog-${width}.png`});
 }
 await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await page.screenshot({path:'test-results/tags-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS tags UI: presets/custom input, Enter, implicit add on save, removal, cancellation, failure recovery, filtering, persistence and responsive controls.');
}finally{await browser.close();}
