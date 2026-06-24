import Tesseract from 'tesseract.js';

export async function extractText(
  imageSource: string,
  onProgress?: (pct: number) => void
): Promise<{ extractedText: string; confidenceScore: number }> {
  const result = await Tesseract.recognize(imageSource, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress as number) * 100));
      }
    },
  });

  const rawText = result.data.text || '';
  const lines = rawText
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);
  const extractedText = lines.join('\n');
  const confidenceScore = Math.round(result.data.confidence);

  return { extractedText, confidenceScore };
}
