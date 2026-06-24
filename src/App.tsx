/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Sparkles, ArrowLeft, RefreshCw, Eye, HelpCircle } from "lucide-react";
import MainDashboard from "./components/MainDashboard";
import ObjectDetection from "./components/ObjectDetection";
import OCRReader from "./components/OCRReader";
import SpeechToText from "./components/SpeechToText";
import TextToSpeech from "./components/TextToSpeech";
import GestureTranslator from "./components/GestureTranslator";
import CommunicationBridge from "./components/CommunicationBridge";
import AboutPage from "./components/AboutPage";
import AiEngineSettings from "./components/AiEngineSettings";
import { ActiveTab } from "./types";
import { speakText } from "./utils/speech";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [sessionKey, setSessionKey] = useState(0);

  // Greet user on first startup
  useEffect(() => {
    speakText(
      "Welcome to SenseMate, your AI accessibility companion. Select an assistant module to begin.",
      "system"
    );
  }, []);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    // Announcement for screen-readers & voice assist
    const label = tab.replace("_", " ").toUpperCase();
    speakText(`${label} activated.`, "system");
  };

  const handleResetSession = () => {
    // Clear state by incrementing sessionKey to force remount
    setSessionKey((prev) => prev + 1);
    setActiveTab("dashboard");
    speakText("All active sessions and log streams have been successfully reset.", "system");
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "object_detection":
        return <ObjectDetection key={sessionKey} />;
      case "ocr_reader":
        return <OCRReader key={sessionKey} />;
      case "speech_to_text":
        return <SpeechToText key={sessionKey} />;
      case "text_to_speech":
        return <TextToSpeech key={sessionKey} />;
      case "gesture":
        return <GestureTranslator key={sessionKey} />;
      case "communication_bridge":
        return <CommunicationBridge key={sessionKey} />;
      case "about":
        return <AboutPage />;
      default:
        return (
          <MainDashboard
            onSelectTab={handleSelectTab}
            onResetSession={handleResetSession}
          />
        );
    }
  };

  const getPageTitleAndDesc = () => {
    switch (activeTab) {
      case "object_detection":
        return { title: "Spatial Object Detection", subtitle: "Real-time voice guidance and environment obstacles mapping" };
      case "ocr_reader":
        return { title: "OCR Text Reading Engine", subtitle: "Instantly translate printed letters and prescription details into speech" };
      case "speech_to_text":
        return { title: "Speech to Text Transcription", subtitle: "Record audio statements and convert them into legible transcripts" };
      case "text_to_speech":
        return { title: "Text to Speech Synthesis", subtitle: "Convert custom texts into natural spoken voices using neural models" };
      case "gesture":
        return { title: "Sign Language Translator", subtitle: "Classify and verbalize core sign expressions through live vision" };
      case "communication_bridge":
        return { title: "Accessibility Communication Bridge", subtitle: "Multi-modal translations supporting Deaf, Blind, and Speech-Impaired companions" };
      case "about":
        return { title: "About SenseMate MVP", subtitle: "Academic developers details, department specs, and technical structures" };
      default:
        return { title: "SenseMate Portal", subtitle: "AI-Powered Accessibility Companion for People with Disabilities" };
    }
  };

  const { title, subtitle } = getPageTitleAndDesc();

  return (
    <div
      id="app-root-container"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative antialiased selection:bg-indigo-500/30 selection:text-indigo-200"
    >
      {/* Top Navigation Header */}
      <header
        id="app-main-header"
        className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 py-4 px-6 sm:px-8 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button
            id="brand-logo-btn"
            onClick={() => handleSelectTab("dashboard")}
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
            aria-label="SenseMate Logo. Click to return to Main Dashboard"
          >
            <div className="p-2 bg-indigo-600 rounded-xl group-hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/15">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-sans font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-100 bg-clip-text text-transparent">
                SenseMate
              </span>
              <span className="text-[10px] font-mono text-indigo-400 block -mt-0.5 tracking-wider font-semibold">
                ACCESSIBILITY PARTNER
              </span>
            </div>
          </button>
        </div>

        {/* Action Header controls */}
        <div className="flex items-center gap-3">
          {activeTab !== "dashboard" ? (
            <button
              id="back-to-dashboard-btn"
              onClick={() => handleSelectTab("dashboard")}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl font-sans text-xs font-semibold text-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Main Dashboard
            </button>
          ) : (
            <button
              id="header-about-btn"
              onClick={() => handleSelectTab("about")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-xl font-sans text-xs font-semibold text-indigo-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              About MVP
            </button>
          )}

          <button
            id="reset-session-header-btn"
            onClick={handleResetSession}
            className="p-2 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded-xl text-slate-500 hover:text-rose-400 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            title="Reset active logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        id="app-main-content-section"
        className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 sm:py-12 flex flex-col gap-6"
      >
        {/* Module title card */}
        <div id="module-hero-intro" className="flex flex-col gap-1.5 border-b border-slate-900 pb-6 mb-2">
          <h2 className="font-sans font-bold text-xl sm:text-2xl text-slate-100 tracking-tight">
            {title}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-slate-400 font-medium">
            {subtitle}
          </p>
        </div>

        {activeTab === "dashboard" && <AiEngineSettings />}

        {/* Dynamic Inner Tab component rendering */}
        <div id="inner-tab-render-wrapper" className="flex-1">
          {renderActiveTab()}
        </div>
      </main>

      {/* Footer credits and information */}
      <footer
        id="app-main-footer"
        className="py-6 border-t border-slate-950 bg-slate-950/90 text-center font-mono text-[10px] text-slate-600 flex flex-col sm:flex-row sm:justify-between items-center justify-center gap-4 px-8"
      >
        <span>
          Developed by <strong>Monish Nandha Balan</strong> • SRM Institute of Science and Technology
        </span>
        <span className="bg-slate-900 border border-slate-850 px-3 py-1 rounded-full text-[9px] font-medium text-slate-500">
          Dept of ECE with Data Science • SenseMate v1.0 [MVP]
        </span>
      </footer>
    </div>
  );
}
