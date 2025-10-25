<template>
  <div class="battlefield">
    <div class="enemy-area">
      <HeroCard
        v-if="enemy"
        name="Enemy"
        :health="enemy.health"
        :intent="enemy.intent"
        type="enemy"
        @mouseenter="$emit('card-hover', enemy.status)"
        @mouseleave="$emit('card-hover', '')"
      />
    </div>
    <div class="minions-area">
      <MinionCard
        v-for="(minion, index) in minions"
        :key="index"
        :name="minion.name"
        :attack="minion.attack"
        :health="minion.health"
        @mouseenter="$emit('card-hover', minion.status)"
        @mouseleave="$emit('card-hover', '')"
      />
    </div>
    <div class="player-area">
      <HeroCard
        v-if="player"
        name="Player"
        :health="player.health"
        type="player"
        @mouseenter="$emit('card-hover', player.status)"
        @mouseleave="$emit('card-hover', '')"
      />
    </div>
  </div>
</template>

<script setup>
import HeroCard from './HeroCard.vue';
import MinionCard from './MinionCard.vue';

defineProps({
  enemy: Object,
  minions: Array,
  player: Object
});

defineEmits(['card-hover']);
</script>

<style scoped>
.battlefield {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: clamp(8px, 2vw, 24px);
  box-sizing: border-box;
}

.enemy-area {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 10px;
}

.minions-area {
  display: flex;
  gap: clamp(6px, 1.5vw, 16px);
  justify-content: center;
  align-items: center;
  flex: 1;
  width: 100%;
  min-height: clamp(96px, 14vh, 160px); /* 随视口高度变化 */
  margin: 10px 0;
}

.player-area {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 10px;
}
</style>
