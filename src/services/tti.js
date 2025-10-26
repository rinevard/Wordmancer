import imgPromptTpl from '../../dev_docs/img_prompt.md?raw';

const apiKey = import.meta.env.VITE_SOPHNET_API_KEY;
if (!apiKey) {
  throw new Error('VITE_SOPHNET_API_KEY is not set in the environment variables.');
}

// 固定配置：按示例值，可通过环境变量覆写
const PROJECT_ID = import.meta.env.VITE_SOPHNET_PROJECT_ID || '3SEkXt23xpXqc8dSfVrQYc';
const EASYLLM_ID = import.meta.env.VITE_SOPHNET_TTI_EASYLLM_ID || '4WIr64tflXmVuYz9lgKbtI';
const MODEL = import.meta.env.VITE_SOPHNET_TTI_MODEL || 'qwen-image';
const SIZE = import.meta.env.VITE_TTI_SIZE || '1328*1328';
const SEED = Number.isFinite(Number(import.meta.env.VITE_TTI_SEED)) ? Number(import.meta.env.VITE_TTI_SEED) : Math.floor(Math.random() * 123456);
const STEPS = Number.isFinite(Number(import.meta.env.VITE_TTI_STEPS)) ? Number(import.meta.env.VITE_TTI_STEPS) : 30;

const BASE = 'https://www.sophnet.com/api/open-apis/projects';

// 简单内存缓存：name -> url
const nameToUrl = new Map();

function buildPromptForName(minionName) {
  const safeName = String(minionName || '').trim() || '无名随从';
  return imgPromptTpl.replace('[随从名称]', safeName);
}

async function createTask(prompt) {
  const url = `${BASE}/${encodeURIComponent(PROJECT_ID)}/easyllms/texttoimage/task`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      easyllm_id: EASYLLM_ID,
      model: MODEL,
      input: { prompt },
      parameters: {
        size: SIZE,
        seed: SEED,
        steps: STEPS
      }
    })
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`TTI createTask failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  const data = await resp.json().catch(() => ({}));
  // 兼容多种返回体：优先 task_id 字段
  const taskId = data?.task_id || data?.output?.taskId || data?.data?.task_id || data?.data?.taskId;
  if (!taskId) throw new Error('TTI createTask: missing task_id');
  return taskId;
}

async function getTaskStatus(taskId) {
  const url = `${BASE}/${encodeURIComponent(PROJECT_ID)}/easyllms/texttoimage/task/${encodeURIComponent(taskId)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`TTI getTaskStatus failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  const data = await resp.json().catch(() => ({}));
  const status = data?.output?.taskStatus || data?.status || data?.data?.status;
  const urlResult = data?.output?.results?.[0]?.url || data?.results?.[0]?.url || data?.data?.results?.[0]?.url;
  return { status, url: urlResult };
}

async function pollTaskResult(taskId, {
  intervalMs = 1500,
  timeoutMs = 120000,
} = {}) {
  const start = Date.now();
  while (true) {
    const { status, url } = await getTaskStatus(taskId);
    if ((status === 'SUCCEEDED' || status === 'SUCCESSED') && url) return url;
    if (status === 'FAILED' || status === 'CANCELED') throw new Error(`TTI task ${taskId} ${status}`);
    if (Date.now() - start > timeoutMs) throw new Error(`TTI task ${taskId} timeout`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function getOrGenerateMinionImage(minionName) {
  const key = String(minionName || '').trim();
  if (!key) return null;
  if (nameToUrl.has(key)) return nameToUrl.get(key);
  const prompt = buildPromptForName(key);
  const taskId = await createTask(prompt);
  const url = await pollTaskResult(taskId);
  nameToUrl.set(key, url);
  return url;
}

export function getCachedImage(minionName) {
  const key = String(minionName || '').trim();
  if (!key) return null;
  return nameToUrl.get(key) || null;
}

export function setCachedImage(minionName, url) {
  const key = String(minionName || '').trim();
  if (!key || !url) return;
  nameToUrl.set(key, url);
}

export function getCacheSnapshot() {
  return Array.from(nameToUrl.entries()).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}


