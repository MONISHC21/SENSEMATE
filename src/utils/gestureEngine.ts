import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs';

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

function classifyHand(kps: handPoseDetection.Keypoint[]): { gesture: GestureName; meaning: string; score: number } {
  const indexUp  = fingerUp(kps, TIP.INDEX,  PIP.INDEX);
  const middleUp = fingerUp(kps, TIP.MIDDLE, PIP.MIDDLE);
  const ringUp   = fingerUp(kps, TIP.RING,   PIP.RING);
  const pinkyUp  = fingerUp(kps, TIP.PINKY,  PIP.PINKY);
  const extended = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

  // Thumb: check thumb tip relative to thumb ip joint
  const thumbUp = kps[TIP.THUMB].x < kps[3].x;

  if (extended === 4 && !thumbUp) {
    return { gesture: 'Hello', meaning: 'The person is greeting you — Hello!', score: 92 };
  }
  if (extended === 0 && thumbUp) {
    return { gesture: 'Yes', meaning: 'The person is agreeing — Yes!', score: 88 };
  }
  if (extended === 0 && !thumbUp) {
    return { gesture: 'Help', meaning: 'The person needs assistance — Help!', score: 85 };
  }
  if (indexUp && middleUp && ringUp && !pinkyUp) {
    return { gesture: 'Thank You', meaning: 'The person is expressing gratitude — Thank You!', score: 87 };
  }
  if (indexUp && !middleUp && !ringUp && pinkyUp) {
    return { gesture: 'No', meaning: 'The person is disagreeing — No!', score: 86 };
  }
  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return { gesture: 'Help', meaning: 'The person is pointing for help — Help me!', score: 83 };
  }

  return { gesture: 'Unknown', meaning: 'Gesture not recognized. Show your hand clearly in the frame.', score: 0 };
}

type GestureName = 'Hello' | 'Help' | 'Thank You' | 'Yes' | 'No' | 'Unknown';

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
