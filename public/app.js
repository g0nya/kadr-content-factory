import {languages, modelField, platforms, providers, supportsTask, tasks} from './providers.js';

const $ = selector => document.querySelector(selector);
const icons = {
  film:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  folder:'<path d="M3 8V6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  key:'<circle cx="8" cy="15" r="5"/><path d="m12 11 8-8 2 2-3 3 2 2-2 2-2-2"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  harddrive:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18m-4 2h1"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  play:'<path d="m8 5 12 7-12 7z"/>', x:'<path d="m6 6 12 12M18 6 6 18"/>',
  sparkles:'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12v6m-3-3h6M4 3v4M2 5h4"/>',
  voice:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/>',
  languages:'<path d="m4 5 7 7m-8 2 7-7c1-1 2-2.5 2-4M2 5h12M8 2v3m5 16 4-10 4 10m-6.8-3h5.6"/>',
  filetext:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 12h8m-8 4h8"/>',
  captions:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 11h3m4 0h3M7 15h6m3 0h1"/>'
};
const svg = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=svg(el.dataset.icon));
const pages={studio:'Студия',projects:'Проекты',clips:'Мои клипы',settings:'API и модели'};
const statuses={queued:'В очереди',transcribing:'Распознаём речь',analyzing:'Ищем интересные моменты',translating:'Переводим субтитры',writing:'Готовим текст для публикации',voicing:'Генерируем озвучку',rendering:'Собираем клипы',done:'Готово',error:'Ошибка'};
const demo = [
  {title:'Почему идеи важнее инструментов',end:22},
  {title:'Что меняется с появлением ИИ',end:17},
  {title:'Как начать делать контент',end:31}
].map((clip,index)=>({...clip,id:String(index+1),start:0,format:'9:16',subtitles:true,demo:true,project:'Демонстрационный проект'}));
let projects=[];
let selected;
let uploading=false;
let toastTimer;
let currentPage;
let projectFilter;
let latestError;
const kinds=Object.keys(tasks);
const requiredKinds=['speech','analysis'];
const extraKinds=['translation','publishing','voiceover'];
const taskFields={};
let config={};
try {
  const saved=JSON.parse(sessionStorage.getItem('kadr-api')||'{}');
  for(const kind of kinds)if(supportsTask(saved?.[kind]?.provider,kind))config[kind]=saved[kind];
} catch {}
const configured=kind=>Boolean(config[kind]?.key&&
  (config[kind].provider==='deepl'||config[kind][modelField(kind)])&&
  (kind!=='voiceover'||config[kind].voice));
