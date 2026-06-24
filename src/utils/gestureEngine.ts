import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export type GestureName = 'Hello' | 'Help' | 'Thank You' | 'Yes' | 'No' | 'Unknown';

let detector: handPoseDetection.HandDetector | null = null;
let detectorPromise: Promise<handPoseDetection.HandDetector> | null = null;

export function isGestureModelLoaded(): boolean {
  return detector !== null;
}

async function getDetector(): Promise<handPoseDetection.HandDetector> {
  if (detector) return detector;
  if (!detectorPromise) {
    // Ensure TF.js backend is ready before creating detector
    await tf.ready();
    const modelType = handPoseDetection.SupportedModels.MediaPipeHands;
    detectorPromise = handPoseDetection.createDetector(modelType, {
      runtime: 'tfjs' as const,
      modelType: 'lite',
      maxHands: 1,
    });
  }
  detector = await detectorPromise;
  return detector;
}

export async function loadGestureModel(): Promise<void> {
  await getDetector();
}

export async function getHandKeypoints(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<{ keypoints: handPoseDetection.Keypoint[]; videoWidth: number; videoHeight: number } | null> {
  const det = await getDetector();

  let processSource: HTMLCanvasElement | HTMLVideoElement = source;
  if (source instanceof HTMLVideoElement && source.videoWidth > 0 && source.videoHeight > 0) {
    const cap = document.createElement('canvas');
    cap.width = source.videoWidth;
    cap.height = source.videoHeight;
    const capCtx = cap.getContext('2d');
    if (capCtx) {
      capCtx.drawImage(source, 0, 0, cap.width, cap.height);
      processSource = cap;
    }
  }

  const hands = await det.estimateHands(processSource as HTMLVideoElement);
  if (hands.length === 0) return null;

  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

  return { keypoints: hands[0].keypoints, videoWidth: w, videoHeight: h };
}

const TIP = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 };
const MCP = { INDEX: 5, MIDDLE: 9, RING: 13, PINKY: 17 };
const PIP = { INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 };

function fingerUp(kps: handPoseDetection.Keypoint[], tip: number, pip: number): boolean {
  return kps[tip].y < kps[pip].y;
}

function classifyHand(kps: handPoseDetection.Keypoint[]): { gesture: GestureName; meaning: string; score: number; debugInfo: string } {
  // Y axis in image space: smaller Y = higher in frame (tip above pip = finger extended)
  const indexUp  = fingerUp(kps, TIP.INDEX,  PIP.INDEX);
  const middleUp = fingerUp(kps, TIP.MIDDLE, PIP.MIDDLE);
  const ringUp   = fingerUp(kps, TIP.RING,   PIP.RING);
  const pinkyUp  = fingerUp(kps, TIP.PINKY,  PIP.PINKY);
  const extended = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

  // Thumb: compare tip Y to thumb MCP (kp 2) — tip higher in frame (smaller Y) = extended up
  const thumbExtended = kps[TIP.THUMB].y < kps[2].y - 15;

  const debugInfo = `I:${indexUp?'↑':'↓'} M:${middleUp?'↑':'↓'} R:${ringUp?'↑':'↓'} P:${pinkyUp?'↑':'↓'} T:${thumbExtended?'↑':'↓'} [${extended}/4]`;

  // Open hand (Hello): 3 or 4 fingers extended
  if (extended >= 3) {
    return { gesture: 'Hello', meaning: 'The person is greeting you — Hello!', score: extended === 4 ? 92 : 85, debugInfo };
  }
  // Thumbs up (Yes): thumb raised, all other fingers folded
  if (thumbExtended && extended <= 1) {
    return { gesture: 'Yes', meaning: 'The person is agreeing — Yes!', score: 88, debugInfo };
  }
  // Horns sign (No): index + pinky extended, middle + ring folded
  if (indexUp && !middleUp && !ringUp && pinkyUp) {
    return { gesture: 'No', meaning: 'The person is saying No!', score: 86, debugInfo };
  }
  // Three fingers up (Thank You): index + middle + ring
  if (indexUp && middleUp && ringUp && !pinkyUp) {
    return { gesture: 'Thank You', meaning: 'The person is expressing gratitude — Thank You!', score: 87, debugInfo };
  }
  // Two fingers peace / V sign (Help)
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return { gesture: 'Help', meaning: 'The person is asking for Help!', score: 85, debugInfo };
  }
  // Single pointing finger (Help)
  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return { gesture: 'Help', meaning: 'The person needs help — pointing gesture detected!', score: 83, debugInfo };
  }
  // Closed fist — needs help
  if (extended === 0 && !thumbExtended) {
    return { gesture: 'Help', meaning: 'The person needs assistance — Help!', score: 78, debugInfo };
  }

  return { gesture: 'Unknown', meaning: 'Gesture not clearly recognized. Show your full hand closer to the camera.', score: 0, debugInfo };
}

export async function classifyGesture(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ gesture: GestureName; meaning: string; confidenceScore: number; debugInfo: string }> {
  const det = await getDetector();

  // Capture video to canvas first for reliable pixel access
  let processSource: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement = source;
  if (source instanceof HTMLVideoElement && source.videoWidth > 0 && source.videoHeight > 0) {
    const cap = document.createElement('canvas');
    cap.width = source.videoWidth;
    cap.height = source.videoHeight;
    const capCtx = cap.getContext('2d');
    if (capCtx) {
      capCtx.drawImage(source, 0, 0, cap.width, cap.height);
      processSource = cap;
    }
  }

  const hands = await det.estimateHands(processSource as HTMLVideoElement);

  if (hands.length === 0) {
    return {
      gesture: 'Unknown',
      meaning: 'No hand detected. Hold your hand up closer to the camera, with fingers visible.',
      confidenceScore: 0,
      debugInfo: 'No hand found in frame',
    };
  }

  const kps = hands[0].keypoints;
  const { gesture, meaning, score, debugInfo } = classifyHand(kps);

  return { gesture, meaning, confidenceScore: score, debugInfo };
}
