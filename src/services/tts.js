import { PREFERRED_TTS_VOICE, SPEECH_RATE, TTS_LANG } from '../constants.js';

let voicesCache = [];

export function initVoices() {
  if (!('speechSynthesis' in window)) return;
  const update = () => {
    voicesCache = window.speechSynthesis.getVoices();
  };
  update();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = update;
  }
}

export function disposeVoices() {
  if (!('speechSynthesis' in window)) return;
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = null;
  }
}

export function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('抱歉，您的浏览器不支持文本转语音功能。');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = TTS_LANG;
  utterance.rate = SPEECH_RATE;

  const preferred = voicesCache.find((v) => v.name === PREFERRED_TTS_VOICE);
  if (preferred) {
    utterance.voice = preferred;
  } else {
    console.warn('Preferred voice not found. Using default.');
  }

  window.speechSynthesis.speak(utterance);
}


export function speakAsync(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      alert('抱歉，您的浏览器不支持文本转语音功能。');
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = TTS_LANG;
    utterance.rate = SPEECH_RATE;
    const preferred = voicesCache.find((v) => v.name === PREFERRED_TTS_VOICE);
    if (preferred) {
      utterance.voice = preferred;
    }
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}


