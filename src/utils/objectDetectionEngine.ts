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

export function generateSceneDescription(objects: DetectedObject[], rawPredictions: CocoDetection[]): string {
  if (objects.length === 0) return 'Clear path ahead. No obstacles detected in the current view.';

  const left   = objects.filter(o => o.position.includes('left'));
  const right  = objects.filter(o => o.position.includes('right'));
  const center = objects.filter(o => !o.position.includes('left') && !o.position.includes('right'));

  const parts: string[] = [];
  if (left.length)   parts.push(`to your left: ${left.map(o => o.label).join(' and ')}`);
  if (center.length) parts.push(`directly ahead: ${center.map(o => o.label).join(' and ')}`);
  if (right.length)  parts.push(`to your right: ${right.map(o => o.label).join(' and ')}`);

  let desc = `I can see ${objects.length} ${objects.length === 1 ? 'object' : 'objects'}. `;
  desc += parts.join('; ') + '. ';

  // Closest object = largest bounding box area
  if (rawPredictions.length > 0) {
    const nearest = rawPredictions.reduce((a, b) => (a.bbox[2] * a.bbox[3]) > (b.bbox[2] * b.bbox[3]) ? a : b);
    const nearObj = objects.find(o => o.label.toLowerCase() === nearest.class.toLowerCase());
    if (nearObj) desc += `Closest: ${nearObj.label} — ${nearObj.warning}.`;
  }

  return desc;
}
