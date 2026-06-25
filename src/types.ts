/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DetectedObject {
  label: string;
  position: string; // 'left', 'center', 'right', 'near', 'far', etc.
  warning: string;  // e.g. "Chair ahead on your left"
  confidence: number;
}

export interface VisionDetectionResponse {
  objects: DetectedObject[];
}

export interface OCRResponse {
  extractedText: string;
  confidenceScore: number;
}

export interface GestureResponse {
  gesture: import('./utils/gestureEngine').GestureName;
  meaning: string;
  confidenceScore: number;
  debugInfo?: string;
}

export interface TranscriptionResponse {
  text: string;
}

export interface TTSResponse {
  audioBase64: string; // Raw base64 audio string to play back on the client
}

export interface BridgeMessage {
  id: string;
  timestamp: string;
  senderType: 'deaf_user' | 'blind_user' | 'hearing_impaired_user' | 'system';
  originalModality: 'sign_language' | 'speech' | 'text';
  originalValue: string;
  translatedModality: 'speech' | 'text' | 'both';
  translatedValue: string;
}

export type ActiveTab = 
  | 'dashboard'
  | 'object_detection'
  | 'ocr_reader'
  | 'speech_to_text'
  | 'text_to_speech'
  | 'gesture'
  | 'gesture_canvas'
  | 'motion_detection'
  | 'communication_bridge'
  | 'about';
