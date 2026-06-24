import React, { useState, useEffect } from "react";
import { Key, Cpu, Sparkles, CheckCircle, ExternalLink, Save, Trash2, RefreshCw, AlertCircle, Info, ShieldCheck, PlayCircle } from "lucide-react";
import { speakText } from "../utils/speech";

export default function AiEngineSettings() {
  const [provider, setProvider] = useState<"gemini" | "ollama">("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaVisionModel, setOllamaVisionModel] = useState("llama3.2-vision");
  const [ollamaTextModel, setOllamaTextModel] = useState("llama3.2");
  
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load existing settings
    const savedProvider = (localStorage.getItem("custom_ai_provider") || "gemini") as "gemini" | "ollama";
    const savedGeminiKey = localStorage.getItem("custom_gemini_api_key") || "";
    const savedOllamaUrl = localStorage.getItem("custom_ollama_url") || "http://localhost:11434";
    const savedOllamaVisionModel = localStorage.getItem("custom_ollama_vision_model") || "llama3.2-vision";
    const savedOllamaTextModel = localStorage.getItem("custom_ollama_text_model") || "llama3.2";

    setProvider(savedProvider);
    setGeminiKey(savedGeminiKey);
    setOllamaUrl(savedOllamaUrl);
    setOllamaVisionModel(savedOllamaVisionModel);
    setOllamaTextModel(savedOllamaTextModel);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("custom_ai_provider", provider);
    localStorage.setItem("custom_gemini_api_key", geminiKey.trim());
    localStorage.setItem("custom_ollama_url", ollamaUrl.trim());
    localStorage.setItem("custom_ollama_vision_model", ollamaVisionModel.trim());
    localStorage.setItem("custom_ollama_text_model", ollamaTextModel.trim());
    
    setIsSaved(true);
    speakText(`AI settings updated. SenseMate is now running on ${provider === "gemini" ? "Gemini Cloud API" : "Ollama local engine"}.`, "system");
    
    setTimeout(() => {
      setIsSaved(false);
      // Reload page to apply new engine config globally
      window.location.reload();
    }, 1500);
  };

  const handleReset = () => {
    localStorage.removeItem("custom_ai_provider");
    localStorage.removeItem("custom_gemini_api_key");
    localStorage.removeItem("custom_ollama_url");
    localStorage.removeItem("custom_ollama_vision_model");
    localStorage.removeItem("custom_ollama_text_model");

    setProvider("gemini");
    setGeminiKey("");
    setOllamaUrl("http://localhost:11434");
    setOllamaVisionModel("llama3.2-vision");
    setOllamaTextModel("llama3.2");

    speakText("AI settings reset to default shared cloud key.", "system");
    
    // Reload page to apply changes
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const testOllamaConnection = async () => {
    setTestStatus("testing");
    setTestMessage("Pinging local Ollama endpoint directly from your browser...");
    try {
      const cleanUrl = ollamaUrl.trim().replace(/\/$/, "");
      // Fetch directly from the browser to local Ollama.
      // This is the correct way because Ollama is running on the user's local machine,
      // which is reachable by their browser, but not by the cloud-hosted backend.
      const response = await fetch(`${cleanUrl}/api/tags`, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];
        setTestStatus("success");
        setTestMessage(`Successfully connected to Ollama! Found models: ${models.join(", ") || "none downloaded yet"}`);
      } else {
        setTestStatus("failed");
        setTestMessage(`Ollama responded with status code ${response.status}. Ensure it is running.`);
      }
    } catch (err: any) {
      setTestStatus("failed");
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const isLocalHttp = ollamaUrl.startsWith("http://localhost") || ollamaUrl.startsWith("http://127.0.0.1");
      
      if (isHttps && isLocalHttp) {
        setTestMessage("🚨 BROWSER BLOCKED CONNECTION! You are using a secure cloud app (https) but trying to connect to local Ollama (http). Your browser blocked this. To fix: Click the Lock/Tune icon next to the URL at the top of your browser -> click 'Site settings' -> find 'Insecure content' and change it to 'Allow' -> refresh the page!");
      } else {
        setTestMessage("Failed to connect. Common reasons: 1) Ollama is not running, 2) OLLAMA_ORIGINS='*' is not set (CORS error), or 3) Browser blocked insecure local HTTP content. Please read the detailed step-by-step setup guides below to resolve this!");
      }
    }
  };

  return (
    <div 
      id="ai-engine-settings-container"
      className="mb-8 bg-slate-900/60 border border-indigo-500/25 rounded-3xl overflow-hidden shadow-2xl"
    >
      <div className="p-5 sm:p-6 border-b border-slate-900 bg-slate-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shrink-0">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-sans font-bold text-slate-100 text-sm sm:text-base tracking-tight flex items-center gap-2">
                AI Engine & Local Model Configuration
                <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-500/15">
                  Local-Ready
                </span>
              </h4>
              <p className="font-sans text-xs text-slate-400 mt-1">
                Toggle between online Gemini APIs and your offline local Ollama instance for free, unlimited processing.
              </p>
            </div>
          </div>
          
          {/* Quick toggle tab buttons */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setProvider("gemini")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                provider === "gemini" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Gemini (Cloud)
            </button>
            <button
              type="button"
              onClick={() => setProvider("ollama")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                provider === "ollama" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="h-3 w-3" />
              Ollama (Local)
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-5 sm:p-6 flex flex-col gap-5">
        {provider === "gemini" ? (
          <div className="flex flex-col gap-4">
            <div className="bg-indigo-500/[0.02] border border-indigo-500/10 p-4 rounded-2xl">
              <label htmlFor="gemini-api-key-input" className="block text-xs font-semibold text-indigo-300 mb-1.5">
                Configure Your Custom Gemini API Key (Optional)
              </label>
              <p className="text-slate-400 text-xs mb-3">
                By default, the demo runs on a shared key which has strict daily quotas. Insert your own key to remove limits.
              </p>
              <input
                id="gemini-api-key-input"
                type="password"
                placeholder="Paste your Gemini API Key here (starts with AIzaSy...)"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
              <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
                <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Get a free key instantly from the <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-semibold">Google AI Studio Console</a>.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-indigo-500/[0.02] border border-indigo-500/10 p-4 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs border-b border-slate-800/60 pb-2">
                <Cpu className="h-4 w-4 text-indigo-400" />
                Local Ollama Service Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ollama-url-input" className="text-xs font-semibold text-slate-300">
                    Ollama Endpoint URL
                  </label>
                  <input
                    id="ollama-url-input"
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ollama-vision-model-input" className="text-xs font-semibold text-slate-300">
                    Ollama Vision Model
                  </label>
                  <input
                    id="ollama-vision-model-input"
                    type="text"
                    value={ollamaVisionModel}
                    onChange={(e) => setOllamaVisionModel(e.target.value)}
                    placeholder="e.g. llama3.2-vision"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500 font-sans">For Object Detection & Gestures</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ollama-text-model-input" className="text-xs font-semibold text-slate-300">
                    Ollama Text Model
                  </label>
                  <input
                    id="ollama-text-model-input"
                    type="text"
                    value={ollamaTextModel}
                    onChange={(e) => setOllamaTextModel(e.target.value)}
                    placeholder="e.g. llama3.2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500 font-sans">For core summaries and prompts</span>
                </div>
              </div>

              {/* Connection Tester */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-950 border border-slate-800 p-3 rounded-xl mt-1">
                <button
                  type="button"
                  onClick={testOllamaConnection}
                  disabled={testStatus === "testing"}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors self-stretch sm:self-auto justify-center"
                >
                  {testStatus === "testing" ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Test Connection
                </button>
                <div className="text-xs flex-1">
                  {testStatus === "idle" && (
                    <span className="text-slate-500">Not tested yet. Verify if Ollama port is open.</span>
                  )}
                  {testStatus === "testing" && (
                    <span className="text-indigo-400 animate-pulse">{testMessage}</span>
                  )}
                  {testStatus === "success" && (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" /> {testMessage}
                    </span>
                  )}
                  {testStatus === "failed" && (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> {testMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* Guide Checklist */}
              <div className="mt-2 text-xs text-slate-400 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/40 flex flex-col gap-3">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <PlayCircle className="h-3.5 w-3.5 text-indigo-400" />
                  How to launch Ollama & Configure CORS on your local machine:
                </span>
                <p className="text-xs text-slate-300">
                  Because this app runs in a secure cloud container (<code className="text-indigo-300 font-mono text-[10px]">https://</code>), modern browsers will prevent direct connections to a local Ollama instance unless <strong>CORS is enabled</strong> (<code className="text-indigo-300 font-mono text-[10px]">OLLAMA_ORIGINS="*"</code>) and, in some browsers, insecure local content is allowed.
                </p>
                <div className="space-y-4 mt-1 border-t border-slate-900 pt-3">
                  {/* Step 1 */}
                  <div>
                    <h4 className="text-xs font-semibold text-indigo-300 mb-1">1. Download required models</h4>
                    <p className="text-[11px] text-slate-400 mb-1.5">Open your terminal and run these commands to download the models:</p>
                    <div className="space-y-1 pl-2 border-l border-indigo-500/20">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Vision Model (Required for Vision/Gestures):</span>
                        <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-200 font-mono text-[10px]">ollama run llama3.2-vision</code>
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-400 block font-medium">Text Model (Optional for core chat/summaries):</span>
                        <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-200 font-mono text-[10px]">ollama run llama3.2</code>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div>
                    <h4 className="text-xs font-semibold text-indigo-300 mb-1">2. Enable CORS (Configure OLLAMA_ORIGINS)</h4>
                    <p className="text-[11px] text-slate-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2 text-amber-200">
                      ⚠️ <strong>CRITICAL FIRST STEP:</strong> You MUST quit the Ollama application completely from your System Tray / Menu Bar before starting it with the environment variables! If it is already running in the background, it will ignore any new environment variables you set.
                    </p>
                    
                    <div className="space-y-2.5 pl-2 border-l border-indigo-500/20">
                      <div>
                        <span className="text-[10px] text-indigo-400 font-semibold block">🪟 Windows Setup (PowerShell / CMD / GUI):</span>
                        <div className="text-[11px] text-slate-400 space-y-2 mt-1">
                          <p className="text-amber-300 font-semibold text-[10px]">
                            👉 IF YOU GET A "bind: Only one usage of each socket address" ERROR:
                          </p>
                          <p className="text-[11px] pl-2 border-l border-amber-500/30">
                            This means Ollama is already running in the background! You must kill it first:
                            <code className="block mt-1 bg-slate-900 p-1.5 rounded font-mono text-[10px] text-rose-300">
                              taskkill /f /im ollama.exe
                            </code>
                          </p>

                          <div className="mt-2">
                            <strong>Option A (Permanent & Recommended - No terminal required!):</strong>
                            <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                              <li>Search for <strong>"Environment Variables"</strong> in Windows Search and open <i>"Edit the system environment variables"</i>.</li>
                              <li>Click the <strong>"Environment Variables..."</strong> button at the bottom.</li>
                              <li>Under <strong>"User variables"</strong>, click <strong>"New..."</strong>.</li>
                              <li>Set Variable name to <code className="bg-slate-900 text-indigo-300 px-1 rounded">OLLAMA_ORIGINS</code> and Variable value to <code className="bg-slate-900 text-indigo-300 px-1 rounded">*</code>. Click OK.</li>
                              <li>Right-click the <strong>Ollama tray icon</strong> (near your system clock) and click <strong>Quit Ollama</strong>, then restart Ollama from your Start Menu.</li>
                            </ol>
                          </div>

                          <div className="mt-2">
                            <strong>Option B (Temporary - Run via command line):</strong>
                            <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                              <li>Quit the background Ollama app from your system tray (near your clock).</li>
                              <li>Open <strong>PowerShell</strong> and run:
                                <code className="block mt-1 bg-slate-900 p-1.5 rounded font-mono text-[10px] text-indigo-200 whitespace-pre-wrap">
                                  $env:OLLAMA_ORIGINS="*"<br />
                                  ollama serve
                                </code>
                              </li>
                              <li>Or if using standard <strong>Command Prompt (CMD)</strong>:
                                <code className="block mt-1 bg-slate-900 p-1.5 rounded font-mono text-[10px] text-indigo-200 whitespace-pre-wrap">
                                  set OLLAMA_ORIGINS=*<br />
                                  ollama serve
                                </code>
                              </li>
                            </ol>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-indigo-400 font-semibold block">🍎 macOS Setup:</span>
                        <ol className="list-decimal pl-4 mt-1 space-y-1 text-[11px] text-slate-400">
                          <li>Click the <strong>Ollama menu bar icon</strong> in the top-right and click <strong>Quit Ollama</strong>.</li>
                          <li>Open your <strong>Terminal</strong> app and run:
                            <code className="block mt-1 bg-slate-900 p-2 rounded font-mono text-[10px] text-indigo-200 whitespace-pre-wrap">
                              OLLAMA_ORIGINS="*" ollama serve
                            </code>
                          </li>
                        </ol>
                      </div>

                      <div>
                        <span className="text-[10px] text-indigo-400 font-semibold block">🐧 Linux Setup (Systemd):</span>
                        <ol className="list-decimal pl-4 mt-1 space-y-1 text-[11px] text-slate-400">
                          <li>Edit the systemd service configuration:
                            <code className="block mt-1 bg-slate-900 p-2 rounded font-mono text-[10px] text-indigo-200 whitespace-pre">
                              sudo systemctl edit ollama.service
                            </code>
                          </li>
                          <li>This opens a text editor. Add these two lines under the <code className="text-indigo-300 font-mono text-[10px] font-semibold">[Service]</code> section:
                            <code className="block mt-1 bg-slate-900 p-2 rounded font-mono text-[10px] text-indigo-200 whitespace-pre">
                              [Service]<br />
                              Environment="OLLAMA_ORIGINS=*"
                            </code>
                          </li>
                          <li>Save and exit the editor, then reload and restart Ollama:
                            <code className="block mt-1 bg-slate-900 p-2 rounded font-mono text-[10px] text-indigo-200 whitespace-pre-wrap">
                              sudo systemctl daemon-reload<br />
                              sudo systemctl restart ollama
                            </code>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl mt-3 text-slate-300">
                    <strong className="text-amber-300 block mb-1 text-[11px] flex items-center gap-1">
                      ⚠️ Crucial Browser Step (If still blocked / Mixed Content error):
                    </strong>
                    If you set the environment variable above and it still fails, your browser is blocking insecure local connections. Fix this in 5 seconds:
                    <div className="mt-2 pl-3 list-disc space-y-1.5 text-[11px] text-slate-400">
                      <div>
                        <strong>Chrome & Edge:</strong>
                        <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                          <li>Click the <strong>tune/sliders icon</strong> (or lock icon) on the left of your browser's URL address bar.</li>
                          <li>Click <strong>Site Settings</strong>.</li>
                          <li>Scroll down to find <strong>Insecure content</strong>.</li>
                          <li>Change the dropdown from <i>Block (default)</i> to <strong>Allow</strong>.</li>
                          <li>Come back to this page and <strong>refresh</strong>.</li>
                        </ol>
                      </div>
                      <div className="mt-1.5">
                        <strong>Firefox:</strong> Open a new tab, go to <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">about:config</code>, search for <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[10px]">security.mixed_content.block_active_content</code>, and double-click to set it to <strong>false</strong>.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form controls */}
        <div className="flex gap-3 justify-end items-center border-t border-slate-900 pt-5">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            title="Reset to default settings"
          >
            <Trash2 className="h-4 w-4" />
            Reset to Default
          </button>
          
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/10 cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            {isSaved ? "Saved & Reloading..." : "Apply AI Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
