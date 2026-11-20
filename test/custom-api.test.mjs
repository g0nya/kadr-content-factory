import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {cp, mkdtemp, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {chat, synthesize} from '../provider-api.mjs';
import {normalizeBaseURL, normalizeConnection} from '../public/providers.js';

test('проверка URL, токенов и поддерживаемых задач',()=>{
  assert.equal(normalizeBaseURL('http://127.0.0.1:11434/'),'http://127.0.0.1:11434/v1');
  assert.equal(normalizeBaseURL('http://[::1]:8642/v1/chat/completions'),'http://[::1]:8642/v1');
  assert.equal(normalizeBaseURL('https://api.example.com/team/openai/v1/models/'),'https://api.example.com/team/openai/v1');
  for(const url of ['file:///etc/passwd','ftp://localhost','http://example.com','https://user:pass@example.com','https://example.com/v1?token=abc']){
    assert.throws(()=>normalizeBaseURL(url));
  }
  const ollama={provider:'ollama',baseURL:'http://localhost:11434/v1',model:'hermes3:8b'};
  assert.equal(normalizeConnection(ollama,'analysis').key,'');
  assert.throws(()=>normalizeConnection(ollama,'speech'),/провайдера/);
  for(const [provider,model] of [['hermes','hermes-agent'],['openclaw','openclaw/default']]){
    assert.throws(()=>normalizeConnection({...ollama,provider,model},'analysis'),/ключ/);
  }
});

test('совместимый API получает нужные пути, модели и токены', {timeout:45000}, async t=>{
  const calls=[];
  let mockError;
  let leaked=false;
  const upstream=createServer(async(req,res)=>{
    try {
      const {authorization}=req.headers;
      calls.push({path:req.url,method:req.method,authorization});
      if(req.url==='/v1/models'){
        assert.equal(req.method,'GET');
        assert.equal(authorization,undefined);
        return reply(res,{data:[{id:'hermes3:8b'},{id:'hermes3:8b'},{id:'qwen3:8b'},{id:123}]});
      }
      if(req.url==='/gateway/v1/models'){
        assert.equal(authorization,'Bearer gateway-token');
        return reply(res,{data:[{id:'openclaw/default'}]});
      }
      if(req.url==='/redirect/v1/models')return res.writeHead(302,{Location:'/leak'}).end();
      if(req.url==='/leak'){leaked=true;return reply(res,{});}
      if(req.url==='/voice/v1/audio/speech'){
        assert.equal(authorization,'Bearer voice-token');
        assert.deepEqual(await readJSON(req),{model:'my-tts',input:'Demo',voice:'sample',response_format:'mp3'});
        return res.writeHead(200,{'Content-Type':'audio/mpeg'}).end(Buffer.from([1,2,3]));
      }
      if(req.url==='/asr/v1/audio/transcriptions'){
        assert.equal(authorization,undefined);
        assert.match(req.headers['content-type'],/^multipart\/form-data/);
        await readBody(req);
        return reply(res,{segments:[{start:1,end:3,text:'Первая реплика'},{start:3,end:6,text:'Вторая реплика'}]});
      }
      const data=await readJSON(req);
      assert.equal(data.stream,false);
      if(req.url==='/v1/chat/completions'){
        assert.equal(data.model,'hermes3:8b');
        assert.equal(authorization,undefined);
        return completion(res,'<think>[123]</think>\n[{"first":0,"last":1,"title":"Клип из Ollama"}]');
      }
      const expected=req.url==='/gateway/v1/chat/completions'?'openclaw/default':'hermes-agent';
      assert.equal(data.model,expected);
      assert.equal(authorization,'Bearer gateway-token');
      return completion(res,'["Перевод"]');
    }catch(error){
      mockError=error;
      res.writeHead(500).end();
    }
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const upstreamBase='http://127.0.0.1:'+upstream.address().port;
  const dir=await mkdtemp(join(tmpdir(),'kadr-custom-api-'));
  let studio;
  t.after(async()=>{
    if(studio&&studio.exitCode===null&&studio.signalCode===null){
      const exit=once(studio,'exit');
      studio.kill();
      await exit;
    }
    await new Promise(resolve=>upstream.close(resolve));
    await rm(dir,{force:true,recursive:true});
    assert.equal(mockError,undefined);
  });
  const ollama={provider:'ollama',baseURL:upstreamBase,model:'hermes3:8b'};
  const claw={provider:'openclaw',baseURL:upstreamBase+'/gateway/v1',model:'openclaw/default',key:'gateway-token'};
  const hermes={...claw,provider:'hermes',baseURL:upstreamBase+'/hermes/v1',model:'hermes-agent'};
  for(const connection of [claw,hermes])assert.deepEqual(await chat(normalizeConnection(connection,'translation'),'Demo'),['Перевод']);
  const tts=normalizeConnection({provider:'compatible',baseURL:upstreamBase+'/voice/v1',voiceModel:'my-tts',key:'voice-token',voice:'sample'},'voiceover');
  assert.deepEqual(await synthesize(tts,'Demo'),Buffer.from([1,2,3]));

  for(const file of ['server.mjs','provider-api.mjs','voice-render.mjs','package.json','public/providers.js']){
    await cp(new URL('../'+file,import.meta.url),join(dir,file));
  }
  const port=await unusedPort();
  studio=spawn(process.execPath,[join(dir,'server.mjs')],{env:{...process.env,PORT:String(port)}});
  await Promise.race([once(studio.stdout,'data'),once(studio,'exit').then(([code])=>{throw Error('Studio startup: '+code);})]);
  const base='http://127.0.0.1:'+port;
  const models=(data,headers={})=>fetch(base+'/api/models',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  assert.deepEqual(await (await models(ollama)).json(),{models:['hermes3:8b','qwen3:8b']});
  assert.deepEqual(await (await models(claw)).json(),{models:['openclaw/default']});
  assert.equal((await models({...claw,baseURL:upstreamBase+'/redirect/v1'})).status,400);
  assert.equal(leaked,false);
  const before=calls.length;
  assert.equal((await models(claw,{Origin:'https://example.com'})).status,403);
  assert.equal((await models({...claw,baseURL:'http://example.com/v1'})).status,400);
  assert.equal(calls.length,before);

  const options={speech:{provider:'compatible',baseURL:upstreamBase+'/asr/v1',audioModel:'local-whisper'},analysis:ollama,count:1};
  const sent=await fetch(base+'/api/projects',{
    method:'POST',body:await readFile(new URL('../public/demo/clip-1.mp4',import.meta.url)),
    headers:{'X-Options':encodeURIComponent(JSON.stringify(options)),'X-Filename':'fixture.mp4'}
  });
  const queued=await sent.json();
  assert.equal(sent.status,202,JSON.stringify(queued));
  for(let i=0;i<100;i++){
    const result=await (await fetch(base+'/api/projects')).json();
    const project=result.find(row=>row.id===queued.id);
    assert.notEqual(project.status,'error',project.error);
    if(project.status==='done'){
      assert.equal(project.clips[0].title,'Клип из Ollama');
      const mp4=await fetch(base+'/media/'+project.id+'/clip-1.mp4?download');
      assert.ok(mp4.ok);
      await mp4.body.cancel();
      return;
    }
    await delay(100);
  }
  throw Error('Проект не завершился');
});

async function unusedPort(){
  const socket=createServer();
  await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const {port}=socket.address();
  await new Promise(resolve=>socket.close(resolve));
  return port;
}
async function readBody(req){
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function readJSON(req){return JSON.parse((await readBody(req)).toString('utf8'));}
function reply(res,data){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data));}
function completion(res,content){reply(res,{choices:[{message:{content}}]});}
