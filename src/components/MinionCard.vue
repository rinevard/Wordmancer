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
  border: 2px solid #323232;
  padding: clamp(6px, 1.2vw, 12px);
  border-radius: 4px;
  width: clamp(64px, 8vw, 110px);
  height: clamp(72px, 10vh, 110px);
  background-color: #141414;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  color: #9696c8;
  text-align: center;
  transition: all 0.3s;
}

.minion-card:hover {
  border-color: #ffff80;
  box-shadow: 0 0 15px rgba(255, 255, 128, 0.3);
}

.name {
  font-weight: bold;
  font-size: clamp(12px, 1.4vw, 16px);
  line-height: 1.2;
  color: #f0f0f0;
  margin-bottom: auto;
  padding-top: 5px;
}

.attack {
  position: absolute;
  bottom: 5px;
  left: 8px;
  font-size: clamp(1rem, 2.2vw, 1.4rem);
  font-weight: bold;
  color: #ff8080;
}

.health {
  position: absolute;
  bottom: 5px;
  right: 8px;
  font-size: clamp(1rem, 2.2vw, 1.4rem);
  font-weight: bold;
  color: #33ff99;
}
</style>
