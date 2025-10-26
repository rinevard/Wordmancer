import { GoogleGenerativeAI } from '@google/generative-ai';
import basePromptMd from '../../dev_docs/prompt_context.md?raw';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('VITE_GEMINI_API_KEY is not set in the environment variables.');
}
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

function buildPrompt(currentState, action, pastStates) {
  const inputObj = { past_states: Array.isArray(pastStates) ? pastStates : [], current_state: currentState, action };
  return `${basePromptMd.trim()}\n\n\`\`\`json\n${JSON.stringify(inputObj, null, 2)}\n\`\`\``;
}

function parseSegments(text, analyzeCollector, onAnalyze) {
  const steps = [];
  if (!text || typeof text !== 'string') return steps;

  // 提取所有片段，保持顺序
  const tagRegex = /<(analyze|narrator|statechange)>[\s\S]*?<\/\1>/g;
  const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const full = match[0];
    const tag = match[1];
    const inner = full.replace(new RegExp(`^<${tag}>`), '').replace(new RegExp(`<\/${tag}>$`), '').trim();
    if (tag === 'analyze') {
      // 收集 analyze 段落
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
        // 尝试直接解析内部文本
        jsonText = inner.trim();
      }
      try {
        const obj = JSON.parse(jsonText);
        steps.push({ type: 'statechange', state: obj });
      } catch (e) {
        // 忽略无法解析的 statechange
        // 也可选择将其作为旁白提示
        steps.push({ type: 'narrator', text: '[系统提示] 状态片段解析失败。' });
      }
      continue;
    }
  }
  return steps;
}

export async function generateStory(currentState, action, options = {}) {
  const prompt = buildPrompt(currentState, action, options.pastStates);
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const analyzeSegments = [];
    let firstCaptured = false;
    const onAnalyze = options?.onFirstAnalyze
      ? (t) => { if (!firstCaptured) { firstCaptured = true; try { options.onFirstAnalyze(t); } catch (_) {} } }
      : null;
    const steps = parseSegments(text, analyzeSegments, onAnalyze);
    try {
      // 打印所有 analyze 段
      if (analyzeSegments.length > 0) {
        console.log('[gemini.analyze] collected analyze segments:', analyzeSegments);
      } else {
        console.log('[gemini.analyze] no analyze segments');
      }
    } catch (_) {
      // 忽略日志异常
    }
    return steps;
  } catch (error) {
    console.error('Error generating story/segments:', error);
    return [];
  }
}

// 增量解析：从缓冲区中提取按顺序完成的段落，返回解析出的 steps 以及剩余未完整的缓冲
function extractCompletedSegments(buffer, analyzeCollector, onAnalyze) {
  const steps = [];
  if (!buffer || typeof buffer !== 'string') return { steps, rest: buffer || '' };

  const tagOrder = ['analyze', 'narrator', 'statechange'];

  // 在缓冲区中查找最近的一个已闭合标签片段
  function findNext() {
    let best = null; // { tag, start, end, inner }
    for (const tag of tagOrder) {
      const open = `<${tag}>`;
      const close = `</${tag}>`;
      const start = buffer.indexOf(open);
      if (start === -1) continue;
      const end = buffer.indexOf(close, start + open.length);
      if (end === -1) continue; // 未闭合，等更多数据
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

    // 丢弃前置的无关文本（可能来自未支持标签或噪声）
    if (found.start > 0) {
      buffer = buffer.slice(found.start);
      // 重新定位当前片段为起始
      continue;
    }

    // 处理片段
    if (found.tag === 'analyze') {
      // 收集分析段
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
      } catch (e) {
        steps.push({ type: 'narrator', text: '[系统提示] 状态片段解析失败。' });
      }
      buffer = buffer.slice(found.end);
      continue;
    }
  }

  return { steps, rest: buffer };
}

// 流式输出：返回一个异步生成器，逐段产出 { type, text | state }
export async function* generateStoryStream(currentState, action, options = {}) {
  const prompt = buildPrompt(currentState, action, options.pastStates);
  let buffer = '';
  const analyzeSegments = [];
  let firstCaptured = false;
  const onAnalyze = options?.onFirstAnalyze
    ? (text) => { if (!firstCaptured) { firstCaptured = true; try { options.onFirstAnalyze(text); } catch (_) {} } }
    : null;
  try {
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const delta = chunk.text();
      if (!delta) continue;
      buffer += delta;
      const { steps, rest } = extractCompletedSegments(buffer, analyzeSegments, onAnalyze);
      buffer = rest;
      for (const step of steps) {
        yield step;
      }
    }
    // 流结束，尝试冲刷剩余缓冲
    if (buffer && buffer.trim()) {
      const remaining = parseSegments(buffer, analyzeSegments, onAnalyze);
      for (const step of remaining) {
        yield step;
      }
    }
    // 打印所有 analyze 段
    try {
      if (analyzeSegments.length > 0) {
        console.log('[gemini.analyze] collected analyze segments:', analyzeSegments);
      } else {
        console.log('[gemini.analyze] no analyze segments');
      }
    } catch (_) {
      // 忽略日志异常
    }
  } catch (error) {
    console.error('Error in generateStoryStream:', error);
    return;
  }
}