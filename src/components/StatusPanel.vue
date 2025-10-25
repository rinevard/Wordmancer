<template>
  <div class="status-panel">
    <h4>卡牌状态</h4>
    <p class="status-text">{{ statusText || '将鼠标悬停在卡牌上查看状态。' }}</p>
  </div>
 </template>

<script setup>
defineProps({
  statusText: {
    type: String,
    default: '将鼠标悬停在卡牌上查看状态。'
  }
});
</script>

<style scoped>
.status-panel {
  border: 2px solid #323232;
  padding: clamp(8px, 2vw, 16px);
  border-radius: 4px;
  width: 100%;
  height: 100%;
  background-color: #141414;
  box-sizing: border-box;
  color: #9696c8;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
}

h4 {
  margin-top: 0;
  border-bottom: 1px solid #323232;
  padding-bottom: clamp(4px, 1vw, 8px);
  color: #f0f0f0;
  text-align: center;
  letter-spacing: 1px;
}

.status-text {
  font-size: clamp(0.8rem, 1.2vw, 0.95rem);
  color: #9696c8;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
