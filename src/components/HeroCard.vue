<template>
  <div class="hero-card" :class="type" @mouseenter="$emit('mouseenter')" @mouseleave="$emit('mouseleave')">
    <div class="name">{{ name }}</div>
    <div class="health">{{ health }}</div>
    <div v-if="intent" class="intent">{{ intent }}</div>
  </div>
</template>

<script setup>
defineProps({
  name: String,
  health: Number,
  intent: String,
  type: {
    type: String,
    default: 'player' // 'player' or 'enemy'
  }
});
defineEmits(['mouseenter', 'mouseleave']);
</script>

<style scoped>
.hero-card {
  border: 2px solid #323232;
  padding: clamp(6px, 1.2vw, 12px);
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: clamp(120px, 12vw, 180px);
  height: clamp(72px, 10vh, 110px);
  background-color: #141414;
  position: relative;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  color: #9696c8;
  transition: all 0.3s;
}

.hero-card:hover {
  border-color: #ffff80;
  box-shadow: 0 0 15px rgba(255, 255, 128, 0.3);
}

.hero-card.enemy {
  background-color: #2a1a1a;
}

.name {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: bold;
  color: #f0f0f0;
}

.health {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: clamp(1rem, 2.2vw, 1.6rem);
  font-weight: bold;
  color: #33ff99;
}

.intent {
  position: absolute;
  bottom: 10px;
  left: 12px;
  color: #ff9933;
  font-size: clamp(0.8rem, 1.6vw, 1rem);
}
</style>