const ready=()=>requiredKinds.every(configured);
const saveConfig=()=>{try{sessionStorage.setItem('kadr-api',JSON.stringify(config));}catch{}};
function toast(message){
  const el=$('#toast'); el.textContent=message; el.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,4500);
}
function renderConnection(){
  const count=kinds.filter(configured).length;
  $('#connection-dot').classList.toggle('ready',ready());
  $('#connection-title').textContent=ready()?'Студия настроена':'Требуется настройка API';
  $('#connection-note').textContent=count?'Настроено задач: '+count+' из '+kinds.length:'Настроить провайдеров';
  for(const kind of kinds){
    const state=$('#'+kind+'-state');
    const saved=configured(kind);
    state.dataset.saved=String(saved);
    state.textContent=saved?'Сохранено':requiredKinds.includes(kind)?'Для запуска':'Опционально';
  }
}
function reusableKey(kind) {
  const provider=taskFields[kind].provider.value;
  return kinds.filter(other=>other!==kind).map(other=>taskFields[other])
    .find(fields=>fields?.provider.value===provider&&fields.key.value.trim())?.key.value
    ||Object.values(config).find(item=>item.provider===provider&&item.key)?.key||'';
}
function updateReuseButtons(){
  for(const kind of kinds){
    const fields=taskFields[kind];
    const shared=reusableKey(kind);
    fields.reuse.hidden=!fields.provider.value||!shared||shared===fields.key.value;
  }
}
function renderFields(kind){
  const el=$('#'+kind+'-fields');
  const field=modelField(kind);
  const optional=extraKinds.includes(kind);
  const available=Object.entries(providers).filter(([id])=>supportsTask(id,kind));
  el.innerHTML='<label>Провайдер<select name="'+kind+'-provider">'+(optional?'<option value="">Не подключён</option>':'')+available.map(([id,item])=>'<option value="'+id+'">'+item.title+'</option>').join('')+'</select></label><label>Идентификатор модели<input name="'+kind+'-model" maxlength="160" autocomplete="off"></label><label>API-ключ<input name="'+kind+'-key" type="password" maxlength="400" autocomplete="off" placeholder="Введите API-ключ"></label>';
  const [provider,model,key]=el.querySelectorAll('select,input');
  let voice;
  if(kind==='voiceover'){
    const voiceLabel=node('label','','Голос / Voice ID');
    voice=node('input');
    Object.assign(voice,{name:'voiceover-voice',maxLength:160,autocomplete:'off'});
    voiceLabel.append(voice);
    el.append(voiceLabel);
  }
  const reuse=node('button','reuse-key','Использовать сохранённый ключ');
  reuse.type='button';reuse.hidden=true;
  key.parentElement.append(reuse);
  taskFields[kind]={provider,model,key,reuse,voice};
  const drafts=new Map();
  let previous=config[kind]?.provider||(optional?'':'openrouter');
  if(config[kind])drafts.set(previous,{model:config[kind][field],key:config[kind].key,voice:config[kind].voice});
  provider.value=previous;
  function fill(){
    const id=provider.value;
    const draft=drafts.get(id);
    model.value=draft?.model??providers[id]?.[field]??'';
    key.value=draft?.key??'';
    key.parentElement.hidden=!id;
    key.required=optional&&Boolean(id);
    model.parentElement.hidden=!id||id==='deepl';
    model.required=Boolean(id)&&id!=='deepl';
    if(voice){
      voice.value=draft?.voice??providers[id]?.voice??'';
      voice.parentElement.hidden=!id;
      voice.required=Boolean(id);
    }
  }
  fill();
  provider.addEventListener('change',()=>{
    drafts.set(previous,{model:model.value,key:key.value,voice:voice?.value});
    previous=provider.value;
    fill();
    updateReuseButtons();
  });
  key.addEventListener('input',updateReuseButtons);
  reuse.addEventListener('click',()=>{
    key.value=reusableKey(kind);
    updateReuseButtons();
    key.focus();
  });
}
for(const kind of kinds)renderFields(kind);
renderConnection();
updateReuseButtons();
$('#settings-form').addEventListener('submit',event=>{
  event.preventDefault();
  const next={};
  for(const kind of kinds){
    const {provider,model,key,voice}=taskFields[kind];
    if(provider.value){
      next[kind]={provider:provider.value,[modelField(kind)]:model.value.trim(),key:key.value.trim()};
      if(voice)next[kind].voice=voice.value.trim();
      const missing=[model,key,voice].find(input=>input?.required&&!input.value.trim());
      if(missing){
        toast('Заполните настройки задачи «'+tasks[kind]+'».');
        missing.focus();
        return;
      }
    }
  }
  config=next;
  saveConfig();renderConnection();updateReuseButtons();updateExtras();
  toast('Настройки сохранены');
  if(selected&&ready()){location.hash='studio';$('#upload-dialog').showModal();}
});
function node(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
function clock(time){
  const n=Math.max(0,Math.round(time));
  return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
}
function media(clip,extension){
  return (clip.demo?'/demo/':'/media/'+clip.projectId+'/')+'clip-'+clip.id+'.'+extension;
}
function preview(clip){
  const player=$('#player');
  player.replaceChildren();
  player.src=media(clip,'mp4');
  player.poster=media(clip,'jpg');
  if(clip.subtitles&&!clip.burned){
    const track=node('track');
    Object.assign(track,{kind:'captions',label:languages[clip.subtitleLanguage]||'Субтитры',src:media(clip,'vtt'),default:true});
    if(clip.subtitleLanguage)track.srclang=clip.subtitleLanguage;
    player.append(track);
  }
  $('#preview-title').textContent=clip.title;
  const voicePreview=$('#voice-preview');
  voicePreview.hidden=!clip.voiceover;
  if(clip.voiceover){
    const language=languages[clip.voiceover.language];
    voicePreview.textContent='ИИ-озвучка'+(language?' · '+language:'')+(clip.voiceover.mix?' · Оригинальный звук на фоне':'');
  }
  $('#download-video').href=media(clip,'mp4')+'?download';
  $('#download-srt').hidden=!clip.subtitles;
  $('#download-srt').textContent=clip.subtitleLanguage?'Перевод SRT':'Скачать SRT';
  $('#download-srt').href=media(clip,'srt')+'?download';
  const original=$('#download-original-srt');
  original.hidden=!clip.subtitleLanguage;
  original.href=media(clip,'srt').replace(/\.srt$/,'-original.srt?download');
  const post=clip.post;
  $('#post-preview').hidden=!post;
  if(post){
    const tags=post.hashtags.map(tag=>'#'+tag).join(' ');
    $('#post-platform').textContent=post.platform;
    $('#post-title').textContent=post.title;
    $('#post-description').textContent=post.description;
    $('#post-tags').textContent=tags;
    const copyStatus=$('#copy-status');
    copyStatus.textContent='';
    $('#copy-post').onclick=async()=>{
      try{
        await navigator.clipboard.writeText([post.title,post.description,tags].filter(Boolean).join('\n\n'));
        copyStatus.textContent='Текст скопирован';
      }catch{copyStatus.textContent='Не удалось скопировать текст. Его можно выделить вручную.';}
    };
  }
  $('#preview-dialog').showModal();
  player.play().catch(()=>{});
}
function card(clip){
  const el=node('article','clip');
  const visual=node('button','clip-visual');
  visual.type='button';
  visual.setAttribute('aria-label','Смотреть: '+clip.title);
  const cover=node('img');cover.src=media(clip,'jpg');cover.alt='';
  const play=node('span','play');play.innerHTML=svg('play');
  visual.append(cover,play,node('span','ratio',clip.format==='original'?'Исходный':clip.format),node('span','duration',clock(clip.end-clip.start)));
  visual.onclick=()=>preview(clip);
  const info=node('div','clip-info');
  const copy=node('div');copy.append(node('h3','',clip.title),node('p','',clip.project));
  const download=node('a','icon-button');download.href=media(clip,'mp4')+'?download';download.download='';download.title='Скачать MP4';download.setAttribute('aria-label','Скачать '+clip.title);download.innerHTML=svg('download');
  info.append(copy,download);el.append(visual,info);return el;
}
function render(){
  const real=projects.flatMap(project=>project.clips.map(clip=>({...clip,projectId:project.id,project:project.name})));
  const recent=real.length?real.slice(0,3):demo;
  $('#recent-note').textContent=real.length?'Готовые фрагменты из ваших проектов':'Клипы из демонстрационного проекта';
  $('#recent-clips').replaceChildren(...recent.map(card));
  const all=projectFilter?real.filter(c=>c.projectId===projectFilter):[...real,...demo];
  $('#all-clips').replaceChildren(...all.map(card));
  const list=$('#project-list');
  list.replaceChildren();
  if(!projects.length)list.append(node('p','empty','Загрузите видео в студии, чтобы создать проект.'));
  for(const project of projects){
    const el=node('article','project');
    const details=node('div');
    const date=new Intl.DateTimeFormat('ru',{dateStyle:'medium'}).format(new Date(project.created));
    details.append(node('h2','',project.name),node('p','',date+' · '+statuses[project.status]));
    el.append(details);
    if(project.error)details.append(node('p','error',project.error));
    for(const warning of project.warnings??[])details.append(node('p','warning',warning));
    if(project.status==='done'){
      const link=node('a','button secondary','Клипы · '+project.clips.length);
      link.href='#clips/'+project.id;
      el.append(link);
    } else if(!project.error){
      const progress=node('progress');progress.max=100;progress.value=project.progress;progress.setAttribute('aria-label','Ход обработки');details.append(progress);
      el.append(node('span','',project.progress+'%'));
    }
    list.append(el);
  }
  const job=projects.find(row=>!['done','error'].includes(row.status));
  const status=$('#upload-status');
  status.hidden=!job&&!uploading&&!latestError;
  status.textContent=uploading?'Загружаем видео…':job?statuses[job.status]+' · '+job.progress+'%':latestError||'';
  $('#choose').disabled=Boolean(job)||uploading;
  $('#new').disabled=Boolean(job)||uploading;
}
function navigate(){
  const [name,id]=location.hash.slice(1).split('/');
  const next=Object.hasOwn(pages,name)?name:'studio';
  projectFilter=next==='clips'?id:null;
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==next);
  document.querySelectorAll('[data-page]').forEach(el=>{
    const active=el.dataset.page===next;
    el.classList.toggle('active',active);
    if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
  });
  $('#breadcrumb').replaceChildren('Рабочее пространство ',node('b','','/'),' '+pages[next]);
  if(currentPage!==next)window.scrollTo(0,0);
  currentPage=next;render();drawWave();
  if(next==='settings'&&id==='voiceover')$('#voiceover-settings').scrollIntoView({block:'start'});
}
async function refresh(){
  try{
    const response=await fetch('/api/projects',{cache:'no-store'});
    if(!response.ok)throw Error();
    const next=await response.json();
    if(JSON.stringify(projects)===JSON.stringify(next))return;
    const pending=projects.find(p=>!['done','error'].includes(p.status));
    projects=next;
    const updated=pending&&next.find(p=>p.id===pending.id);
    if(updated?.status==='done')toast(updated.warnings?.[0]||'Клипы готовы');
    if(updated?.status==='error'){latestError=updated.error;toast(updated.error);}
    render();
  }catch{
    $('#upload-status').hidden=false;
    $('#upload-status').textContent='Локальный сервер недоступен.';
  }
}
const uploadForm=$('#upload-form');
const {subtitles,translateTo,publishTo,postLanguage,voiceMode,voiceMix}=uploadForm.elements;
function setChoices(select,choices,placeholder){
  select.add(new Option(placeholder,''));
  for(const [id,title] of Object.entries(choices))select.add(new Option(title,id));
}
setChoices(translateTo,languages,'Без перевода');
setChoices(publishTo,platforms,'Без текста для публикации');
setChoices(postLanguage,languages,'Как в исходном видео');
function updateExtras(){
  voiceMode.disabled=!configured('voiceover');
  voiceMode.querySelector('[value=translated]').disabled=!configured('translation');
  if(voiceMode.disabled||(voiceMode.value==='translated'&&!configured('translation')))voiceMode.value='';
  voiceMix.disabled=!voiceMode.value;
  $('#voice-mix-field').hidden=voiceMix.disabled;
  $('#voice-hint').hidden=configured('voiceover');
  const translatedVoice=voiceMode.value==='translated';
  translateTo.disabled=!configured('translation')||(!subtitles.checked&&!translatedVoice);
  publishTo.disabled=!configured('publishing');
  postLanguage.disabled=publishTo.disabled||!publishTo.value;
  $('#post-language-field').hidden=postLanguage.disabled;
  $('#extra-hint').hidden=configured('translation')&&configured('publishing');
}
subtitles.onchange=updateExtras;
publishTo.onchange=updateExtras;
voiceMode.onchange=()=>{
  updateExtras();
  if(voiceMode.value==='translated')$('#extra-options').open=true;
};
for(const link of document.querySelectorAll('#voice-hint a,#extra-hint a')){
  link.onclick=()=>$('#upload-dialog').close();
}
updateExtras();
const fileInput=$('#file');
function selectFile(file){
  if(!file)return;
  if(!file.size||file.size>1024**3){toast('Выберите непустое видео размером до 1 ГБ.');return;}
  if(uploading||projects.some(p=>!['done','error'].includes(p.status))){toast('Дождитесь завершения текущего проекта.');return;}
  selected=file;
  $('#selected-file').textContent=file.name+' · '+Math.max(.1,Math.round(file.size/104857.6)/10)+' МБ';
  $('#upload-error').textContent='';
  if(!ready()){location.hash='settings';toast('Сохраните ключи, чтобы обработать выбранное видео.');return;}
  $('#upload-dialog').showModal();
}
$('#choose').onclick=()=>fileInput.click();
$('#new').onclick=()=>{location.hash='studio';fileInput.click();};
fileInput.onchange=()=>{selectFile(fileInput.files[0]);fileInput.value='';};
const drop=$('.upload-panel');
drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('drag');});
drop.addEventListener('dragleave',event=>{if(!drop.contains(event.relatedTarget))drop.classList.remove('drag');});
drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('drag');selectFile(event.dataTransfer.files[0]);});
$('#upload-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!selected||uploading)return;
  const form=new FormData(event.target);
  if(form.get('voiceMode')==='translated'&&!translateTo.value){
    $('#extra-options').open=true;
    $('#upload-error').textContent='Выберите язык перевода для озвучки.';
    translateTo.focus();
    return;
  }
  $('#upload-error').textContent='';
  const options={
    analysis:config.analysis,speech:config.speech,
    count:Number(form.get('count')),length:Number(form.get('length')),
    language:form.get('language'),format:form.get('format'),subtitles:form.has('subtitles'),
    translateTo:form.get('translateTo'),publishTo:form.get('publishTo'),postLanguage:form.get('postLanguage'),
    voiceMode:form.get('voiceMode'),mixOriginal:form.get('voiceMix')==='background'
  };
  if(options.translateTo)options.translation=config.translation;
  if(options.publishTo)options.publishing=config.publishing;
  if(options.voiceMode)options.voiceover=config.voiceover;
  const submit=event.target.querySelector('[type=submit]');
  submit.disabled=true;uploading=true;latestError=null;render();
  try{
    const response=await fetch('/api/projects',{method:'POST',body:selected,headers:{'X-Options':encodeURIComponent(JSON.stringify(options)),'X-Filename':encodeURIComponent(selected.name)}});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    projects=[result,...projects.filter(project=>project.id!==result.id)];
    selected=null;
    $('#upload-dialog').close();
  }catch(error){
    $('#upload-error').textContent=error.message||'Ошибка загрузки.';
  }finally{submit.disabled=false;uploading=false;render();}
});
document.querySelectorAll('.close').forEach(el=>el.onclick=()=>el.closest('dialog').close());
$('#preview-dialog').addEventListener('close',()=>{
  const player=$('#player');
  player.pause();player.removeAttribute('src');player.replaceChildren();player.load();
});
function drawWave(){
  const canvas=$('#wave');
  const {width,height}=canvas.getBoundingClientRect();
  if(!width||!height)return;
  const scale=window.devicePixelRatio||1;
  canvas.width=width*scale;canvas.height=height*scale;
  const ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);
  for(let x=9;x<width;x+=6){
    const t=x/width;
    const envelope=Math.exp(-(((t-.16)*5.5)**2))+Math.exp(-(((t-.84)*5.5)**2));
    const middle=Math.min(1,Math.abs(t-.5)*5);
    const size=(7+57*envelope)*(.22+.78*Math.abs(Math.sin(x*.145)*Math.cos(x*.042)));
    ctx.fillStyle='rgba(160,97,255,'+(.09+.32*middle)+')';
    ctx.fillRect(x,(height-size)/2,2,size);
  }
}
window.addEventListener('hashchange',navigate);
window.addEventListener('resize',drawWave);
navigate();
refresh();
setInterval(refresh,2500);
