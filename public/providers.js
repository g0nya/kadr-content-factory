export const providers = {
  openrouter: {title:'OpenRouter', model:'google/gemini-2.5-flash', audioModel:'openai/gpt-audio', voiceModel:'x-ai/grok-voice-tts-1.0', voice:'eve'},
  openai: {title:'OpenAI', model:'gpt-4o-mini', audioModel:'whisper-1'},
  groq: {title:'Groq', model:'openai/gpt-oss-120b', audioModel:'whisper-large-v3'},
  gemini: {title:'Google Gemini', model:'gemini-4-hydrogen'},
  anthropic: {title:'Anthropic (Claude)', model:'claude-haiku-5-5'},
  mistral: {title:'Mistral AI', model:'mistral-small-latest'},
  deepgram: {title:'Deepgram', audioModel:'nova-3'},
  deepl: {title:'DeepL'},
  elevenlabs: {title:'ElevenLabs', voiceModel:'eleven_multilingual_v2', voice:'g7LVvkPWALzPxOQbF6OE'},
  inworld: {title:'Inworld AI', voiceModel:'inworld-tts-2', voice:'Ashley'},
  ollama: {
    title:'Ollama', model:'', baseURL:'http://127.0.0.1:11434/v1', optionalKey:true,
    hint:'Выберите установленную модель. Для Hermes 3 укажите hermes3:8b.'
  },
  hermes: {
    title:'Hermes Agent', model:'hermes-agent', baseURL:'http://127.0.0.1:8642/v1',
    hint:'Укажите токен API_SERVER_KEY. Используйте отдельный профиль агента с отключёнными инструментами.'
  },
  openclaw: {
    title:'OpenClaw', model:'openclaw/default', baseURL:'http://127.0.0.1:18789/v1',
    hint:'Включите Chat Completions в Gateway и укажите его токен. Выберите агента без доступа к инструментам.'
  },
  compatible: {
    title:'Свой OpenAI-совместимый API', model:'', audioModel:'', voiceModel:'', baseURL:'', optionalKey:true,
    hint:'Укажите адрес и точный ID модели. Сервер должен поддерживать API для этой задачи.'
  }
};
export const tasks = {
  speech: 'Распознавание речи',
  analysis: 'Поиск моментов',
  translation: 'Перевод субтитров',
  voiceover: 'Озвучка клипов',
  publishing: 'Текст для публикации'
};
export const languages = {
  'ru':'Русский', 'en-US':'Английский', 'de':'Немецкий', 'fr':'Французский',
  'es':'Испанский', 'it':'Итальянский', 'pt-BR':'Португальский (Бразилия)',
  'uk':'Украинский', 'pl':'Польский', 'tr':'Турецкий'
};
export const platforms = {shorts:'YouTube Shorts', reels:'Instagram Reels', tiktok:'TikTok', vk:'VK Клипы'};
export const modelField = kind => kind === 'speech' ? 'audioModel' : kind === 'voiceover' ? 'voiceModel' : 'model';
export const supportsTask = (id, kind) => Object.hasOwn(providers,id) &&
  (id === 'deepl' ? kind === 'translation' : Object.hasOwn(providers[id],modelField(kind)));


export function normalizeBaseURL(value) {
  if(typeof value!=='string'||!value.trim()||value.length>400){
    throw Error('Укажите базовый URL API длиной до 400 символов.');
  }
  let url;
  try { url=new URL(value.trim()); }
  catch { throw Error('Укажите полный URL API с http:// или https://.'); }
  const loopback=url.hostname==='localhost'||url.hostname==='[::1]'||/^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback)){
    throw Error('Используйте HTTPS или HTTP на localhost.');
  }
  if(url.username||url.password||url.search||url.hash||/[?#]/.test(value)){
    throw Error('URL API должен быть без логина, пароля, параметров и фрагмента.');
  }
  let path=url.pathname.replace(/\/+$/,'').replace(/\/(?:chat\/completions|audio\/(?:transcriptions|speech)|models)$/,'');
  if(!path)path='/v1';
  const normalized=url.origin+path;
  if(normalized.length>400)throw Error('Укажите базовый URL API длиной до 400 символов.');
  return normalized;
}

const cleanField = value => typeof value==='string'?value.trim():'';

export function normalizeConnection(item, kind) {
  const id=item?.provider;
  if(!Object.hasOwn(providers,id)||(kind?!supportsTask(id,kind):!Object.hasOwn(providers[id],'baseURL'))){
    throw Error('Выберите провайдера из списка.');
  }
  const provider=providers[id];
  const key=cleanField(item.key);
  if(!key&&!provider.optionalKey)throw Error('Введите API-ключ или токен.');
  if(key.length>400||!/^[\x21-\x7e]*$/.test(key))throw Error('Проверьте API-ключ. Он должен содержать до 400 символов без пробелов.');
  const connection={provider:id,key};
  if(Object.hasOwn(provider,'baseURL'))connection.baseURL=normalizeBaseURL(item.baseURL);
  if(kind&&id!=='deepl'){
    const field=modelField(kind);
    connection[field]=cleanField(item[field]);
    if(!connection[field]||connection[field].length>160)throw Error('Укажите идентификатор модели длиной до 160 символов.');
  }
  if(kind==='voiceover'){
    connection.voice=cleanField(item.voice);
    if(!connection.voice||connection.voice.length>160)throw Error('Укажите голос модели длиной до 160 символов.');
  }
  return connection;
}
