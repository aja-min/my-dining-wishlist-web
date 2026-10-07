'use client';
import { useState } from 'react';
import { normalizeTags, PRESET_TAGS } from '@/lib/tags';
export function TagEditor({value,onChange,text,onTextChange,suggestions,disabled}: {value:string[];onChange:(tags:string[])=>void;text:string;onTextChange:(text:string)=>void;suggestions:string[];disabled:boolean}) {
  const [error,setError]=useState('');
  const options=[...new Set([...PRESET_TAGS,...value,...suggestions])];
  function toggle(tag:string) {
    try {onChange(normalizeTags(value.includes(tag)?value.filter(v=>v!==tag):[...value,tag]));setError('');}
    catch(e){setError((e as Error).message);}
  }
  function add() {
    if (!text.trim()) return;
    try {onChange(normalizeTags([...value,text]));onTextChange('');setError('');}
    catch(e){setError((e as Error).message);}
  }
  return <fieldset className="tag-editor" disabled={disabled}><legend>タグ（複数選択可）</legend><div className="tag-options">{options.map(tag=><button key={tag} type="button" aria-pressed={value.includes(tag)} onClick={()=>toggle(tag)}>{value.includes(tag)?'✓ ':''}{tag}</button>)}</div><label htmlFor="custom-tag">自由入力のタグ</label><div className="tag-input"><input id="custom-tag" value={text} onChange={e=>{onTextChange(e.target.value);setError('');}} placeholder="例：カフェ、記念日など" onKeyDown={e=>{if(e.key==='Enter' && !e.nativeEvent.isComposing){e.preventDefault();add();}}}/><button type="button" onClick={add} disabled={!text.trim()}>追加</button></div><p className="muted">選択したタグを押すと外せます。1つ32文字・20個まで。</p>{error && <p className="tag-error" role="alert">{error}</p>}</fieldset>;
}
