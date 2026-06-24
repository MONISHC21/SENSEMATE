/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side Speech Utility for SenseMate.
 * Supports both fast native Web Speech API and premium natural Gemini TTS.
 */

import { getApiHeaders } from "./api";

let currentAudio: HTMLAudioElement | null = null;

export async function speakText(
  text: string,
  mode: 'system' | 'premium',
  options?: {
    rate?: number; // Speed multiplier for system voice
    volume?: number; // Volume from 0 to 1
    voiceName?: string; // Prebuilt voice for premium (e.g. 'Zephyr', 'Kore')
  }
): Promise<void> {
  // Stop any active playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  const rate = options?.rate ?? 1.0;
  const volume = options?.volume ?? 1.0;

  const provider = typeof window !== 'undefined' ? localStorage.getItem("custom_ai_provider") || "gemini" : "gemini";

  if (mode === 'system' || provider === "ollama") {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error("Speech synthesis not supported in this browser."));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.volume = volume;
      
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);

      window.speechSynthesis.speak(utterance);
    });
  } else {
    // Premium Gemini TTS Mode
    const voiceName = options?.voiceName ?? 'Zephyr';
    try {
      const response = await fetch('/api/speech/speak', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ text, voice: voiceName }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate premium TTS audio.');
      }

      const data = await response.json();
      const base64Audio = data.audioBase64;

      // Decode base64 to array buffer and play
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes.buffer], { type: 'audio/pcm;rate=24000' });
      
      // In web browser, playing raw 24kHz PCM can be done by wrapping it in a WAV header
      // or using standard AudioContext. To keep it simple and ultra-compatible across all browsers,
      // Gemini TTS actually outputs standard audio container data depending on API options, or we can use
      // the standard Web Audio API AudioContext to decode/play PCM.
      // Let's implement PCM decoding for cross-browser playback:
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = audioCtx.createBuffer(1, len / 2, 24000);
      const channelData = buffer.getChannelData(0);
      
      // Convert 16-bit PCM binary string to float channel data (-1.0 to 1.0)
      const dataView = new DataView(bytes.buffer);
      for (let i = 0; i < len / 2; i++) {
        const int16 = dataView.getInt16(i * 2, true); // Little-endian
        channelData[i] = int16 / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      
      // Add volume gain node
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      return new Promise<void>((resolve) => {
        source.onended = () => {
          audioCtx.close();
          resolve();
        };
        source.start(0);
      });
    } catch (error) {
      console.error("Premium TTS failed, falling back to system speech:", error);
      // Fallback to system voice if premium fails
      return speakText(text, 'system', options);
    }
  }
}
