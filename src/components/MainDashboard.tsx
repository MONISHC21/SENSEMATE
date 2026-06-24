/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Eye, FileText, Mic, Volume2, Hand, MessageSquare, Info, LogOut, ArrowRight, Settings } from "lucide-react";
import { ActiveTab } from "../types";

interface MainDashboardProps {
  onSelectTab: (tab: ActiveTab) => void;
  onResetSession: () => void;
}

export default function MainDashboard({ onSelectTab, onResetSession }: MainDashboardProps) {
  
  const dashboardItems = [
    {
      id: "object_detection" as ActiveTab,
      title: "Object Detection Assistant",
      desc: "Identify nearby furniture, obstacles, or people with direct spatial warnings.",
      icon: Eye,
      color: "from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/35 border-slate-800 text-indigo-400",
      badge: "Vision Assist"
    },
    {
      id: "ocr_reader" as ActiveTab,
      title: "OCR Text Reader",
      desc: "Extract characters from labels, signboards, or physical pamphlets.",
      icon: FileText,
      color: "from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/35 border-slate-800 text-indigo-400",
      badge: "Text OCR"
    },
    {
      id: "speech_to_text" as ActiveTab,
      title: "Speech to Text Converter",
      desc: "Record conversations and transcribe spoken syllables to readable text.",
      icon: Mic,
      color: "from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/35 border-slate-800 text-indigo-400",
      badge: "Scribe"
    },
    {
      id: "text_to_speech" as ActiveTab,
      title: "Vocal Synthesizer (TTS)",
      desc: "Type words and synthesize them into natural neural human vocals.",
      icon: Volume2,
      color: "from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/35 border-slate-800 text-indigo-400",
      badge: "Vocal"
    },
    {
      id: "gesture" as ActiveTab,
      title: "Sign Language Translator",
      desc: "Capture and translate hand postures (Hello, Help, Thank You, Yes, No) instantly.",
      icon: Hand,
      color: "from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/35 border-slate-800 text-indigo-400",
      badge: "Sign Lang"
    },
    {
      id: "communication_bridge" as ActiveTab,
      title: "Accessibility Bridge",
      desc: "Unify voice, sign gestures, and text for seamless communication.",
      icon: MessageSquare,
      color: "from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/35 border-slate-800 text-indigo-400",
      badge: "Bridge Dialog"
    },
    {
      id: "about" as ActiveTab,
      title: "About SenseMate MVP",
      desc: "View academic credits, developer specs, and department engineering details.",
      icon: Info,
      color: "from-slate-800/20 to-slate-900/10 hover:border-indigo-500/20 border-slate-800 text-slate-400",
      badge: "Credits"
    }
  ];

  return (
    <div id="dashboard-items-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {dashboardItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            id={`dashboard-item-card-${item.id}`}
            onClick={() => onSelectTab(item.id)}
            aria-label={`${item.title}. ${item.desc}`}
            tabIndex={0}
            className={`p-6 bg-gradient-to-br ${item.color} border text-left rounded-3xl transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 min-h-[195px]`}
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[9px] uppercase font-bold tracking-widest font-mono text-slate-500 px-2.5 py-1 bg-slate-950 rounded-full border border-slate-800/80">
                  {item.badge}
                </span>
              </div>
              <h4 className="font-sans font-semibold text-slate-200 text-sm sm:text-base tracking-tight mt-4 group-hover:text-indigo-300 transition-colors">
                {item.title}
              </h4>
              <p className="font-sans text-xs text-slate-400 mt-2.5 leading-relaxed">
                {item.desc}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mt-4 font-sans opacity-85 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all">
              Launch Module
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>
        );
      })}

      {/* Exit/Reset Card */}
      <button
        id="dashboard-item-card-reset"
        onClick={onResetSession}
        aria-label="Reset Application Session"
        className="p-6 bg-gradient-to-br from-rose-500/[0.03] to-rose-600/[0.01] border border-slate-800 hover:border-rose-500/25 text-left rounded-3xl transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg min-h-[195px]"
      >
        <div>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl">
              <LogOut className="h-6 w-6 text-rose-400" />
            </div>
            <span className="text-[9px] uppercase font-bold tracking-widest font-mono text-rose-500/80 px-2.5 py-1 bg-slate-950 rounded-full border border-slate-800/80">
              Clear
            </span>
          </div>
          <h4 className="font-sans font-semibold text-slate-200 text-sm sm:text-base tracking-tight mt-4 group-hover:text-rose-400 transition-colors">
            Reset All Sessions
          </h4>
          <p className="font-sans text-xs text-slate-400 mt-2.5 leading-relaxed">
            Instantly clears active OCR findings, log streams, and verbal transcripts back to defaults.
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mt-4 font-sans opacity-80 group-hover:translate-x-1 transition-all">
          Reset App State
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </button>
    </div>
  );
}
