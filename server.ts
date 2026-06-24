/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "5000");

// Enable JSON parser with large body size limit for base64 images
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Lazy-initialized Gemini AI Client
let aiClient: GoogleGenAI | null = null;

function getAiClient(customKey?: string): GoogleGenAI {
  if (customKey && customKey.trim() !== "") {
    return new GoogleGenAI({
      apiKey: customKey.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build-custom",
        },
      },
    });
  }

  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is missing. Please set your Gemini API key in the AI Studio Settings -> Secrets panel."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Utility to call Gemini API with robust retry support (for handling 429 and 503 errors)
async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMsg = error?.message || "";
      const errorStr = typeof error === "object" ? JSON.stringify(error) : String(error);
      const isRateLimit = error?.status === 429 || error?.statusCode === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED");
      const isTransient = error?.status === 503 || error?.statusCode === 503 || errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("temporary") || errorStr.includes("503") || errorStr.includes("UNAVAILABLE");
      
      if ((isRateLimit || isTransient) && attempt <= maxRetries) {
        const baseDelay = isRateLimit ? initialDelay * 2.5 : initialDelay;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        logEvent(`Gemini API returned ${isRateLimit ? "429 Rate Limit" : "503 Service Unavailable"} (Attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Utility to parse data URLs into MIME type and raw base64 data
function parseDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      base64Data: matches[2],
    };
  }
  // Try default image type if not a data URL
  return {
    mimeType: "image/jpeg",
    base64Data: dataUrl,
  };
}

// Simple Logger
function logEvent(message: string, isError = false) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${isError ? "🚨 ERROR:" : "ℹ️ INFO:"} ${message}`);
}

// Utility to parse and format Gemini errors into clean, friendly user feedback with actionable resolution guides
function formatGeminiError(error: any): string {
  if (!error) return "Unknown error";
  
  let msg = error.message || String(error);
  
  // Try to parse if it's a JSON string from Google API
  try {
    if (typeof msg === "string" && (msg.trim().startsWith("{") || msg.includes('"error"'))) {
      const startIdx = msg.indexOf("{");
      const endIdx = msg.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = msg.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed?.error?.message) {
          msg = parsed.error.message;
        }
      }
    }
  } catch (e) {
    // Ignore and use original message
  }

  // If it's a quota/rate limit error, add helpful instructions
  if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("exhausted") || msg.toLowerCase().includes("resource_exhausted")) {
    return "You have exceeded the free-tier quota (20 requests/day) for the built-in Gemini API. " +
           "To resolve this and continue using SenseMate, please: " +
           "1) Go to 'AI Engine Settings' at the top right of the dashboard and add your custom Gemini API key (unlimited free calls!), or " +
           "2) Configure local Ollama to run completely offline for 100% free and unlimited on-device vision and speech!";
  }
  
  return msg;
}

// Clean JSON response from Ollama models that might return markdown blocks
function cleanOllamaJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// --- API ENDPOINTS ---

// 1. Live Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Ollama Connection Test Endpoint
app.post("/api/ollama/test", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: "Missing Ollama url." });
      return;
    }

    logEvent(`Testing connection to local Ollama at ${url}`);
    
    const response = await fetch(`${url.replace(/\/$/, "")}/api/tags`, {
      method: "GET",
    });

    if (response.ok) {
      const data = await response.json() as any;
      const models = data.models?.map((m: any) => m.name) || [];
      res.json({ success: true, models });
    } else {
      res.status(500).json({ error: `Ollama responded with status code ${response.status}` });
    }
  } catch (error: any) {
    logEvent(`Ollama connection test failed: ${error.message}`, true);
    res.status(500).json({ 
      error: `Could not connect to local Ollama. Ensure Ollama is running on your machine and OLLAMA_ORIGINS="*" env variable is set.`
    });
  }
});

