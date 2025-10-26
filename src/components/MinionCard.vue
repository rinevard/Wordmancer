<template>
  <div class="minion-card" @mouseenter="$emit('mouseenter')" @mouseleave="$emit('mouseleave')">
    <div class="name">{{ name }}</div>
    <div class="attack">{{ attack }}</div>
    <div class="health">{{ health }}</div>
  </div>
</template>

<script setup>
defineProps({
  name: String,
  attack: Number,
  health: Number
});
defineEmits(['mouseenter', 'mouseleave']);
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
</style>
