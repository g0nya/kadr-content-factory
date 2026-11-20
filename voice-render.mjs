import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {synthesize, fail} from './provider-api.mjs';

function speechWindows(cues, clip) {
  const windows=[];
  let current;
  for(const cue of cues){
    const start=Math.max(clip.start,cue.start)-clip.start;
    const end=Math.min(clip.end,cue.end)-clip.start;
    if(!current||start-current.end>1.1||end-current.start>12||current.text.length+cue.text.length>1000){
      current={start,end,text:cue.text};
      windows.push(current);
    } else {
      current.end=Math.max(current.end,end);
      current.text+=' '+cue.text;
    }
  }
  return windows;
}

function fitSpeech(duration, slot) {
  const filters=[];
  let speed=duration/slot;
  while(speed>2){
    filters.push('atempo=2');
    speed/=2;
  }
  if(speed>1.005)filters.push('atempo='+speed.toFixed(5));
  return filters;
}

export async function renderVoice({config, cues, clip, dir, ff, probe}) {
  const windows=speechWindows(cues,clip);
  if(!windows.length)throw fail('В фрагменте нет текста для озвучки.');
  const workdir=join(dir,'voice-'+clip.id);
  await mkdir(workdir);
  const output='clip-'+clip.id+'-voice.wav';
  try {
    const inputs=[];
    const filters=[];
    for(const [index,window] of windows.entries()){
      const end=Math.min(window.end,windows[index+1]?.start??window.end);
      const slot=end-window.start;
      if(slot<.08)continue;
      const part=join(workdir,'part-'+index+'.mp3');
      await writeFile(part,await synthesize(config,window.text));
      const duration=await probe(part);
      if(!Number.isFinite(duration)||duration<=0)throw fail('Провайдер вернул аудио, которое не удалось прочитать.');
      const input=filters.length;
      inputs.push('-i',part);
      const chain=['aformat=sample_rates=48000:channel_layouts=mono',...fitSpeech(duration,slot),'atrim=duration='+slot.toFixed(5),'adelay='+Math.round(window.start*1000)+':all=1'];
      filters.push('['+input+':a]'+chain.join(',')+'[v'+input+']');
    }
    if(!filters.length)throw fail('Длительность реплик слишком мала для озвучки.');
    const sources=filters.map((_,i)=>'[v'+i+']').join('');
    const mix=sources+'amix=inputs='+filters.length+':normalize=0,apad[out]';
    await ff([...inputs,'-filter_complex',[...filters,mix].join(';'),'-map','[out]','-t',String(clip.end-clip.start),'-c:a','pcm_s16le',output],dir);
    return output;
  } finally {
    await rm(workdir,{recursive:true,force:true});
  }
}
