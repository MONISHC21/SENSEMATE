import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export type GestureName =
  | 'Hello'     | 'Stop'    | 'Thank You' | 'Yes'    | 'No'
  | 'Help'      | 'Call Me' | 'Peace'     | 'Point'  | 'Water'
  | 'Come'      | 'Okay'    | 'Love'      | 'Sorry'  | 'Please'
  | 'Unknown';
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

function fDist(a: handPoseDetection.Keypoint, b: handPoseDetection.Keypoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyHand(kps: handPoseDetection.Keypoint[]): { gesture: GestureName; meaning: string; score: number; debugInfo: string } {
  // ── finger extension (tip above PIP in image space, smaller Y = higher) ──
  const iUp = kps[8].y  < kps[6].y;
  const mUp = kps[12].y < kps[10].y;
  const rUp = kps[16].y < kps[14].y;
  const pUp = kps[20].y < kps[18].y;
  const tUp = kps[4].y  < kps[2].y - 15;   // thumb raised above base
  const tSide = Math.abs(kps[4].x - kps[5].x) > 22; // thumb spread from index MCP

  const ext = [iUp, mUp, rUp, pUp].filter(Boolean).length;

  // finger spread helpers
  const spreadIM = Math.abs(kps[8].x  - kps[12].x);   // index-middle
  const spreadMR = Math.abs(kps[12].x - kps[16].x);   // middle-ring
  const thumbIndexDist = fDist(kps[4], kps[8]);  // thumb tip → index tip

  const debugInfo =
    `I:${iUp?'↑':'↓'} M:${mUp?'↑':'↓'} R:${rUp?'↑':'↓'} P:${pUp?'↑':'↓'} ` +
    `T:${tUp?'↑':'↓'} Ts:${tSide?'→':'·'} [${ext}/4]`;

  // ── 1. Love — ILY: index + pinky + thumb, middle + ring folded ──────────
  if (iUp && !mUp && !rUp && pUp && tUp)
    return { gesture: 'Love', meaning: 'I Love You — ILY sign!', score: 91, debugInfo };

  // ── 2. Call Me — thumb + pinky, other 3 folded ──────────────────────────
  if (!iUp && !mUp && !rUp && pUp && tUp)
    return { gesture: 'Call Me', meaning: 'Call me! — phone hand gesture', score: 90, debugInfo };

  // ── 3. Stop — all 5 up, thumb also extended ─────────────────────────────
  if (ext >= 4 && tUp)
    return { gesture: 'Stop', meaning: 'Stop — open palm raised', score: 92, debugInfo };

  // ── 4. Hello — 4 main fingers up, thumb relaxed ─────────────────────────
  if (ext >= 4)
    return { gesture: 'Hello', meaning: 'Hello! — greeting wave', score: 89, debugInfo };

  // ── 5. Yes — thumbs up, all 4 fingers folded ────────────────────────────
  if (tUp && ext === 0)
    return { gesture: 'Yes', meaning: 'Yes — thumbs up!', score: 90, debugInfo };

  // ── 6. No — horns (index + pinky, middle + ring folded) ─────────────────
  if (iUp && pUp && !mUp && !rUp)
    return { gesture: 'No', meaning: 'No — horns sign', score: 88, debugInfo };

  // ── 7. Water — W sign: index + middle + ring spread ─────────────────────
  if (iUp && mUp && rUp && !pUp && (spreadIM > 22 || spreadMR > 22))
    return { gesture: 'Water', meaning: 'Water — W hand shape', score: 86, debugInfo };

  // ── 8. Thank You — index + middle + ring, together ──────────────────────
  if (iUp && mUp && rUp && !pUp)
    return { gesture: 'Thank You', meaning: 'Thank You — three fingers raised', score: 87, debugInfo };

  // ── 9. Peace — index + middle spread (V sign) ───────────────────────────
  if (iUp && mUp && !rUp && !pUp && spreadIM > 25)
    return { gesture: 'Peace', meaning: 'Peace / Victory — V sign', score: 87, debugInfo };

  // ── 10. Come — index + middle together (beckoning) ──────────────────────
  if (iUp && mUp && !rUp && !pUp && spreadIM <= 25)
    return { gesture: 'Come', meaning: 'Come here — two fingers together', score: 83, debugInfo };

  // ── 11. Okay / Please — O shape: index+thumb pinch, others extended ─────
  if (!iUp && mUp && rUp && pUp && thumbIndexDist < 32)
    return { gesture: 'Okay', meaning: 'Okay / Please — O hand shape', score: 82, debugInfo };

  // ── 12. Please — flat palm (all up) rotating? Use thumb-side open variant
  if (!iUp && mUp && rUp && pUp && tSide)
    return { gesture: 'Please', meaning: 'Please — open palm gesture', score: 79, debugInfo };

  // ── 13. Point / Go — index only ─────────────────────────────────────────
  if (iUp && !mUp && !rUp && !pUp && !tUp)
    return { gesture: 'Point', meaning: 'Pointing / Go — single index finger', score: 85, debugInfo };

  // ── 14. Sorry — closed fist, thumb across knuckles ──────────────────────
  if (ext === 0 && !tUp && !tSide)
    return { gesture: 'Sorry', meaning: 'Sorry — closed fist (S shape)', score: 80, debugInfo };

  // ── 15. Help — SOS: thumb-side fist ─────────────────────────────────────
  if (ext === 0)
    return { gesture: 'Help', meaning: 'Help! — SOS distress signal', score: 82, debugInfo };

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
