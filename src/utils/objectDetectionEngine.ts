import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { DetectedObject } from '../types';

let model: cocoSsd.ObjectDetection | null = null;
let loadPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export async function loadObjectDetectionModel(): Promise<void> {
  if (model) return;
  if (!loadPromise) {
    loadPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
  }
  model = await loadPromise;
}

export function isObjectModelLoaded(): boolean {
  return model !== null;
}

export interface CocoDetection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export async function detectObjects(
  videoElement: HTMLVideoElement
): Promise<{ objects: DetectedObject[]; rawPredictions: CocoDetection[] }> {
  if (!model) {
    if (!loadPromise) loadPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
    model = await loadPromise;
  }

  const predictions = await model.detect(videoElement);
  const width = videoElement.videoWidth || videoElement.clientWidth || 640;
  const height = videoElement.videoHeight || videoElement.clientHeight || 480;

  const warningTemplates: Record<string, (pos: string, prox: string) => string> = {
    person:     (pos, prox) => `Person ${prox === 'near' ? 'right' : 'directly'} ${pos === 'center' ? 'ahead of you' : 'on your ' + pos}`,
    chair:      (_pos, prox) => `Chair ${prox === 'near' ? 'right in front' : 'ahead'}, watch your step`,
    car:        (pos, _prox) => `Vehicle ${pos === 'center' ? 'directly ahead' : 'on your ' + pos}`,
    bicycle:    (pos, _prox) => `Bicycle on your ${pos}`,
    bus:        (pos, _prox) => `Bus ${pos === 'center' ? 'ahead' : 'on your ' + pos}`,
    bottle:     (pos, prox) => `Bottle ${prox} ${pos}`,
    laptop:     (pos, _prox) => `Laptop on your ${pos}`,
    'cell phone': (pos, _prox) => `Phone on your ${pos}`,
    backpack:   (pos, prox) => `Backpack ${prox} ${pos}`,
    door:       (pos, _prox) => `Door ${pos === 'center' ? 'directly ahead' : 'on your ' + pos}`,
    table:      (pos, prox) => `Table ${prox} ${pos}`,
  };

  const objects: DetectedObject[] = predictions
    .filter(p => p.score > 0.35)
    .map(pred => {
      const [x, _y, w, h] = pred.bbox;
      const centerX = x + w / 2;
      const area = (w * h) / (width * height);

      const posH = centerX < width * 0.33 ? 'left' : centerX > width * 0.66 ? 'right' : 'center';
      const prox = area > 0.08 ? 'near' : 'far';
      const position = `${prox} ${posH}`;
      const confidence = Math.round(pred.score * 100);
      const label = pred.class;

      const tplFn = warningTemplates[label.toLowerCase()];
      const warning = tplFn ? tplFn(posH, prox) : `${label} detected ${position}`;

      return { label, position, warning, confidence };
    });

  return {
    objects,
    rawPredictions: predictions.map(p => ({
      bbox: p.bbox as [number, number, number, number],
      class: p.class,
      score: p.score,
    })),
  };
}
