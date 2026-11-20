import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {once} from 'node:events';
import {cp, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';

const ffmpeg=process.env.FFMPEG||'ffmpeg';
const fixture=new URL('../public/demo/clip-1.mp4',import.meta.url);

test('экспорт с ИИ-озвучкой, переводом и резервной аудиодорожкой', {timeout:60000}, async t=>{
  const dir=await mkdtemp(join(tmpdir(),'kadr-test-'));
  let server;
  t.after(async()=>{
    if(server&&server.exitCode===null&&server.signalCode===null){
      const exit=once(server,'exit');
      server.kill();
      await exit;
    }
    await rm(dir,{force:true,recursive:true});
  });
  for(const file of ['server.mjs','provider-api.mjs','voice-render.mjs','package.json','public/providers.js']){
    await cp(new URL('../'+file,import.meta.url),join(dir,file));
  }
  execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=997:duration=3','-c:a','libmp3lame',join(dir,'voice.mp3')]);
  await writeFile(join(dir,'mock.mjs'),mockAPI);
  const port=await availablePort();
  server=spawn(process.execPath,['--import',join(dir,'mock.mjs'),join(dir,'server.mjs')],{env:{...process.env,PORT:String(port)}});
  await Promise.race([
    once(server.stdout,'data'),
    once(server,'exit').then(([code])=>{throw Error('Тестовый сервер завершился, код '+code);})
  ]);
  const base='http://127.0.0.1:'+port;
  const video=await readFile(fixture);
  const audioModel={provider:'openrouter',key:'fixture',audioModel:'fixture'};
  const model={provider:'openrouter',key:'fixture',model:'fixture'};
  const voice=(provider,key='fixture')=>({provider,key,voiceModel:'fixture',voice:'fixture'});
  const upload=(overrides)=>fetch(base+'/api/projects',{
    method:'POST',body:video,
    headers:{'X-Options':encodeURIComponent(JSON.stringify({speech:audioModel,analysis:model,count:1,...overrides})),'X-Filename':'demo.mp4'}
  });

  await t.test('OpenRouter добавляет синтезированный голос в скачиваемый MP4',async()=>{
    const project=await finished(await upload({voiceMode:'original',voiceover:voice('openrouter')}),base);
    assert.deepEqual(project.clips[0].voiceover,{language:null,mix:false});
    const {url,file}=await download(base,dir,project);
    assert.match(await (await fetch(url+'.srt')).text(),/Первая реплика/);
    assert.ok(containsTone(file),'Дорожка MP4 должна содержать звук TTS');
    assert.deepEqual(project.warnings,[]);
  });
  await t.test('ElevenLabs озвучивает перевод с фоновым звуком и выключенными субтитрами',async()=>{
    const response=await upload({subtitles:false,voiceMode:'translated',voiceover:voice('elevenlabs'),translateTo:'en-US',translation:model,mixOriginal:true});
    const project=await finished(response,base);
    assert.deepEqual(project.clips[0].voiceover,{language:'en-US',mix:true});
    const {url,file}=await download(base,dir,project);
    assert.equal((await fetch(url+'.srt')).status,404);
    assert.ok(containsTone(file));
  });
  await t.test('Inworld поддерживает отдельный ключ и возвращает аудио в JSON',async()=>{
    const project=await finished(await upload({voiceMode:'original',voiceover:voice('inworld')}),base);
    assert.ok(project.clips[0].voiceover);
    assert.ok(containsTone((await download(base,dir,project)).file));
    const stored=await readFile(join(dir,'data',project.id,'project.json'),'utf8');
    assert.ok(!stored.includes('"key"'));
  });
  await t.test('ошибка API озвучки сохраняет клип с исходным звуком',async()=>{
    const project=await finished(await upload({voiceMode:'original',voiceover:voice('openrouter','bad')}),base);
    assert.match(project.warnings[0],/OpenRouter.*401/);
    assert.equal(project.clips[0].voiceover,undefined);
    assert.ok(!containsTone((await download(base,dir,project)).file));
  });
  await t.test('озвучка перевода требует выбранного языка',async()=>{
    const response=await upload({voiceMode:'translated',voiceover:voice('openrouter')});
    assert.equal(response.status,400);
    assert.match((await response.json()).error,/Выберите язык/);
  });
});

async function availablePort(){
  const socket=createServer();
  await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const {port}=socket.address();
  await new Promise(resolve=>socket.close(resolve));
  return port;
}

async function finished(response,base){
  const result=await response.json();
  assert.equal(response.status,202,JSON.stringify(result));
  for(let remaining=150;remaining>0;remaining--){
    const jobs=await (await fetch(base+'/api/projects')).json();
    const job=jobs.find(item=>item.id===result.id);
    assert.notEqual(job?.status,'error',job?.error);
    if(job?.status==='done')return job;
    await delay(100);
  }
  throw Error('Обработка не завершилась в тесте');
}
async function download(base,dir,project){
  const url=base+'/media/'+project.id+'/clip-1';
  const response=await fetch(url+'.mp4?download');
  assert.match(response.headers.get('content-disposition')??'',/attachment/);
  const file=join(dir,project.id+'.mp4');
  await writeFile(file,Buffer.from(await response.arrayBuffer()));
  return {url,file};
}

function containsTone(file){
  const samples=execFileSync(ffmpeg,['-v','error','-ss','0.3','-i',file,'-t','0.6','-vn','-ac','1','-ar','8000','-f','s16le','pipe:1']);
  let sine=0,cosine=0;
  for(let i=0;i<samples.length/2;i++){
    const phase=2*Math.PI*997*i/8000;
    const sample=samples.readInt16LE(i*2);
    sine+=sample*Math.sin(phase);
    cosine+=sample*Math.cos(phase);
  }
  return Math.hypot(sine,cosine)/(samples.length/2)>200;
}

const mockAPI=String.raw`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const audio=await readFile(new URL('./voice.mp3',import.meta.url));
globalThis.fetch=async(url,options)=>{
  const uri=new URL(url);
  const request=JSON.parse(options.body);
  const headers=new Headers(options.headers);
  if(uri.pathname.endsWith('/chat/completions')){
    const content=request.messages[0].content;
    const output=Array.isArray(content)
      ? [{start:1,end:3,text:'Первая реплика'},{start:5,end:7,text:'Вторая реплика'}]
      : content.startsWith('Translate each')
        ? JSON.parse(content.split('\n').at(-1)).map(()=>'English line')
        : [{first:0,last:1,title:'Тест озвучки'}];
    return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});
  }
  if(uri.hostname==='api.elevenlabs.io'){
    assert.equal(headers.get('xi-api-key'),'fixture');
    assert.match(uri.pathname,/text-to-speech\/fixture/);
    assert.match(request.text,/English line/);
  } else if(uri.hostname==='api.inworld.ai'){
    assert.equal(headers.get('authorization'),'Basic fixture');
    assert.equal(request.voiceId,'fixture');
    return Response.json({audioContent:audio.toString('base64')});
  } else {
    assert.equal(uri.pathname,'/api/v1/audio/speech');
    if(headers.get('authorization')==='Bearer bad')return Response.json({}, {status:401});
    assert.equal(request.response_format,'mp3');
    assert.match(request.input,/реплика/);
  }
  return new Response(audio,{headers:{'Content-Type':'audio/mpeg'}});
};
`;
