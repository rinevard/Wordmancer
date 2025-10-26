<template>
  <div class="minion-card" ref="cardEl" @mouseenter="$emit('mouseenter')" @mouseleave="$emit('mouseleave')">
    <div class="name">{{ name }}</div>
    <div class="attack" ref="atkEl">{{ attack }}</div>
    <div class="health" ref="hpEl">{{ health }}</div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  name: String,
  attack: Number,
  health: Number
});
defineEmits(['mouseenter', 'mouseleave']);

const cardEl = ref(null);
const atkEl = ref(null);
const hpEl = ref(null);

function triggerAnimation(elRef, className) {
  const el = elRef && elRef.value;
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  const onEnd = () => {
    el.classList.remove(className);
    el.removeEventListener('animationend', onEnd);
  };
  el.addEventListener('animationend', onEnd);
}

let prevHp = props.health;
watch(() => props.health, async (nv, ov) => {
  await nextTick();
  if (ov == null) { prevHp = nv; return; }
  if (nv < ov) {
    triggerAnimation(hpEl, 'hp-damage');
    triggerAnimation(cardEl, 'bump-down');
  } else if (nv > ov) {
    triggerAnimation(hpEl, 'bounce-scale');
  }
  prevHp = nv;
});

let prevAtk = props.attack;
watch(() => props.attack, async (nv, ov) => {
  await nextTick();
  if (ov == null) { prevAtk = nv; return; }
  if (nv > ov) {
    triggerAnimation(atkEl, 'bounce-scale');
  } else if (nv < ov) {
    triggerAnimation(atkEl, 'shake-point');
  }
  prevAtk = nv;
});
</script>

<style scoped>
.minion-card {
  /* 让卡片填满槽位 */
  width: 100%;
  height: 100%;
  border: 2px solid rgba(255,255,255,0.35);
  padding: clamp(6px, 1.2vw, 12px);
  border-radius: 8px;
  background-color: rgba(20, 20, 28, 0.95);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.55);
  color: #cfd2ff;
  text-align: center;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.minion-card:hover {
  border-color: #ffff80;
  box-shadow: 0 0 16px rgba(255, 255, 128, 0.28);
}

.name {
  font-weight: 700;
  font-size: clamp(14px, 1.6vw, 18px);
  line-height: 1.2;
  color: #f5f6ff;
  margin-bottom: auto;
  padding-top: 6px;
}

.attack {
  position: absolute;
  bottom: 8px;
  left: 10px;
  font-size: clamp(1rem, 2.2vw, 1.5rem);
  font-weight: 800;
  color: #ff8080;
}

.health {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: clamp(1rem, 2.2vw, 1.5rem);
  font-weight: 800;
  color: #33ff99;
}

/* ========== 动画（与战场统一） ========== */
@keyframes shakePoint {
  0% { transform: translate(0, 0); }
  15% { transform: translate(-2px, 0); }
  30% { transform: translate(2px, 0); }
  45% { transform: translate(-1px, 0); }
  60% { transform: translate(1px, 0); }
  100% { transform: translate(0, 0); }
}
@keyframes bumpDown {
  0% { transform: translateY(0); }
  40% { transform: translateY(8px); }
  100% { transform: translateY(0); }
}
@keyframes bounceScale {
  0% { transform: scale(1); }
  50% { transform: scale(1.28); }
  100% { transform: scale(1); }
}
.shake-point { animation: shakePoint 200ms ease-in-out; }
.bounce-scale { animation: bounceScale 260ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.bump-down { animation: bumpDown 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }

/* 掉血时短暂变红并伴随轻微震动 */
@keyframes hpDamageTint {
  0% { color: #33ff99; text-shadow: 0 0 3px rgba(255,60,60,0.0); }
  15% { color: #ff4d4d; text-shadow: 0 0 8px rgba(255,60,60,0.5); }
  100% { color: #33ff99; text-shadow: 0 0 3px rgba(255,60,60,0.0); }
}
.health.hp-damage { animation: shakePoint 200ms ease-in-out, hpDamageTint 260ms ease-out; }
</style>
