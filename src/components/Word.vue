<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  id: [String, Number],
  word: String,
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  isDragging: { type: Boolean, default: false },
  absX: { type: Number, default: 0 },
  absY: { type: Number, default: 0 },
  opacity: { type: Number, default: 1 },
});

const emit = defineEmits(['pointerdown', 'mounted', 'resized']);

const elRef = ref(null);

const style = computed(() => ({
  position: props.isDragging ? 'fixed' : 'absolute',
  top: `${props.isDragging ? props.absY : props.y}px`,
  left: `${props.isDragging ? props.absX : props.x}px`,
  zIndex: props.isDragging ? 1000 : 1,
  opacity: props.opacity,
  margin: '0px',
}));

function handlePointerDown(e) {
  const rect = elRef.value?.getBoundingClientRect?.() || { left: 0, top: 0 };
  emit('pointerdown', {
    id: props.id,
    word: props.word,
    clientX: e.clientX,
    clientY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    rectLeft: rect.left,
    rectTop: rect.top,
  });
  e.preventDefault();
}

onMounted(() => {
  const rect = elRef.value?.getBoundingClientRect?.();
  if (rect) {
    emit('mounted', { id: props.id, width: rect.width, height: rect.height });
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      const br = elRef.value?.getBoundingClientRect?.();
      if (!br) return;
      emit('resized', { id: props.id, width: br.width, height: br.height });
    });
    if (elRef.value) ro.observe(elRef.value);
    resizeObserver.value = ro;
  }
});

const resizeObserver = ref(null);

onUnmounted(() => {
  if (resizeObserver.value) {
    try { resizeObserver.value.disconnect(); } catch (e) {}
  }
});
</script>

<template>
  <div class="word" :class="{ dragging: isDragging }" :data-word="word" :data-id="id" :style="style" @pointerdown="handlePointerDown" ref="elRef">
    {{ word }}
  </div>
</template>

<style scoped>


@keyframes jitter {
  0% { --tx: 0px; --ty: 0px; }
  20% { --tx: 0.4px; --ty: -0.3px; }
  40% { --tx: -0.5px; --ty: 0.4px; }
  60% { --tx: 0.3px; --ty: 0.5px; }
  80% { --tx: -0.3px; --ty: -0.4px; }
  100% { --tx: 0px; --ty: 0px; }
}

.word {
  padding: clamp(6px, 1.2vw, 10px) clamp(10px, 1.8vw, 18px);
  background-color: transparent; /* 移除卡片背景 */
  border: none; /* 移除外边框 */
  cursor: grab;
  user-select: none;
  display: inline-block;
  margin: 0; /* 绝对定位元素不应使用外边距，避免尺寸混淆 */
  box-shadow: none; /* 移除阴影 */
  transition: color 0.2s, transform 0.1s;
  color: #d8dbff; /* 常态为冷色调，悬停变金色 */
  font-family: 'Courier New', monospace;
  font-size: clamp(16px, 2vw, 24px);
  font-weight: bold;
  letter-spacing: 2px;
  text-transform: uppercase;
  white-space: nowrap; /* 防止换行导致边缘压缩 */
  word-break: keep-all; /* 中日韩字符不拆分 */
  /* 常态不发光 */
  text-shadow: none;
  transform: translate(var(--tx, 0), var(--ty, 0)) scale(var(--scale, 1));
  will-change: transform, text-shadow;
}


.word:hover {
  color: #ffff80;
  text-shadow:
    0 0 3px rgba(255, 240, 150, 0.85),
    0 0 10px rgba(255, 220, 120, 0.78),
    0 0 22px rgba(255, 200, 80, 0.60),
    0 0 36px rgba(255, 200, 80, 0.40),
    0 0 52px rgba(255, 200, 80, 0.26);
}

.word:active {
  cursor: grabbing;
  /* 使用变量与 jitter 组合叠加 */
  --scale: 1.05;
  color: #ffff80;
  text-shadow:
    0 0 4px rgba(255, 240, 150, 0.95),
    0 0 14px rgba(255, 220, 120, 0.85),
    0 0 30px rgba(255, 200, 80, 0.70),
    0 0 52px rgba(255, 200, 80, 0.46),
    0 0 72px rgba(255, 200, 80, 0.30);
}

.word.dragging {
  /* 拖拽时采用 active 的强光，同时叠加 jitter */
  text-shadow:
    0 0 4px rgba(255, 240, 150, 0.95),
    0 0 14px rgba(255, 220, 120, 0.85),
    0 0 30px rgba(255, 200, 80, 0.70),
    0 0 52px rgba(255, 200, 80, 0.46),
    0 0 72px rgba(255, 200, 80, 0.30);
  animation: jitter 120ms steps(1, end) infinite;
}

</style>
