<template>
  <div class="battlefield">
    <!-- 顶部：ENEMY 文本 + 冷白光横线 -->
    <div class="enemy-header">
      <div v-if="enemyIntent" class="intent-pill enemy">{{ enemyIntent }}</div>
      <div
        class="role-label enemy"
        @mouseenter="$emit('card-hover', { hovering: true, status: props.enemy?.status })"
        @mouseleave="$emit('card-hover', { hovering: false })"
      >
        ENEMY
      </div>
      <div class="glow-line white" />
      <div v-if="enemyHealth != null" class="health-badge">{{ enemyHealth }}</div>
    </div>

    <!-- 中部：随从区域 -->
    <div class="minions-area">
      <div
        v-for="(slot, index) in slots"
        :key="index"
        class="minion-slot"
        :class="{ filled: !!slot }"
      >
        <MinionCard
          v-if="slot"
          :name="slot.name"
          :attack="slot.attack"
          :health="slot.health"
          @mouseenter="$emit('card-hover', { hovering: true, status: slot.status })"
          @mouseleave="$emit('card-hover', { hovering: false })"
        />
      </div>
    </div>

    <!-- 底部：金色光横线 + PLAYER 文本 -->
    <div class="player-footer">
      <div class="glow-line gold" />
      <div
        class="role-label player"
        @mouseenter="$emit('card-hover', { hovering: true, status: props.player?.status })"
        @mouseleave="$emit('card-hover', { hovering: false })"
      >
        PLAYER
      </div>
      <div v-if="playerHealth != null" class="health-badge">{{ playerHealth }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import MinionCard from './MinionCard.vue';

const props = defineProps({
  enemy: Object,
  minions: Array,
  player: Object
});

defineEmits(['card-hover']);

const slots = computed(() => {
  const list = Array.isArray(props.minions) ? props.minions.slice(0, 4) : [];
  return [0, 1, 2, 3].map((i) => list[i] || null);
});

const enemyHealth = computed(() => {
  const hp = props.enemy?.health;
  return Number.isFinite(hp) ? hp : null;
});

const playerHealth = computed(() => {
  const hp = props.player?.health;
  return Number.isFinite(hp) ? hp : null;
});

const enemyIntent = computed(() => {
  const intent = props.enemy?.intent;
  if (typeof intent === 'string') {
    const trimmed = intent.trim();
    return trimmed.length > 0 ? trimmed : '';
  }
  return '';
});
</script>

<style scoped>
.battlefield {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8vh;
  height: 100%;
  width: 100%;
  padding: clamp(8px, 2vw, 24px);
  box-sizing: border-box;
  position: relative;
}

.enemy-header,
.player-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.4vw, 14px);
  width: 100%;
  position: relative;
}

.role-label {
  user-select: none;
  text-transform: uppercase;
  letter-spacing: 0.5em;
  font-size: clamp(16px, 2.2vw, 22px);
  font-weight: 600;
  color: #d8dbff;
  transition: color 0.2s, text-shadow 0.2s;
}

/* 悬停时：与 Word.vue 保持一致的金色泛光 */
.role-label:hover {
  color: #ffff80;
  text-shadow:
    0 0 3px rgba(255, 240, 150, 0.85),
    0 0 10px rgba(255, 220, 120, 0.78),
    0 0 22px rgba(255, 200, 80, 0.60),
    0 0 36px rgba(255, 200, 80, 0.40),
    0 0 52px rgba(255, 200, 80, 0.26);
}

.glow-line {
  position: relative;
  width: min(92%, 900px);
  height: 2px; /* 内核线 */
  border-radius: 2px;
  overflow: visible;
}

.glow-line::before,
.glow-line::after {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  transform: translateY(-50%);
  pointer-events: none;
}

/* 内核 */
.glow-line.white {
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 10%, rgba(255,255,255,0.9) 90%, rgba(255,255,255,0) 100%);
}
.glow-line.gold {
  background: linear-gradient(90deg, rgba(255,215,128,0) 0%, rgba(255,215,128,0.9) 10%, rgba(255,215,128,0.9) 90%, rgba(255,215,128,0) 100%);
}

/* 外圈光晕 */
.glow-line.white::after {
  height: 8px;
  border-radius: 8px;
  background: radial-gradient(closest-side, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%);
  filter: blur(2px);
}
.glow-line.gold::after {
  height: 8px;
  border-radius: 8px;
  background: radial-gradient(closest-side, rgba(255,220,120,0.55), rgba(255,220,120,0) 70%);
  filter: blur(2px);
}

.minions-area {
  display: grid;
  grid-template-columns: repeat(4, 20%);
  justify-content: center; /* 水平居中整个网格 */
  column-gap: 4%;
  align-items: center;
  width: 100%;
  max-height: 25vh; /* 区域总高度上限 */
  /* 间距交由父容器 gap 控制 */
  margin: 0;
}

.minion-slot {
  width: 100%;
  /* 高宽比 4:3，随宽度自适应 */
  aspect-ratio: 3 / 4;
  /* 槽高度不能超过 25vh。用容器限制高度，槽内再用最大高度 */
  max-height: 25vh;
  /* 使用实线边框并提升对比度 */
  border: 2px solid rgba(255,255,255,0.35);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  box-sizing: border-box;
}

.minion-slot.filled {
  border-color: rgba(255,255,255,0.45);
  background: rgba(255,255,255,0.06);
}

.health-badge {
  position: absolute;
  right: clamp(8px, 1.6vw, 16px);
  bottom: clamp(4px, 1vw, 10px);
  font-size: clamp(1rem, 2.2vw, 1.4rem);
  font-weight: 800;
  color: #cfd2ff; /* default fallback */
  text-shadow: 0 0 6px rgba(207, 210, 255, 0.28);
  user-select: none;
}

/* 敌方：使用与白色光线一致的冷白色 */
.enemy-header .health-badge {
  color: #ffffff;
  text-shadow:
    0 0 3px rgba(255,255,255,0.65),
    0 0 10px rgba(255,255,255,0.35);
}

/* 我方：使用与金色光线一致的金色 */
.player-footer .health-badge {
  color: #ffd780;
  text-shadow:
    0 0 3px rgba(255,220,120,0.75),
    0 0 10px rgba(255,215,128,0.45);
}

/* 敌方意图：置于 ENEMY 文本上方，采用冷白主题 */
.intent-pill {
  user-select: none;
  padding: clamp(2px, 0.6vw, 6px) clamp(10px, 1.6vw, 16px);
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.55);
  background: rgba(255,255,255,0.06);
  font-size: clamp(12px, 1.6vw, 14px);
  letter-spacing: 0.06em;
  color: #ffffff;
  text-shadow:
    0 0 3px rgba(255,255,255,0.65),
    0 0 10px rgba(255,255,255,0.35);
}
</style>
