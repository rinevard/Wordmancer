<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Word from './components/Word.vue';
import Battlefield from './components/Battlefield.vue';
import { generateStoryStream } from './services/sophnet.js';
import { BACK_SPEED, DRAG_LERP, MAX_SPEED, MIN_SPEED } from './constants.js';
import { initVoices, disposeVoices, speakAsync } from './services/tts.js';

// 容器引用
const bottomEl = ref(null);
const dropEl = ref(null);
const battlefieldContainerEl = ref(null);
const battlefieldFitEl = ref(null);

// 词条对象结构
function createItem(word) {
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
  const angle = Math.random() * Math.PI * 2;
  return {
    id: word, // 简化：以单词为ID（如未来可能重复，请改为uuid）
    word,
    x: 0,
    y: 0,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    w: 80,
    h: 36,
    isDragging: false,
    state: 'regular', // 'regular' | 'dragging' | 'backing'
    absX: 0,
    absY: 0,
    dragFollowX: 0,
    dragFollowY: 0,
    backTargetX: 0,
    backTargetY: 0,
  };
}

// 首回合初始手牌（同时用于底部漂浮与 current_state.words）
const INITIAL_WORDS = ['锁链', '冰霜', '碎裂', '打击', '扭曲', '召唤'];
const bottomItems = ref(INITIAL_WORDS.map(createItem));

const dropItems = ref([]);

const userPrompt = ref('');
const story = ref('');
const isLoading = ref(false);

// 字幕：显示旁白，随 TTS 同步淡入淡出
const subtitleText = ref('');
const subtitleOpacity = ref(0);
let subtitleFadeTimer = 0;
let subtitleActiveUtterance = null;
// 字幕动画并发控制：通过 token + 取消 RAF 防止上一个动画与下一个动画相互覆盖
let subtitleAnimToken = 0;
let subtitleAnimRaf = 0;

function cancelSubtitleAnim() {
  if (subtitleAnimRaf) {
    cancelAnimationFrame(subtitleAnimRaf);
    subtitleAnimRaf = 0;
  }
}

// 生成期间缓存服务端返回的新手牌，避免提前露出
const pendingWords = ref(null);

function showSubtitle(text) {
  subtitleText.value = text || '';
  // 取消任何进行中的动画，启动新的淡入（令牌防抖）
  cancelSubtitleAnim();
  const token = ++subtitleAnimToken;
  const start = performance.now();
  const from = subtitleOpacity.value;
  const to = 1;
  const duration = 250;
  function stepIn(now) {
    if (token !== subtitleAnimToken) return; // 已被新动画取代
    const t = Math.min(1, (now - start) / duration);
    subtitleOpacity.value = from + (to - from) * t;
    if (t < 1) {
      subtitleAnimRaf = requestAnimationFrame(stepIn);
    } else {
      subtitleAnimRaf = 0;
    }
  }
  subtitleAnimRaf = requestAnimationFrame(stepIn);
}

function hideSubtitle() {
  if (subtitleFadeTimer) {
    clearTimeout(subtitleFadeTimer);
    subtitleFadeTimer = 0;
  }
  // 取消任何进行中的动画，启动新的淡出（令牌防抖）
  cancelSubtitleAnim();
  const token = ++subtitleAnimToken;
  const outStart = performance.now();
  const outFrom = subtitleOpacity.value;
  const outTo = 0;
  const outDur = 300;
  function stepOut(now) {
    if (token !== subtitleAnimToken) return; // 已被新动画取代
    const t = Math.min(1, (now - outStart) / outDur);
    subtitleOpacity.value = outFrom + (outTo - outFrom) * t;
    if (t < 1) {
      subtitleAnimRaf = requestAnimationFrame(stepOut);
    } else {
      subtitleAnimRaf = 0;
    }
  }
  subtitleAnimRaf = requestAnimationFrame(stepOut);
}

// 底部词汇淡入淡出控制
const bottomOpacity = ref(1);
let wordsFadePromise = Promise.resolve();

