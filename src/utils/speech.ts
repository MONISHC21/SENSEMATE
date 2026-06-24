let currentAudio: HTMLAudioElement | null = null;

export async function speakText(
  text: string,
  _mode: 'system' | 'premium',
  options?: {
    rate?: number;
    volume?: number;
    voiceName?: string;
  }
): Promise<void> {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  const rate = options?.rate ?? 1.0;
  const volume = options?.volume ?? 1.0;

  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported in this browser.'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.volume = volume;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
