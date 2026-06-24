/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Constructs standard headers for SenseMate API calls, including
 * Gemini API keys or Ollama local engine settings.
 */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const provider = localStorage.getItem("custom_ai_provider") || "gemini";
    const customKey = localStorage.getItem("custom_gemini_api_key") || "";
    const ollamaUrl = localStorage.getItem("custom_ollama_url") || "http://localhost:11434";
    const ollamaVisionModel = localStorage.getItem("custom_ollama_vision_model") || "llama3.2-vision";
    const ollamaTextModel = localStorage.getItem("custom_ollama_text_model") || "llama3.2";

    headers["x-ai-provider"] = provider;

    if (provider === "gemini") {
      if (customKey.trim()) {
        headers["x-gemini-api-key"] = customKey.trim();
      }
    } else {
      headers["x-ollama-url"] = ollamaUrl.trim();
      headers["x-ollama-vision-model"] = ollamaVisionModel.trim();
      headers["x-ollama-text-model"] = ollamaTextModel.trim();
    }
  }

  return headers;
}

export async function callVisionApi(endpoint: "detect" | "ocr" | "gesture", image: string): Promise<any> {
  const provider = typeof window !== "undefined" ? localStorage.getItem("custom_ai_provider") || "gemini" : "gemini";

  if (provider === "ollama") {
    const ollamaUrl = (localStorage.getItem("custom_ollama_url") || "http://localhost:11434").replace(/\/$/, "");
    const ollamaVisionModel = localStorage.getItem("custom_ollama_vision_model") || "llama3.2-vision";
    
    // Parse the image to raw base64 data
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    const base64Data = matches && matches.length === 3 ? matches[2] : image;

    let systemPrompt = "";
    if (endpoint === "detect") {
      systemPrompt = "Identify critical obstacles and objects in this picture to assist a visually impaired user. " +
        "Detect elements such as people, chairs, tables, bottles, cell phones, laptops, backpacks, cars, buses, bicycles, " +
        "and doors. Provide their relative horizontal position (left, center, right) and proximity (near, far). " +
        "Respond with a raw JSON object matching this schema exactly, do not return any other text, markdown blocks, or introduction: " +
        "{ \"objects\": [ { \"label\": \"chair\", \"position\": \"near center\", \"warning\": \"Chair in front of you\", \"confidence\": 95 } ] }";
    } else if (endpoint === "ocr") {
      systemPrompt = "Extract all printed text visible in this image (e.g., documents, product labels, signs, medicine labels). " +
        "Respond with a raw JSON object matching this schema exactly, do not return any other text, markdown blocks, or conversational text: " +
        "{ \"extractedText\": \"all extracted text here\", \"confidenceScore\": 90 }";
    } else if (endpoint === "gesture") {
      systemPrompt = "This image shows a sign language hand gesture. " +
        "Classify the gesture into one of the following key communication signs: " +
        "'Hello', 'Help', 'Thank You', 'Yes', 'No', or 'Unknown'. " +
        "Respond with a raw JSON object matching this schema exactly, do not return any other text, markdown blocks, or conversational text: " +
        "{ \"gesture\": \"one of the signs\", \"meaning\": \"friendly translation sentence\", \"confidenceScore\": 95 }";
    }

    let response;
    try {
      response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaVisionModel,
          messages: [
            {
              role: "user",
              content: systemPrompt,
              images: [base64Data]
            }
          ],
          stream: false,
          format: "json"
        }),
      });
    } catch (err: any) {
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const isLocalHttp = ollamaUrl.startsWith("http://localhost") || ollamaUrl.startsWith("http://127.0.0.1");
      if (isHttps && isLocalHttp) {
        throw new Error("BROWSER BLOCKED CONNECTION: Your browser blocked connecting to local Ollama (http) from the secure cloud app (https). Click the lock/tune icon next to the URL -> Site settings -> Insecure content -> Allow, then refresh the page.");
      } else {
        throw new Error("Failed to connect to local Ollama. Ensure Ollama is running and OLLAMA_ORIGINS='*' is set.");
      }
    }

    if (!response.ok) {
      throw new Error(`Local Ollama service responded with status ${response.status}. Ensure Ollama is running, listening on this port, and OLLAMA_ORIGINS="*" env is set.`);
    }

    const data = await response.json() as any;
    const content = data.message?.content || "{}";
    
    // Clean up any potential markdown code blocks
    let cleaned = content.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    return JSON.parse(cleaned);
  } else {
    // Gemini provider - call the backend API proxy safely
    const response = await fetch(`/api/vision/${endpoint}`, {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `${endpoint} request failed.`);
    }

    return await response.json();
  }
}
