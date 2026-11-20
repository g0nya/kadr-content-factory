# API и модели

В студии откройте «API и модели». Для каждой задачи можно указать собственный ключ. Кнопка «Использовать сохранённый ключ» подставляет ключ из другой задачи с тем же провайдером и адресом API.

| Задача | Провайдеры |
| --- | --- |
| Распознавание речи | OpenRouter, OpenAI, Groq, Deepgram, свой API |
| Поиск моментов | OpenRouter, OpenAI, Groq, Google Gemini, Anthropic, Mistral AI, Ollama, Hermes Agent, OpenClaw, свой API |
| Перевод субтитров | Те же текстовые провайдеры и DeepL Free/Pro |
| Озвучка клипов | OpenRouter, ElevenLabs, Inworld AI, свой API |
| Текст для публикации | Те же текстовые провайдеры, что и для поиска моментов |

OpenRouter распознаёт речь через модель с аудиовходом, поэтому таймкоды могут быть приблизительными. Для OpenAI и Groq при распознавании нужна модель, которая возвращает сегменты с таймкодами. Для DeepL достаточно API-ключа.

## Локальные и кастомные модели

Выберите подключение в карточке задачи, укажите **Базовый URL** и нажмите **Загрузить список моделей**. Кнопка вызывает `GET /models` относительно базового URL. Если сервер не реализует этот маршрут, введите ID вручную и сохраните настройки. КАДР обращается к серверу с ноутбука. Для loopback-адресов доступен HTTP, для остальных адресов нужен HTTPS.

| Подключение | Базовый URL по умолчанию | Что указать |
| --- | --- | --- |
| Ollama | `http://127.0.0.1:11434/v1` | Точный тег установленной модели. Локальный Ollama обычно работает без ключа. |
| Hermes Agent | `http://127.0.0.1:8642/v1` | `API_SERVER_KEY` и ID из списка. Для стандартного профиля это `hermes-agent`. |
| OpenClaw | `http://127.0.0.1:18789/v1` | Токен Gateway и ID из списка, например `openclaw/default`. Для отдельного агента используйте `openclaw/<agentId>`. |
| Свой OpenAI-совместимый API | Укажите адрес, например `http://127.0.0.1:8000/v1` | ID модели и Bearer-токен, если сервер требует авторизацию. |

### Ollama и модель Hermes 3

При запущенной Ollama выполните `ollama pull hermes3:8b`. В КАДРЕ выберите **Ollama** и модель `hermes3:8b`. Для длинных расшифровок модели потребуется достаточное контекстное окно. [Совместимый API Ollama](https://docs.ollama.com/api/openai-compatibility) · [Модель Hermes 3](https://ollama.com/library/hermes3:8b)

### Hermes Agent и OpenClaw

Для Hermes Agent включите `API_SERVER_ENABLED=true`, задайте `API_SERVER_KEY` и запустите `hermes gateway`. В OpenClaw включите `gateway.http.endpoints.chatCompletions.enabled` в настройках Gateway.

Агентные шлюзы применяют свои разрешения при обработке расшифровки. Для КАДРА используйте отдельного локального агента с отключёнными инструментами, внешними подключениями и доступом к файлам. В OpenClaw настройте политику инструментов этого агента. В Hermes проверьте инструменты платформы API Server через `hermes tools`. [API Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) · [Toolsets Hermes](https://hermes-agent.nousresearch.com/docs/reference/toolsets-reference) · [OpenClaw Chat Completions](https://docs.openclaw.ai/gateway/openai-http-api)

### Свой сервер

| Задача | Маршрут относительно базового URL | Контракт |
| --- | --- | --- |
| Поиск моментов, перевод и текст для публикации | `POST /chat/completions` | Ответ `choices[0].message.content` с JSON-массивом по запросу |
| Распознавание речи | `POST /audio/transcriptions` | WAV в multipart и `verbose_json` с массивом `segments`, таймкодами и текстом |
| Озвучка | `POST /audio/speech` | Параметры `model`, `input`, `voice`, `response_format: "mp3"` и бинарный MP3 в ответе |

Ollama, Hermes Agent и OpenClaw в КАДРЕ доступны для текстовых задач. Для распознавания и озвучки можно выбрать другой провайдер в соответствующей карточке.

## Озвучка клипов

1. В «API и модели → Озвучка клипов» выберите провайдера и введите API-ключ. Укажите модель и поддерживаемый ею голос. При выборе провайдера студия предлагает стартовую пару.
2. В окне нового проекта в поле «ИИ-озвучка» выберите «Озвучить речь» или «Озвучить перевод». Для перевода подключите API перевода и выберите целевой язык. Переведённую озвучку можно создать с выключенными субтитрами.
3. Выберите звук для MP4. В режиме «Только ИИ-озвучка» голос заменяет исходную аудиодорожку. В режиме «Оригинал тихо на фоне» студия смешивает две дорожки.
4. Скачайте MP4 из предпросмотра. Если API озвучки вернул ошибку, сведения будут в разделе «Проекты», а клип сохранится с исходным звуком.

| Провайдер | Модель по умолчанию | Поле «Голос / Voice ID» |
| --- | --- | --- |
| OpenRouter | `x-ai/grok-voice-tts-1.0` | Имя голоса модели, например `eve` |
| ElevenLabs | `eleven_multilingual_v2` | Идентификатор из библиотеки ElevenLabs |
| Inworld AI | `inworld-tts-2` | Идентификатор или имя из списка голосов, например `Ashley` |

Озвучка синхронизируется по времени групп реплик. Если синтезированная реплика длиннее своего интервала, студия ускоряет её, чтобы она поместилась.

[Справочник OpenRouter TTS](https://openrouter.ai/blog/tutorials/text-to-speech/) · [ElevenLabs API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert/) · [Inworld API](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech)