// 2. Object Detection API
app.post("/api/vision/detect", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Missing image data." });
      return;
    }

    const aiProvider = req.headers["x-ai-provider"] as string || "gemini";

    if (aiProvider === "ollama") {
      const ollamaUrl = (req.headers["x-ollama-url"] as string || "http://localhost:11434").replace(/\/$/, "");
      const ollamaVisionModel = req.headers["x-ollama-vision-model"] as string || "llama3.2-vision";
      const { base64Data } = parseDataUrl(image);

      logEvent(`Routing Object Detection to local Ollama (${ollamaVisionModel}) at ${ollamaUrl}`);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaVisionModel,
          messages: [
            {
              role: "user",
              content: "Identify critical obstacles and objects in this picture to assist a visually impaired user. " +
                "Detect elements such as people, chairs, tables, bottles, cell phones, laptops, backpacks, cars, buses, bicycles, " +
                "and doors. Provide their relative horizontal position (left, center, right) and proximity (near, far). " +
                "Respond with a raw JSON object matching this schema exactly, do not return any other text, markdown blocks, or introduction: " +
                "{ \"objects\": [ { \"label\": \"chair\", \"position\": \"near center\", \"warning\": \"Chair in front of you\", \"confidence\": 95 } ] }",
              images: [base64Data]
            }
          ],
          stream: false,
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = await response.json() as any;
      const text = data.message?.content || "{\"objects\": []}";
      const parsed = JSON.parse(cleanOllamaJson(text));
      logEvent(`Object Detection via Ollama successful. Found ${parsed.objects?.length || 0} objects.`);
      res.json(parsed);
      return;
    }

    logEvent("Launching Object Detection Assistant via Gemini");
    const customKey = req.headers["x-gemini-api-key"] as string;
    const ai = getAiClient(customKey);
    const { mimeType, base64Data } = parseDataUrl(image);

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const promptPart = {
      text: "Identify critical obstacles and objects in this picture to assist a visually impaired user. " +
        "Detect elements such as people, chairs, tables, bottles, cell phones, laptops, backpacks, cars, buses, bicycles, " +
        "and doors. Provide their relative horizontal position (left, center, right) and proximity (near, far). " +
        "Create a short voice-alert warning (e.g., 'Chair in front', 'Vehicle nearby on your right').",
    };

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              objects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: {
                      type: Type.STRING,
                      description: "Common name of the detected object (e.g., person, chair, laptop, car).",
                    },
                    position: {
                      type: Type.STRING,
                      description: "Relative position and warning (e.g., near center, on your far left, on your right).",
                    },
                    warning: {
                      type: Type.STRING,
                      description: "An actionable, voice-alert text to warn the user.",
                    },
                    confidence: {
                      type: Type.INTEGER,
                      description: "Confidence rating percentage (0 - 100).",
                    },
                  },
                  required: ["label", "position", "warning", "confidence"],
                },
              },
            },
            required: ["objects"],
          },
        },
      })
    );

    const resultText = response.text || "{\"objects\": []}";
    const parsed = JSON.parse(resultText);
    logEvent(`Object Detection successful. Found ${parsed.objects?.length || 0} objects.`);
    res.json(parsed);
  } catch (error: any) {
    logEvent(`Object Detection failed: ${error.message}`, true);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// 3. OCR Text Reader API
app.post("/api/vision/ocr", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Missing image data." });
      return;
    }

    const aiProvider = req.headers["x-ai-provider"] as string || "gemini";

    if (aiProvider === "ollama") {
      const ollamaUrl = (req.headers["x-ollama-url"] as string || "http://localhost:11434").replace(/\/$/, "");
      const ollamaVisionModel = req.headers["x-ollama-vision-model"] as string || "llama3.2-vision";
      const { base64Data } = parseDataUrl(image);

      logEvent(`Routing OCR to local Ollama (${ollamaVisionModel}) at ${ollamaUrl}`);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaVisionModel,
          messages: [
            {
              role: "user",
              content: "Extract all printed text visible in this image (e.g., documents, product labels, signs, medicine labels). " +
                "Respond with a raw JSON object matching this schema exactly, do not return any other text, markdown blocks, or conversational text: " +
                "{ \"extractedText\": \"all extracted text here\", \"confidenceScore\": 90 }",
              images: [base64Data]
            }
          ],
          stream: false,
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = await response.json() as any;
      const text = data.message?.content || "{}";
      const parsed = JSON.parse(cleanOllamaJson(text));
      logEvent("OCR extraction via Ollama successful.");
      res.json(parsed);
      return;
    }

    logEvent("Launching OCR Text Reader via Gemini");
    const customKey = req.headers["x-gemini-api-key"] as string;
    const ai = getAiClient(customKey);
    const { mimeType, base64Data } = parseDataUrl(image);

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const promptPart = {
      text: "Extract all printed text visible in this image (e.g., documents, product labels, signs, medicine labels). " +
        "Compile it into clean, readable paragraph form. Determine a general confidence score for the extraction.",
    };

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedText: {
                type: Type.STRING,
                description: "The complete concatenated text from the image, formatted with newlines if appropriate.",
              },
              confidenceScore: {
                type: Type.INTEGER,
                description: "Estimated extraction accuracy score (0 to 100).",
              },
            },
            required: ["extractedText", "confidenceScore"],
          },
        },
      })
    );

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);
    logEvent("OCR extraction successful.");
    res.json(parsed);
  } catch (error: any) {
    logEvent(`OCR failed: ${error.message}`, true);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// 4. Sign Language Gesture API
app.post("/api/vision/gesture", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Missing image data." });
      return;
    }

    const aiProvider = req.headers["x-ai-provider"] as string || "gemini";

    if (aiProvider === "ollama") {
      const ollamaUrl = (req.headers["x-ollama-url"] as string || "http://localhost:11434").replace(/\/$/, "");
      const ollamaVisionModel = req.headers["x-ollama-vision-model"] as string || "llama3.2-vision";
      const { base64Data } = parseDataUrl(image);

      logEvent(`Routing Sign Language Gesture to local Ollama (${ollamaVisionModel}) at ${ollamaUrl}`);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaVisionModel,
          messages: [
            {
              role: "user",
              content: "This image shows a sign language hand gesture. " +
                "Classify the gesture into one of the following key communication signs: " +
                "'Hello', 'Help', 'Thank You', 'Yes', 'No', or 'Unknown'. " +
                "Respond with a raw JSON object matching this schema exactly, do not return any other text, markdown blocks, or conversational text: " +
                "{ \"gesture\": \"one of the signs\", \"meaning\": \"friendly translation sentence\", \"confidenceScore\": 95 }",
              images: [base64Data]
            }
          ],
          stream: false,
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = await response.json() as any;
      const text = data.message?.content || "{}";
      const parsed = JSON.parse(cleanOllamaJson(text));
      logEvent(`Gesture Translation via Ollama completed: ${parsed.gesture}`);
      res.json(parsed);
      return;
    }

    logEvent("Launching Sign Language Translator via Gemini");
    const customKey = req.headers["x-gemini-api-key"] as string;
    const ai = getAiClient(customKey);
    const { mimeType, base64Data } = parseDataUrl(image);

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const promptPart = {
      text: "This image shows a sign language hand gesture. " +
        "Classify the gesture into one of the following key communication signs: " +
        "'Hello', 'Help', 'Thank You', 'Yes', 'No', or 'Unknown'. " +
        "If you do not see a hand or are highly uncertain, return 'Unknown'.",
    };

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gesture: {
                type: Type.STRING,
                description: "One of: 'Hello', 'Help', 'Thank You', 'Yes', 'No', 'Unknown'.",
              },
              meaning: {
                type: Type.STRING,
                description: "A friendly, explanatory string detailing what the user is saying.",
              },
              confidenceScore: {
                type: Type.INTEGER,
                description: "Classification confidence score (0 to 100).",
              },
            },
            required: ["gesture", "meaning", "confidenceScore"],
          },
        },
      })
    );

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);
    logEvent(`Gesture Translation completed: ${parsed.gesture}`);
    res.json(parsed);
  } catch (error: any) {
    logEvent(`Gesture classification failed: ${error.message}`, true);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// 5. Speech-to-Text Transcription API
app.post("/api/speech/transcribe", async (req, res) => {
  try {
    const { audio, mimeType = "audio/webm" } = req.body;
    if (!audio) {
      res.status(400).json({ error: "Missing audio data." });
      return;
    }

    logEvent("Launching Speech-to-Text Transcription via Gemini");
    const aiProvider = req.headers["x-ai-provider"] as string || "gemini";

    if (aiProvider === "ollama") {
      logEvent("Speech transcription requested in local Ollama mode. Checking for Gemini custom key fallback.");
      const customKey = req.headers["x-gemini-api-key"] as string;
      const hasKey = customKey || process.env.GEMINI_API_KEY;
      if (!hasKey) {
        res.status(400).json({ error: "Local Ollama does not support direct audio file transcription natively. The system uses your browser's built-in Web Speech API for 100% offline local speech recognition." });
        return;
      }
    }

    const customKey = req.headers["x-gemini-api-key"] as string;
    const ai = getAiClient(customKey);

    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(";")[0], // Strip additional attributes like rate/codec
        data: audio,
      },
    };

    const promptPart = {
      text: "Transcribe the spoken language in this audio file into precise written text. " +
        "Return only the exact words spoken, with appropriate punctuation. If no words are spoken, return empty.",
    };

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [audioPart, promptPart] },
      })
    );

    const text = response.text?.trim() || "";
    logEvent(`Speech transcription successful: "${text.substring(0, 40)}..."`);
    res.json({ text });
  } catch (error: any) {
    logEvent(`Speech transcription failed: ${error.message}`, true);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// 6. Text-to-Speech Generation API
app.post("/api/speech/speak", async (req, res) => {
  try {
    const { text, voice = "Zephyr" } = req.body;
    if (!text) {
      res.status(400).json({ error: "Missing text input." });
      return;
    }

    logEvent(`Launching Text-to-Speech translation using Gemini with voice: ${voice}`);
    const aiProvider = req.headers["x-ai-provider"] as string || "gemini";

    if (aiProvider === "ollama") {
      res.status(400).json({ error: "Local Ollama does not support native neural TTS. The application automatically utilizes your browser's built-in offline Web Speech Synthesis for local voice playback." });
      return;
    }

    const customKey = req.headers["x-gemini-api-key"] as string;
    const ai = getAiClient(customKey);

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say clearly and naturally: ${text}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            },
          },
        },
      })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio payload returned from Gemini TTS.");
    }

    logEvent("TTS audio generation successful.");
    res.json({ audioBase64: base64Audio });
  } catch (error: any) {
    logEvent(`TTS generation failed: ${error.message}`, true);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// --- VITE DEV SERVER / PRODUCTION STATIC ASSET ROUTING ---
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      logEvent("Initializing Vite in development middleware mode");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      logEvent("Serving production static assets");
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      logEvent(`SenseMate Server listening on http://0.0.0.0:${PORT}`);
    });

    server.on("error", (err: any) => {
      logEvent(`Server error: ${err.message}`, true);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      logEvent(`Unhandled Promise Rejection: ${reason}`, true);
      process.exit(1);
    });

    process.on("uncaughtException", (err) => {
      logEvent(`Uncaught Exception: ${err.message}`, true);
      process.exit(1);
    });
  } catch (error: any) {
    logEvent(`Failed to start server: ${error.message}`, true);
    process.exit(1);
  }
}

startServer();
