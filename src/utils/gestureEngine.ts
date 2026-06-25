import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export type GestureName = 'Hello' | 'Help' | 'Thank You' | 'Yes' | 'No' | 'Unknown';
export type ASLLetter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'K'|'L'|'M'|'N'|'O'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'?';

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

export function classifyASLLetter(
  kps: handPoseDetection.Keypoint[]
): { letter: ASLLetter; confidence: number; debugInfo: string } {
  const iUp = kps[8].y  < kps[6].y;
  const mUp = kps[12].y < kps[10].y;
  const rUp = kps[16].y < kps[14].y;
  const pUp = kps[20].y < kps[18].y;
  const tUp = kps[4].y  < kps[2].y - 15;
  const tSide = Math.abs(kps[4].x - kps[5].x) > 22; // thumb spread from index MCP

  const spread_im = Math.abs(kps[8].x - kps[12].x);  // index-middle spread
  const extended = [iUp, mUp, rUp, pUp].filter(Boolean).length;

  const debugInfo = `I:${iUp?'↑':'↓'} M:${mUp?'↑':'↓'} R:${rUp?'↑':'↓'} P:${pUp?'↑':'↓'} T:${tUp?'↑':'↓'} Ts:${tSide?'→':'·'}`;

  // Y — thumb + pinky, others folded
  if (tUp && pUp && !iUp && !mUp && !rUp)
    return { letter: 'Y', confidence: 92, debugInfo };

  // I — pinky only
  if (pUp && !iUp && !mUp && !rUp && !tUp)
    return { letter: 'I', confidence: 89, debugInfo };

  // B — all 4 up, thumb tucked
  if (iUp && mUp && rUp && pUp && !tUp && !tSide)
    return { letter: 'B', confidence: 90, debugInfo };

  // W — index + middle + ring up, pinky down
  if (iUp && mUp && rUp && !pUp)
    return { letter: 'W', confidence: 86, debugInfo };

  // K — index + middle + thumb all up
  if (iUp && mUp && !rUp && !pUp && tUp)
    return { letter: 'K', confidence: 82, debugInfo };

  // V vs U — index + middle up only
  if (iUp && mUp && !rUp && !pUp && !tUp) {
    if (spread_im > 28) return { letter: 'V', confidence: 88, debugInfo };
    return { letter: 'U', confidence: 84, debugInfo };
  }

  // R — index + middle up and crossed (x-coords swapped)
  if (iUp && mUp && !rUp && !pUp) {
    const crossed = Math.abs(kps[8].x - kps[12].x) < 12;
    if (crossed) return { letter: 'R', confidence: 80, debugInfo };
  }

  // L — index up + thumb spread to side
  if (iUp && !mUp && !rUp && !pUp && tSide)
    return { letter: 'L', confidence: 87, debugInfo };

  // D — index only up, no thumb
  if (iUp && !mUp && !rUp && !pUp && !tUp && !tSide)
    return { letter: 'D', confidence: 84, debugInfo };

  // X — index partially curled (tip between PIP and MCP)
  if (!iUp && !mUp && !rUp && !pUp) {
    const iBent = kps[8].y > kps[6].y && kps[8].y < kps[5].y + 10;
    if (iBent && !tUp) return { letter: 'X', confidence: 74, debugInfo };
  }

  // Fist variants — all fingers down
  if (extended === 0) {
    if (tSide && !tUp) return { letter: 'A', confidence: 83, debugInfo }; // thumb beside fist
    if (tUp)           return { letter: 'T', confidence: 76, debugInfo }; // thumb up through fingers
    return             { letter: 'S', confidence: 79, debugInfo };         // thumb over fist
  }

  // E — all fingers bent down to palm level
  if (!iUp && !mUp && !rUp && !pUp && !tUp && !tSide) {
    const allLow = [kps[8].y, kps[12].y, kps[16].y, kps[20].y].every(y => y > kps[5].y);
    if (allLow) return { letter: 'E', confidence: 72, debugInfo };
  }

  // O — all fingers curved, forming O with thumb
  if (!iUp && !mUp && !rUp && !pUp) {
    const tipDist = Math.hypot(kps[8].x - kps[4].x, kps[8].y - kps[4].y);
    if (tipDist < 35) return { letter: 'O', confidence: 78, debugInfo };
  }

  // F — index + thumb pinch, other 3 up
  if (!iUp && mUp && rUp && pUp && tSide)
    return { letter: 'F', confidence: 77, debugInfo };

  // H — index + middle horizontal (both up, pointing sideways)
  if (iUp && mUp && !rUp && !pUp)
    return { letter: 'H', confidence: 72, debugInfo };

  // N — 2 fingers over thumb (index + middle down, low)
  if (!iUp && !mUp && !rUp && !pUp && tUp) {
    const nBent = kps[8].y > kps[5].y && kps[12].y > kps[9].y;
    if (nBent) return { letter: 'N', confidence: 70, debugInfo };
  }

  // M — 3 fingers over thumb
  if (!iUp && !mUp && !rUp && !pUp) {
    return { letter: 'M', confidence: 68, debugInfo };
  }

  return { letter: '?', confidence: 0, debugInfo };
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
