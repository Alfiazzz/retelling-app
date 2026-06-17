import { Agent } from 'node:https'
import { Agent as UndiciAgent } from 'undici'

const AI_AVAILABLE = !!process.env.GIGACHAT_KEY
const sslAgent = new UndiciAgent({ connect: { rejectUnauthorized: false } })

function mockAnalyzeRetelling(originalText, retelling) {
  const origWords = originalText.trim().split(/\s+/).length
  const retellWords = retelling.trim().split(/\s+/).length
  const score = Math.min(100, Math.round((retellWords / (origWords * 0.4)) * 100))
  const verdict = score >= 80 ? 'good' : score >= 50 ? 'partial' : 'poor'
  return { score, verdict, keyPoints: ['Простая оценка'], missed: verdict !== 'good' ? ['Добавь GIGACHAT_KEY'] : [] }
}

function mockCheckAnswer(userAnswer) {
  return { result: userAnswer.trim().length > 3 ? 'correct' : 'wrong', explanation: 'Ответ принят.', correctAnswer: '' }
}

async function getAccessToken() {
  console.log('Получаю токен GigaChat...')
  const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.GIGACHAT_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'RqUID': crypto.randomUUID(),
    },
    body: 'scope=GIGACHAT_API_PERS',
    dispatcher: sslAgent,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GigaChat auth error: ${res.status} — ${err}`)
  }
  const data = await res.json()
  return data.access_token
}

async function askAI(systemPrompt, userPrompt) {
  const token = await getAccessToken()
  console.log('Отправляю запрос к GigaChat...')
  const res = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'GigaChat-2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
    dispatcher: sslAgent,
  })
  if (!res.ok) {
    const err = await res.text()
    console.log(`GigaChat ошибка: ${res.status} — ${err}`)
    throw new Error(`GigaChat error: ${res.status}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Пустой ответ от GigaChat')
  console.log('GigaChat ответил успешно')
  return text
}

export async function analyzeRetelling(originalText, retelling) {
  if (!AI_AVAILABLE) return mockAnalyzeRetelling(originalText, retelling)
  const system = `Ты — эксперт по проверке детских пересказов. Твоя задача — оценить, насколько точно ребёнок передал СМЫСЛ исходного текста своими словами.
Важнейшие правила:
1. Не требуй дословного совпадения. Ребёнок может перефразировать, использовать синонимы, менять порядок слов, объединять или разделять предложения — это правильно.
2. Ошибкой считается только:
   - потеря ключевого события или факта (который есть в оригинале);
   - искажение смысла (например, персонаж сделал не то, что в тексте);
   - добавление вымышленного события, которого нет в оригинале;
   - нарушение логической последовательности, которая важна для понимания сюжета.
3. Не придумывай ошибок. Если смысл передан верно, даже если формулировки другие — ставь 100%.
4. Не обращай внимания на грамматику, порядок слов, повторения, паузы, новые слова, которых нет в оригинале — это не важно для смысловой точности.
5. Если у ребёнка в пересказе есть лишние детали, которых нет в оригинале, но они не искажают смысл — не снижай оценку.
Критерии оценки (только эти):
- Переданы ли все ключевые смысловые блоки (кто, что сделал, где, с кем, чем закончилось)?
- Нет ли фактических искажений (неправильные действия персонажей, неверная последовательность)?
- Не добавлено ли вымышленного, что противоречит оригиналу?
Формат ответа:
- Процент смысловой точности (0–100).
- Если есть ошибки — кратко: какой смысловой блок пропущен или искажён.
- Если ошибок нет — просто: «100%», без дальнейших комментариев.
Пример правильной оценки (пересказ своими словами):
Оригинал: «Кот ловил мышей. Мышка убежала в норку. Кот не смог её достать.»
Пересказ: «Котик охотился за мышкой, но она спряталась в норку, и он её не поймал.»
Оценка: 100% (смысл полностью сохранён, хотя формулировки другие).
Запомни: ты проверяешь СМЫСЛ, а не слова. 
Ты НИКОГДА НЕ ДОЛЖЕН:
- Генерировать, поощрять или как-либо реагировать на нецензурную лексику, оскорбления, унижения.
- Обсуждать, упоминать или давать информацию о суициде, самоповреждении, насилии, жестокости, буллинге.
- Предоставлять любые сведения о наркотиках, алкоголе, табаке, сексуальном контексте.
- Запрашивать или выдавать личную информацию (адреса, телефоны, пароли).
- Отвечать на вопросы, не относящиеся к анализу пересказа.
Если пользователь ввёл текст, содержащий что-либо из перечисленного выше, ты обязан ответить строго одной из следующих фраз (выбери наиболее подходящую):
- «Ой! В твоём тексте есть слова, которые я не могу проверять. Давай перепишем без них!»
- «Этот текст содержит то, что мне нельзя анализировать. Попробуй ещё раз, пожалуйста!»

Никаких других объяснений, оценок или анализа в таких случаях не давай.
Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.`
  const user = `Текст:\n"""\n${originalText.slice(0, 3000)}\n"""\nПересказ:\n"""\n${retelling.slice(0, 2000)}\n"""\nВерни JSON:\n{"score": <0-100>, "verdict": "good"|"partial"|"poor", "keyPoints": ["..."], "missed": ["..."]}`
  const raw = await askAI(system, user)
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('GigaChat не вернул JSON: ' + cleaned.slice(0, 100))
  return JSON.parse(match[0])
}

