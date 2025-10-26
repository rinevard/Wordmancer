import basePromptMd from '../../dev_docs/prompt_context.md?raw';

const apiKey = import.meta.env.VITE_SOPHNET_API_KEY;
if (!apiKey) {
  throw new Error('VITE_SOPHNET_API_KEY is not set in the environment variables.');
}

const MODEL = import.meta.env.VITE_SOPHNET_MODEL || 'DeepSeek-V3-Fast';
const API_URL = 'https://www.sophnet.com/api/open-apis/v1/chat/completions';

function buildPrompt(currentState, action, pastStates) {
  const inputObj = { past_states: Array.isArray(pastStates) ? pastStates : [], current_state: currentState, action };
  return `${basePromptMd.trim()}\n\n\`\`\`json\n${JSON.stringify(inputObj, null, 2)}\n\`\`\``;
}

function parseSegments(text, analyzeCollector, onAnalyze) {
  const steps = [];
  if (!text || typeof text !== 'string') return steps;

  const tagRegex = /<(analyze|narrator|statechange)>[\s\S]*?<\/\1>/g;
  const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const full = match[0];
    const tag = match[1];
    const inner = full.replace(new RegExp(`^<${tag}>`), '').replace(new RegExp(`<\/${tag}>$`), '').trim();
    if (tag === 'analyze') {
      if (analyzeCollector) analyzeCollector.push(inner);
      try { if (onAnalyze) onAnalyze(inner); } catch (_) {}
      continue;
    }
    if (tag === 'narrator') {
      const cleaned = inner.replace(/^```[\s\S]*?```$/g, '').trim();
      if (cleaned) steps.push({ type: 'narrator', text: cleaned });
      continue;
    }
    if (tag === 'statechange') {
      let jsonText = '';
      const jb = jsonBlock.exec(inner);
      if (jb && jb[1]) {
        jsonText = jb[1].trim();
      } else {
        jsonText = inner.trim();
      }
      try {
        const obj = JSON.parse(jsonText);
        steps.push({ type: 'statechange', state: obj });
      } catch (_) {
        steps.push({ type: 'narrator', text: '[系统提示] 状态片段解析失败。' });
      }
      continue;
    }
  }
  return steps;
}

function extractCompletedSegments(buffer, analyzeCollector, onAnalyze) {
  const steps = [];
  if (!buffer || typeof buffer !== 'string') return { steps, rest: buffer || '' };

  const tagOrder = ['analyze', 'narrator', 'statechange'];

  function findNext() {
    let best = null;
    for (const tag of tagOrder) {
      const open = `<${tag}>`;
      const close = `</${tag}>`;
      const start = buffer.indexOf(open);
      if (start === -1) continue;
      const end = buffer.indexOf(close, start + open.length);
      if (end === -1) continue;
      if (!best || start < best.start) {
        const inner = buffer.slice(start + open.length, end).trim();
        best = { tag, start, end: end + close.length, inner };
      }
    }
    return best;
  }

  while (true) {
    const found = findNext();
    if (!found) break;

    if (found.start > 0) {
      buffer = buffer.slice(found.start);
      continue;
    }

    if (found.tag === 'analyze') {
      if (analyzeCollector) analyzeCollector.push(found.inner);
      try { if (onAnalyze) onAnalyze(found.inner); } catch (_) {}
      buffer = buffer.slice(found.end);
      continue;
    }
    if (found.tag === 'narrator') {
      const cleaned = found.inner.replace(/^```[\s\S]*?```$/g, '').trim();
      if (cleaned) steps.push({ type: 'narrator', text: cleaned });
      buffer = buffer.slice(found.end);
      continue;
    }
    if (found.tag === 'statechange') {
      const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/;
      let jsonText = '';
      const jb = jsonBlock.exec(found.inner);
      if (jb && jb[1]) {
        jsonText = jb[1].trim();
      } else {
        jsonText = found.inner.trim();
      }
      try {
        const obj = JSON.parse(jsonText);
        steps.push({ type: 'statechange', state: obj });
      } catch (_) {
        steps.push({ type: 'narrator', text: '[系统提示] 状态片段解析失败。' });
      }
      buffer = buffer.slice(found.end);
      continue;
    }
  }

  return { steps, rest: buffer };
}

async function* streamSophnet(messages) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model: MODEL,
      stream: true,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`SophNet request failed: ${resp.status} ${resp.statusText} ${text}`);
  }

  const reader = resp.body?.getReader?.();
  if (!reader) {
    const text = await resp.text().catch(() => '');
    yield text;
    return;
  }

  const decoder = new TextDecoder('utf-8');
  let sseBuffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    const lines = sseBuffer.split(/\r?\n/);
    sseBuffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('data:')) {
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          const choice = obj?.choices?.[0];
          const deltaText = choice?.delta?.content ?? choice?.message?.content ?? '';
          if (deltaText) {
            yield deltaText;
          }
        } catch (_) {
          // 不是 JSON，则直接把内容作为增量文本
          yield data;
        }
      } else {
        // 兼容非 SSE 的纯文本分片
        yield trimmed;
      }
    }
  }

  if (sseBuffer) {
    // 冲刷尾部
    yield sseBuffer;
  }
}

export async function* generateStoryStream(currentState, action, options = {}) {
  const prompt = buildPrompt(currentState, action, options.pastStates);
  let buffer = '';
  const analyzeSegments = [];
  let firstCaptured = false;
  const onAnalyze = options?.onFirstAnalyze
    ? (text) => { if (!firstCaptured) { firstCaptured = true; try { options.onFirstAnalyze(text); } catch (_) {} } }
    : null;
  try {
    const messages = [
      { role: 'user', content: prompt },
    ];
    for await (const delta of streamSophnet(messages)) {
      if (!delta) continue;
      buffer += delta;
      const { steps, rest } = extractCompletedSegments(buffer, analyzeSegments, onAnalyze);
      buffer = rest;
      for (const step of steps) {
        yield step;
      }
    }
    if (buffer && buffer.trim()) {
      const remaining = parseSegments(buffer, analyzeSegments, onAnalyze);
      for (const step of remaining) {
        yield step;
      }
    }
    try {
      if (analyzeSegments.length > 0) {
        console.log('[sophnet.analyze] collected analyze segments:', analyzeSegments);
      } else {
        console.log('[sophnet.analyze] no analyze segments');
      }
    } catch (_) {}
  } catch (error) {
    console.error('Error in generateStoryStream (SophNet):', error);
    return;
  }
}


