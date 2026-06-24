import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs';

export type GestureName = 'Hello' | 'Help' | 'Thank You' | 'Yes' | 'No' | 'Unknown';

let detector: handPoseDetection.HandDetector | null = null;
let detectorPromise: Promise<handPoseDetection.HandDetector> | null = null;

export function isGestureModelLoaded(): boolean {
  return detector !== null;
}

async function getDetector(): Promise<handPoseDetection.HandDetector> {
  if (detector) return detector;
  if (!detectorPromise) {
    const modelType = handPoseDetection.SupportedModels.MediaPipeHands;
    detectorPromise = handPoseDetection.createDetector(modelType, {
      runtime: 'tfjs' as const,
      maxHands: 1,
    });
  }
  detector = await detectorPromise;
  return detector;
}

export async function loadGestureModel(): Promise<void> {
  await getDetector();
}

const TIP = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 };
const MCP = { INDEX: 5, MIDDLE: 9, RING: 13, PINKY: 17 };
const PIP = { INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 };

function fingerUp(kps: handPoseDetection.Keypoint[], tip: number, pip: number): boolean {
  return kps[tip].y < kps[pip].y;
}

function classifyHand(kps: handPoseDetection.Keypoint[]): { gesture: GestureName; meaning: string; score: number } { // eslint-disable-line
  // Y axis in image space: smaller Y = higher in frame (tip above pip = finger extended)
  const indexUp  = fingerUp(kps, TIP.INDEX,  PIP.INDEX);
  const middleUp = fingerUp(kps, TIP.MIDDLE, PIP.MIDDLE);
  const ringUp   = fingerUp(kps, TIP.RING,   PIP.RING);
  const pinkyUp  = fingerUp(kps, TIP.PINKY,  PIP.PINKY);
  const extended = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

  // Thumb up: tip y is significantly above the thumb MCP (keypoint 2)
  const thumbExtended = kps[TIP.THUMB].y < kps[2].y;

  // Open hand (Hello): all 4 fingers clearly extended
  if (extended >= 3) {
    return { gesture: 'Hello', meaning: 'The person is greeting you — Hello!', score: extended === 4 ? 92 : 85 };
  }
  // Thumbs up (Yes): thumb raised, other fingers folded
  if (thumbExtended && extended === 0) {
    return { gesture: 'Yes', meaning: 'The person is agreeing — Yes!', score: 88 };
  }
  // Three fingers (Thank You): index + middle + ring
  if (indexUp && middleUp && ringUp && !pinkyUp) {
    return { gesture: 'Thank You', meaning: 'The person is expressing gratitude — Thank You!', score: 87 };
  }
  // Two fingers (peace/help): index + middle only
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return { gesture: 'Help', meaning: 'The person is asking for Help!', score: 85 };
  }
  // Horns sign (No): index + pinky, middle + ring folded
  if (indexUp && !middleUp && !ringUp && pinkyUp) {
    return { gesture: 'No', meaning: 'The person is saying No!', score: 86 };
  }
  // Single index (point/help): index only
  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return { gesture: 'Help', meaning: 'The person is pointing for help — Help me!', score: 83 };
  }
  // Fist (Help): no fingers, no thumb
  if (extended === 0 && !thumbExtended) {
    return { gesture: 'Help', meaning: 'The person needs assistance — Help!', score: 80 };
  }

  return { gesture: 'Unknown', meaning: 'Gesture not clearly recognized. Show your hand closer to the camera.', score: 0 };
}

export async function classifyGesture(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ gesture: GestureName; meaning: string; confidenceScore: number }> {
  const det = await getDetector();
  const hands = await det.estimateHands(source as HTMLVideoElement);

  if (hands.length === 0) {
    return {
      gesture: 'Unknown',
      meaning: 'No hand detected. Please position your hand clearly in the center.',
      confidenceScore: 0,
    };
  }

  const kps = hands[0].keypoints;
  const { gesture, meaning, score } = classifyHand(kps);

  return { gesture, meaning, confidenceScore: score };
}