export async function checkAnswer(question, userAnswer, originalText) {
  if (!AI_AVAILABLE) return mockCheckAnswer(userAnswer)
  const system = `Ты — эксперт по проверке детских пересказов. Твоя задача — оценить, насколько точно ребёнок передал СМЫСЛ исходного текста своими словами.
Важнейшие правила:
1. Не требуй дословного совпадения. Ребёнок может перефразировать, использовать синонимы, менять порядок слов, объединять или разделять предложения — это правильно.
2. Ошибкой считается только:
   - потеря ключевого события или факта (который есть в оригинале);
   - искажение смысла (например, персонаж сделал не то, что в тексте);
   - добавление вымышленного события, которого нет в оригинале;
   - нарушение логической последовательности, которая важна для понимания сюжета.
3. Не придумывай ошибок. Если смысл передан верно, даже если формулировки другие — ставь 100%.
4. Не обращай внимания на грамматику, порядок слов, повторения, паузы, новые слова, которых нет в оригинале — это не важно для смысловой точности.
5. Если у ребёнка в пересказе есть лишние детали, которых нет в оригинале, но они не искажают смысл — не снижай оценку.
Критерии оценки (только эти):
- Переданы ли все ключевые смысловые блоки (кто, что сделал, где, с кем, чем закончилось)?
- Нет ли фактических искажений (неправильные действия персонажей, неверная последовательность)?
- Не добавлено ли вымышленного, что противоречит оригиналу?
Формат ответа:
- Процент смысловой точности (0–100).
- Если есть ошибки — кратко: какой смысловой блок пропущен или искажён.
- Если ошибок нет — просто: «100%», без дальнейших комментариев. 
Пример правильной оценки (пересказ своими словами):
Оригинал: «Кот ловил мышей. Мышка убежала в норку. Кот не смог её достать.»
Пересказ: «Котик охотился за мышкой, но она спряталась в норку, и он её не поймал.»
Оценка: 100% (смысл полностью сохранён, хотя формулировки другие).
Запомни: ты проверяешь СМЫСЛ, а не слова.
Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.`
  const user = `Текст:\n"""\n${originalText.slice(0, 2000)}\n"""\nВопрос: ${question}\nОтвет: ${userAnswer}\nВерни JSON:\n{"result": "correct"|"partial"|"wrong", "explanation": "...", "correctAnswer": "..."}`
  const raw = await askAI(system, user)
const cleaned = raw.replace(/```json|```/g, '').trim()
const match = cleaned.match(/\{[\s\S]*\}/)
if (!match) throw new Error('GigaChat не вернул JSON: ' + cleaned.slice(0, 100))
return JSON.parse(match[0])
}