function animateOpacity(target, durationMs) {
  return new Promise((resolve) => {
    const start = performance.now();
    const from = bottomOpacity.value;
    const to = target;
    const duration = Math.max(0, durationMs || 0);
    if (duration === 0 || from === to) {
      bottomOpacity.value = to;
      resolve();
      return;
    }
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      bottomOpacity.value = from + (to - from) * t;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

function queueBottomWordsUpdate(newWords) {
  const next = Array.isArray(newWords) ? newWords.slice() : [];
  wordsFadePromise = wordsFadePromise.then(async () => {
    await animateOpacity(0, 250);
    bottomItems.value = next.map(createItem);
    await animateOpacity(1, 250);
  });
}

const gameState = ref({
  enemy: {
    health: 60,
    intent: "攻击",
    status: ""
  },
  minions: [
  ],
  player: {
    health: 30,
    status: ""
  },
  words: INITIAL_WORDS.slice()
});

// 悬浮状态（来自战场卡牌）
const hoveredStatus = ref('');
const isHoveringCard = ref(false);
// 在进入悬停瞬间锁定提示方向（相对于指针：right/bottom 为 true 表示向右/向下偏移）
const tooltipLock = ref(null);
// 鼠标坐标（用于决定象限与定位）
const mouseX = ref(0);
const mouseY = ref(0);

function handleCardHover(payload) {
  const wasHovering = isHoveringCard.value;
  if (payload && typeof payload === 'object') {
    isHoveringCard.value = !!payload.hovering;
    hoveredStatus.value = payload.status ?? '';
  } else {
    // 兼容旧字符串形式
    isHoveringCard.value = !!payload;
    hoveredStatus.value = String(payload || '');
  }
  // 进入时锁定一次方向（以进入瞬间的鼠标象限的对立象限为准）
  if (!wasHovering && isHoveringCard.value) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const isRight = mouseX.value >= cx;
    const isBottom = mouseY.value >= cy;
    // 取对立象限：指针在右上，则锁定左下；指针在左下，则锁定右上 ...
    tooltipLock.value = { right: !isRight, bottom: !isBottom };
  }
  // 离开时清除锁定
  if (wasHovering && !isHoveringCard.value) {
    tooltipLock.value = null;
  }
}

function onMouseMove(e) {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
}

function computeTooltipStyle(x, y) {
  const gap = 10; // 与指针间距
  const pos = `${gap}px`;
  const negFull = `calc(-100% - ${gap}px)`;

  // 若已锁定，沿用锁定方向；否则使用“当前象限的对立象限”作为即时方向
  let lock = tooltipLock.value;
  if (!lock) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const isRight = x >= cx;
    const isBottom = y >= cy;
    lock = { right: !isRight, bottom: !isBottom };
  }

  const tx = lock.right ? pos : negFull;
  const ty = lock.bottom ? pos : negFull;

  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(${tx}, ${ty})`,
  };
}

// 语音
let voices = [];
const getVoices = () => {
  voices = window.speechSynthesis.getVoices();
};

// RAF
let rafId = 0;
let lastTs = 0;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getBounds(el) {
  const r = el?.getBoundingClientRect?.();
  if (!r) return { left: 0, top: 0, width: 0, height: 0 };
  const w = el?.clientWidth ?? r.width;
  const h = el?.clientHeight ?? r.height;
  return { left: r.left, top: r.top, width: w, height: h };
}

// 保持战场区域固定宽高比（16:9），在容器内尽可能放大
const BATTLEFIELD_RATIO = 16 / 9;
function layoutBattlefieldFit() {
  const c = getBounds(battlefieldContainerEl.value);
  const fit = battlefieldFitEl.value;
  if (!fit || !c.width || !c.height) return;
  const containerRatio = c.width / c.height;
  if (containerRatio > BATTLEFIELD_RATIO) {
    const h = c.height;
    const w = Math.floor(h * BATTLEFIELD_RATIO);
    fit.style.width = `${w}px`;
    fit.style.height = `${h}px`;
  } else {
    const w = c.width;
    const h = Math.floor(w / BATTLEFIELD_RATIO);
    fit.style.width = `${w}px`;
    fit.style.height = `${h}px`;
  }
}

// 统一的窗口尺寸变化处理（在挂载/卸载时添加/移除监听）
function onResize() {
  const db = getBounds(dropEl.value);
  const bb = getBounds(bottomEl.value);
  for (const it of dropItems.value) {
    it.x = clamp(it.x, 0, Math.max(0, db.width - it.w));
    it.y = clamp(it.y, 0, Math.max(0, db.height - it.h));
  }
  for (const it of bottomItems.value) {
    it.x = clamp(it.x, 0, Math.max(0, bb.width - it.w));
    it.y = clamp(it.y, 0, Math.max(0, bb.height - it.h));
  }
  layoutBattlefieldFit();
}

function stepItems(items, bounds, dt) {
  const W = Math.max(0, bounds.width);
  const H = Math.max(0, bounds.height);
  for (const it of items) {
    if (it.state !== 'regular') continue;
    let nextX = it.x + it.vx * dt;
    let nextY = it.y + it.vy * dt;

    // X 轴反射（保留穿透距离）
    const maxX = Math.max(0, W - it.w);
    if (nextX < 0) {
      nextX = -nextX;
      it.vx = Math.abs(it.vx);
    } else if (nextX > maxX) {
      nextX = 2 * maxX - nextX;
      it.vx = -Math.abs(it.vx);
    }

    // Y 轴反射（保留穿透距离）
    const maxY = Math.max(0, H - it.h);
    if (nextY < 0) {
      nextY = -nextY;
      it.vy = Math.abs(it.vy);
    } else if (nextY > maxY) {
      nextY = 2 * maxY - nextY;
      it.vy = -Math.abs(it.vy);
    }

    // 最终夹紧，避免极端 dt 造成越界
    it.x = clamp(nextX, 0, maxX);
    it.y = clamp(nextY, 0, maxY);
  }
}

// 拖拽/回归动画参数由 constants 提供

function stepDragging(dt) {
  // 仅更新处于 dragging 的元素的 abs 坐标（固定定位）
  for (const list of [bottomItems.value, dropItems.value]) {
    for (const it of list) {
      if (it.state !== 'dragging') continue;
      const k = Math.min(1, DRAG_LERP * dt);
      it.absX = it.absX + (it.dragFollowX - it.absX) * k;
      it.absY = it.absY + (it.dragFollowY - it.absY) * k;
    }
  }
}

function stepBacking(dt) {
  // 回到原框内的目标点
  for (const list of [bottomItems.value, dropItems.value]) {
    for (const it of list) {
      if (it.state !== 'backing') continue;
      const dx = it.backTargetX - it.x;
      const dy = it.backTargetY - it.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        it.x = it.backTargetX;
        it.y = it.backTargetY;
        // 回到 regular，恢复漂浮
        it.state = 'regular';
        const ang = Math.random() * Math.PI * 2;
        const s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
        it.vx = Math.cos(ang) * s;
        it.vy = Math.sin(ang) * s;
        continue;
      }
      const step = BACK_SPEED * dt;
      if (step >= dist) {
        it.x = it.backTargetX;
        it.y = it.backTargetY;
      } else {
        it.x += (dx / dist) * step;
        it.y += (dy / dist) * step;
      }
    }
  }
}

function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000); // clamp to 50ms
  lastTs = ts;
  const bottomBounds = getBounds(bottomEl.value);
  const dropBounds = getBounds(dropEl.value);
  stepItems(bottomItems.value, bottomBounds, dt);
  stepItems(dropItems.value, dropBounds, dt);
  stepDragging(dt);
  stepBacking(dt);
  rafId = requestAnimationFrame(tick);
}

// 拖拽上下文（每次拖拽的临时数据）
const dragging = ref(null); // { id, from: 'bottom'|'drop', lastX, lastY, lastT }

function findItemById(id) {
  let idx = bottomItems.value.findIndex((i) => i.id === id);
  if (idx !== -1) return { item: bottomItems.value[idx], list: bottomItems.value, where: 'bottom', index: idx };
  idx = dropItems.value.findIndex((i) => i.id === id);
  if (idx !== -1) return { item: dropItems.value[idx], list: dropItems.value, where: 'drop', index: idx };
  return null;
}

function handleChildPointerDown(payload) {
  const { id, clientX, clientY, rectLeft, rectTop } = payload;
  const found = findItemById(id);
  if (!found) return;
  const { item, where } = found;
  // 先把 fixed 初始位置设为元素当前屏幕坐标，避免从(0,0)闪现
  item.absX = rectLeft ?? clientX - item.w / 2;
  item.absY = rectTop ?? clientY - item.h / 2;
  // 跟随目标设为指针中心，逐帧趋近实现丝滑跟手
  item.dragFollowX = clientX - item.w / 2;
  item.dragFollowY = clientY - item.h / 2;
  // 再切换到 dragging
  item.state = 'dragging';
  item.isDragging = true;
  dragging.value = {
    id,
    from: where,
    lastX: clientX,
    lastY: clientY,
    lastT: performance.now(),
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function onPointerMove(e) {
  const d = dragging.value;
  if (!d) return;
  const found = findItemById(d.id);
  if (!found) return;
  const { item } = found;
  // 更新跟随目标（元素中心与指针对齐），实际位置由 stepDragging 渐进
  item.dragFollowX = e.clientX - item.w / 2;
  item.dragFollowY = e.clientY - item.h / 2;
  d.lastX = e.clientX;
  d.lastY = e.clientY;
  d.lastT = performance.now();
}

function onPointerUp(e) {
  const d = dragging.value;
  dragging.value = null;
  window.removeEventListener('pointermove', onPointerMove);
  const found = d ? findItemById(d.id) : null;
  if (!d || !found) return;
  const { item, list, where, index } = found;

  // 估算释放速度
  const now = performance.now();
  const dt = Math.max(0.016, (now - d.lastT) / 1000);
  const vxEst = (e.clientX - d.lastX) / dt;
  const vyEst = (e.clientY - d.lastY) / dt;

  const dropBounds = getBounds(dropEl.value);
  const bottomBounds = getBounds(bottomEl.value);
  const inside = (x, y, b) => x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;

  const cursorX = e.clientX;
  const cursorY = e.clientY;

  let target = where;
  if (inside(cursorX, cursorY, dropBounds)) target = 'drop';
  else if (inside(cursorX, cursorY, bottomBounds)) target = 'bottom';

  if (target === 'drop' || target === 'bottom') {
    // 切换容器，落入目标内 → regular
    list.splice(index, 1);
    const destList = target === 'drop' ? dropItems.value : bottomItems.value;
    const bounds = target === 'drop' ? dropBounds : bottomBounds;
    const newX = clamp(e.clientX - bounds.left - item.w / 2, 0, Math.max(0, bounds.width - item.w));
    const newY = clamp(e.clientY - bounds.top - item.h / 2, 0, Math.max(0, bounds.height - item.h));
    item.x = newX;
    item.y = newY;
    item.state = 'regular';
    item.isDragging = false;
    item.absX = 0;
    item.absY = 0;
    // 注入估算速度
    const speed = Math.hypot(vxEst, vyEst);
    if (speed > 1) {
      const cap = Math.max(MIN_SPEED, Math.min(MAX_SPEED * 2, speed));
      const k = cap / (speed || 1);
      item.vx = vxEst * k;
      item.vy = vyEst * k;
    } else {
      const ang = Math.random() * Math.PI * 2;
      const s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      item.vx = Math.cos(ang) * s;
      item.vy = Math.sin(ang) * s;
    }
    destList.push(item);
    return;
  }

  // 不在任何容器内：回到原框 backing
  const homeBounds = d.from === 'drop' ? dropBounds : bottomBounds;
  const targetX = clamp(e.clientX - homeBounds.left - item.w / 2, 0, Math.max(0, homeBounds.width - item.w));
  const targetY = clamp(e.clientY - homeBounds.top - item.h / 2, 0, Math.max(0, homeBounds.height - item.h));
  item.backTargetX = targetX;
  item.backTargetY = targetY;
  item.state = 'backing';
  item.isDragging = false;
  item.absX = 0;
  item.absY = 0;
}

function handleChildMounted(payload) {
  const { id, width, height } = payload;
  const found = findItemById(id);
  if (!found) return;
  const { item, where } = found;
  item.w = width;
  item.h = height;
  // 初次布局时，如果仍为(0,0)，随机放置以避免重叠
  const b = where === 'drop' ? getBounds(dropEl.value) : getBounds(bottomEl.value);
  if (item.x === 0 && item.y === 0 && b.width && b.height) {
    item.x = clamp(Math.random() * (b.width - item.w), 0, Math.max(0, b.width - item.w));
    item.y = clamp(Math.random() * (b.height - item.h), 0, Math.max(0, b.height - item.h));
  } else {
    // 尺寸更新后夹紧
    item.x = clamp(item.x, 0, Math.max(0, b.width - item.w));
    item.y = clamp(item.y, 0, Math.max(0, b.height - item.h));
  }
}

function handleChildResized(payload) {
  const { id, width, height } = payload;
  const found = findItemById(id);
  if (!found) return;
  const { item, where } = found;
  if ((item.w === width && item.h === height)) return;
  item.w = width;
  item.h = height;
  const b = where === 'drop' ? getBounds(dropEl.value) : getBounds(bottomEl.value);
  item.x = clamp(item.x, 0, Math.max(0, b.width - item.w));
  item.y = clamp(item.y, 0, Math.max(0, b.height - item.h));
}

onMounted(() => {
  initVoices();
  rafId = requestAnimationFrame(tick);
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  // 首次布局战场比例
  layoutBattlefieldFit();
  // 监听容器尺寸变化（更精细 than window.resize）
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => layoutBattlefieldFit());
    if (battlefieldContainerEl.value) ro.observe(battlefieldContainerEl.value);
    battlefieldResizeObserver.value = ro;
  }
});

onUnmounted(() => {
  disposeVoices();
  if (rafId) cancelAnimationFrame(rafId);
  cancelSubtitleAnim();
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('pointermove', onPointerMove);
  if (battlefieldResizeObserver.value) {
    try { battlefieldResizeObserver.value.disconnect(); } catch (e) {}
  }
});

const battlefieldResizeObserver = ref(null);

async function handleSend() {
  if (!userPrompt.value.trim()) {
    alert('请输入提示');
    return;
  }
  isLoading.value = true;
  story.value = '';
  try {
    const used = dropItems.value.map((w) => w.word);
    const action = {
      used_words: used,
      magic: userPrompt.value,
    };
    // 1) 发送时隐藏/清空：销毁发送栏内词汇 + 暂时隐藏底部手牌
    dropItems.value = [];
    // 保持底部手牌可见，不再在生成期间淡出
    let producedAny = false;
    for await (const step of generateStoryStream(gameState.value, action)) {
      if (step.type === 'narrator' && step.text) {
        story.value += (story.value ? '\n' : '') + step.text;
        producedAny = true;
        // 显示字幕并朗读（字幕与 TTS 生命周期绑定）
        showSubtitle(step.text);
        await speakAsync(step.text);
        hideSubtitle();
      } else if (step.type === 'statechange' && step.state) {
        producedAny = true;
        applyStateChange(step.state);
      }
    }
    if (!producedAny) {
      await speakAsync('抱歉，剧情生成失败。');
    }
  } finally {
    isLoading.value = false;
    // 按钮可再次点击时清空输入框
    userPrompt.value = '';
    // 结束后根据 pendingWords 或当前 gameState.words 恢复/更新底部手牌并淡入
    const next = pendingWords.value ?? gameState.value.words ?? [];
    pendingWords.value = null;
    queueBottomWordsUpdate(next);
  }
}

function applyStateChange(partial) {
  if (!partial || typeof partial !== 'object') return;
  const s = gameState.value;
  if (partial.enemy && typeof partial.enemy === 'object') {
    s.enemy = { ...s.enemy, ...partial.enemy };
  }
  if (Array.isArray(partial.minions)) {
    // 限制最多 4 个随从，并按顺序填入四个槽位
    const next = partial.minions.slice(0, 4).map((m) => ({
      name: m?.name ?? '',
      attack: Number.isFinite(m?.attack) ? m.attack : 0,
      health: Number.isFinite(m?.health) ? m.health : 0,
      status: typeof m?.status === 'string' ? m.status : ''
    }));
    s.minions = next;
    // 若超出 4 个，静默截断（UI 已固定 4 槽）；需要提示可在此加入反馈
  }
  if (partial.player && typeof partial.player === 'object') {
    const { words, ...rest } = partial.player;
    s.player = { ...s.player, ...rest };
    if (Array.isArray(words)) {
      s.words = words.slice();
      // 生成中不展示，等结束统一淡入
      if (isLoading.value) {
        pendingWords.value = s.words.slice();
      } else {
        queueBottomWordsUpdate(s.words);
      }
    }
  }
  if (Array.isArray(partial.words)) {
    s.words = partial.words.slice();
    if (isLoading.value) {
      pendingWords.value = s.words.slice();
    } else {
      queueBottomWordsUpdate(s.words);
    }
  }
}
</script>

<template>
  <div id="app">
    <div class="main-content">
      <!-- 左侧面板：改为词语漂浮框（替代原状态栏） -->
      <div class="left-panel-container">
        <div class="bottom-box" ref="bottomEl">
          <Word
            v-for="it in bottomItems"
            :key="it.id"
            :id="it.id"
            :word="it.word"
            :x="it.x"
            :y="it.y"
            :isDragging="it.isDragging"
            :absX="it.absX"
            :absY="it.absY"
            :opacity="bottomOpacity"
            @pointerdown="handleChildPointerDown"
            @mounted="handleChildMounted"
            @resized="handleChildResized"
          />
        </div>
      </div>
      
      <!-- 中间战斗区 -->
      <div class="battlefield-container" ref="battlefieldContainerEl">
        <div class="battlefield-fit" ref="battlefieldFitEl">
          <Battlefield
            :enemy="gameState.enemy"
            :minions="gameState.minions"
            :player="gameState.player"
            @card-hover="handleCardHover"
          />
        </div>
      </div>
      
      <!-- 右侧面板 -->
      <div class="right-panel">
        <div class="right-panel-card">
          <!-- 卡片上半：放单词区域（6） -->
          <div
            class="drop-zone"
            ref="dropEl"
          >
            <div v-if="dropItems.length === 0" class="drop-hint">
              将词语拖到这里
            </div>
            <Word
              v-for="it in dropItems"
              :key="it.id"
              :id="it.id"
              :word="it.word"
              :x="it.x"
              :y="it.y"
              :isDragging="it.isDragging"
              :absX="it.absX"
              :absY="it.absY"
              @pointerdown="handleChildPointerDown"
            @mounted="handleChildMounted"
            @resized="handleChildResized"
            />
          </div>

          <!-- 分隔线 -->
          <div class="right-card-sep" />

          <!-- 卡片下半：输入提示词区域（4） -->
          <div class="input-area in-card">
            <textarea
              v-model="userPrompt"
              placeholder="输入你的提示..."
              :disabled="isLoading"
            ></textarea>
          </div>
        </div>
        <!-- 发送按钮移动到卡片下方，不贴边 -->
        <div class="send-row">
          <button @click="handleSend" :disabled="isLoading">
            {{ isLoading ? '生成中...' : '发送' }}
          </button>
        </div>
      </div>
    </div>
    
    
    <!-- 字幕：Teleport 到 body，固定定位全局显示 -->
    <teleport to="body">
      <div class="subtitle" :style="{ opacity: subtitleOpacity }">{{ subtitleText }}</div>
    </teleport>

    <!-- 悬浮状态框：Teleport 到 body，固定定位，可越界于应用外 -->
    <teleport to="body">
      <div
        v-if="isHoveringCard"
        class="hover-status-tooltip"
        :style="computeTooltipStyle(mouseX, mouseY)"
      >
        {{ hoveredStatus && hoveredStatus.trim() ? hoveredStatus : '无特殊状态' }}
      </div>
    </teleport>
  </div>
</template>

<style>
:root {
  --gap: clamp(8px, 2vw, 24px);
  --gap-sm: clamp(6px, 1.2vw, 12px);
  --panel-left-w: clamp(180px, 18vw, 280px);
  --panel-right-w: clamp(240px, 22vw, 360px);
  --font-sm: clamp(12px, 1.2vw, 16px);
  --font-md: clamp(14px, 1.6vw, 18px);
  --bottom-hmargin: clamp(8px, 12vw, 20%);
  /* 顶部三栏的百分比分配（总和需为100%）*/
  --layout-left: 25%;
  --layout-center: 50%;
  --layout-right: 25%;
}
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: Garamond, 'Times New Roman', serif;
  background-color: #000000;
  color: #f0f0f0;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* 使用动态视口，避免移动端地址栏影响 */
  width: 100vw;
  background-color: #000000;
  overflow: hidden;
}

.main-content {
  flex: 7;
  display: grid;
  grid-template-columns: var(--layout-left) var(--layout-center) var(--layout-right);
  min-height: 0;
}

.left-panel-container {
  width: auto; /* 使用百分比网格列 */
  padding: var(--gap);
  border-right: 2px solid #323232;
}

.battlefield-container {
  display: flex; /* 作为网格列的内容容器 */
  justify-content: center;
  align-items: center;
  padding: var(--gap);
  min-width: 0;
}

.battlefield-fit {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.battlefield-fit > * {
  width: 100%;
  height: 100%;
}

/* 右侧面板 */
.right-panel {
  display: flex;
  flex-direction: column;
  width: auto; /* 使用百分比网格列 */
  padding: var(--gap); /* 与外层边界脱离 */
  border-left: 2px solid #323232;
}

.right-panel-card {
  display: flex;
  flex-direction: column;
  background-color: #0a0a0a;
  border: 2px solid #323232;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  overflow: hidden;
  height: 100%; /* 占满右侧面板高度 */
  min-height: 0; /* 允许内部按比例伸展 */
}

/* 右侧卡片内的 6:4 高度分配 */
.right-panel-card .drop-zone {
  flex: 6;
}
.right-panel-card .in-card {
  flex: 4;
}

.right-card-sep {
  height: 2px;
  background-color: #323232;
  flex: none;
}

/* 词语放置框 */
.drop-zone {
  flex: 1;
  background-color: #0a0a0a;
  padding: var(--gap);
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.drop-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffff80;
  font-size: 14px;
  font-weight: normal;
  text-align: center;
  pointer-events: none;
  user-select: none;
  opacity: 0.5;
  letter-spacing: 1px;
}

/* 输入区域 */
.input-area {
  display: flex;
  gap: 0.75rem;
  padding: var(--gap);
  background-color: #0a0a0a;
  border-top: none;
}

/* 卡片内的输入区域不带按钮，保留舒适内边距 */
.input-area.in-card {
  background-color: #0a0a0a;
  padding: var(--gap);
}

.input-area input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #323232;
  background-color: #141414;
  color: #9696c8;
  font-size: var(--font-md);
  font-family: Garamond, 'Times New Roman', serif;
  outline: none;
  transition: border-color 0.3s;
}

.input-area input:focus {
  border-color: #ffff80;
}

.input-area input:disabled {
  background-color: #0a0a0a;
  cursor: not-allowed;
  opacity: 0.5;
}

/* 多行输入框样式，使其成为完整框并顶端对齐 */
.input-area.in-card textarea {
  flex: 1;
  width: 100%;
  height: 100%;
  resize: none;
  padding: 0.75rem;
  border: none;
  background-color: #141414;
  color: #9696c8;
  font-size: var(--font-md);
  font-family: Garamond, 'Times New Roman', serif;
  outline: none;
  transition: border-color 0.3s;
  line-height: 1.6;
  box-sizing: border-box;
  overflow: auto;
}

.input-area.in-card textarea:focus { border: none; }

.input-area.in-card textarea:disabled {
  background-color: #0a0a0a;
  cursor: not-allowed;
  opacity: 0.5;
}

.input-area button {
  padding: 0.75rem 1.5rem;
  border: 2px solid #323232;
  background-color: #141414;
  color: #ffff80;
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: normal;
  font-family: Garamond, 'Times New Roman', serif;
  transition: all 0.2s;
  white-space: nowrap;
  letter-spacing: 1px;
}

.input-area button:hover:not(:disabled) {
  background-color: #1a1a1a;
  border-color: #ffff80;
  box-shadow: 0 0 10px rgba(255, 255, 128, 0.3);
}

.input-area button:disabled {
  background-color: #0a0a0a;
  color: #666;
  border-color: #222;
  cursor: not-allowed;
}

/* 卡片外的发送按钮行，避免贴边 */
.send-row {
  margin-top: var(--gap-sm);
  display: flex;
  justify-content: center; /* 水平居中按钮 */
}

.send-row button {
  padding: 0.75rem 1.5rem;
  border: 2px solid #323232;
  background-color: #141414;
  color: #ffff80;
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: normal;
  font-family: Garamond, 'Times New Roman', serif;
  transition: all 0.2s;
  white-space: nowrap;
  letter-spacing: 1px;
}

.send-row button:hover:not(:disabled) {
  background-color: #1a1a1a;
  border-color: #ffff80;
  box-shadow: 0 0 10px rgba(255, 255, 128, 0.3);
}

.send-row button:disabled {
  background-color: #0a0a0a;
  color: #666;
  border-color: #222;
  cursor: not-allowed;
}

/* 下部区域：30% - 词语漂浮框 */
.bottom-section {
  flex: 3;
  background-color: #0a0a0a;
  padding: 0 0 var(--gap) 0; /* 取消左右内边距，交给内层盒子控制 */
  position: relative;
  overflow: visible;
  border-top: 2px solid #323232;
}

.bottom-box {
  position: relative;
  height: calc(100% - var(--gap)); /* 与下边界留出距离（用于底部区域的旧样式）*/
  margin: 0 var(--bottom-hmargin); /* 自适应左右留白 */
  margin-top: var(--gap-sm); /* 与上边界留出一点距离 */
  background-color: #0a0a0a;
  border: 2px solid #323232;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
}

/* 左侧面板内的漂浮框：占满面板且无额外边距 */
.left-panel-container .bottom-box {
  height: 100%;
  margin: 0;
}

/* 字幕样式：位于上下分界线处（底部区域顶部），金色淡入淡出 */
.subtitle {
  position: fixed;
  top: clamp(8px, 2vh, 24px);
  left: 50%;
  transform: translateX(-50%);
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.6), 0 0 18px rgba(255, 215, 0, 0.35);
  font-size: clamp(14px, 1.8vw, 22px);
  font-weight: 500;
  font-style: italic;
  font-family: 'Cormorant Garamond', Garamond, 'Times New Roman', serif;
  letter-spacing: 1px;
  pointer-events: none;
  transition: opacity 0.25s ease;
  white-space: pre-wrap;
  max-width: calc(100vw - 2 * var(--gap));
  text-align: center;
  z-index: 10000;
}

/* 悬浮状态框：统一艺术风格 */
.hover-status-tooltip {
  position: fixed; /* 独立于布局，允许越界浏览器可视范围 */
  max-width: min(40vw, 560px);
  padding: clamp(6px, 1.2vw, 12px) clamp(8px, 1.6vw, 16px);
  background-color: #0a0a0a;
  color: #f0f0f0;
  border: 2px solid #323232;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px rgba(255, 255, 128, 0.18);
  border-radius: 6px;
  pointer-events: none; /* 不拦截鼠标 */
  white-space: pre-wrap; /* 支持多行状态 */
  line-height: 1.5;
  font-family: Garamond, 'Times New Roman', serif;
  font-size: var(--font-sm);
  z-index: 100000; /* 高于字幕层 */
}
</style>
