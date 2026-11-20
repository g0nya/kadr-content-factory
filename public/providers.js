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
  inworld: {title:'Inworld AI', voiceModel:'inworld-tts-2', voice:'Ashley'}
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
  (id === 'deepl' ? kind === 'translation' : Boolean(providers[id][modelField(kind)]));
