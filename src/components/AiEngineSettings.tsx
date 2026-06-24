import { Cpu, Wifi, Eye, FileText, Hand, Mic, Volume2, CheckCircle, Zap } from "lucide-react";

const features = [
  {
    icon: Eye,
    title: "Object Detection",
    tech: "TensorFlow.js + COCO-SSD",
    desc: "Real-time obstacle identification running fully on-device via MobileNet.",
    color: "indigo",
  },
  {
    icon: FileText,
    title: "OCR Text Reader",
    tech: "Tesseract.js",
    desc: "Printed text extraction from documents, labels and signs. Runs in your browser.",
    color: "emerald",
  },
  {
    icon: Hand,
    title: "Sign Language Translator",
    tech: "MediaPipe Hands (TF.js)",
    desc: "Hand landmark detection + rule-based gesture classification. Zero cloud needed.",
    color: "violet",
  },
  {
    icon: Mic,
    title: "Speech to Text",
    tech: "Web Speech Recognition API",
    desc: "Browser-native continuous live transcription. Works in Chrome, Edge & Safari.",
    color: "sky",
  },
  {
    icon: Volume2,
    title: "Text to Speech",
    tech: "Web Speech Synthesis API",
    desc: "System voices with adjustable rate and volume. Fully offline.",
    color: "amber",
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", badge: "bg-violet-500/10 text-violet-300 border-violet-500/20" },
  sky: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-400", badge: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
};

export default function AiEngineSettings() {
  return (
    <div
      id="ai-engine-settings-container"
      className="mb-8 bg-slate-900/60 border border-emerald-500/20 rounded-3xl overflow-hidden shadow-2xl"
    >
      <div className="p-5 sm:p-6 border-b border-slate-900 bg-slate-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 shrink-0">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-sans font-bold text-slate-100 text-sm sm:text-base tracking-tight flex items-center gap-2 flex-wrap">
                AI Engine — 100% Browser-Powered
                <span className="bg-emerald-500/10 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  UNLIMITED
                </span>
              </h4>
              <p className="font-sans text-xs text-slate-400 mt-1">
                All AI processing runs directly in your browser — no API keys, no quotas, no cloud costs. Completely free, forever.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center bg-emerald-500/5 border border-emerald-500/15 px-3.5 py-2 rounded-xl">
            <Wifi className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold text-emerald-300">OFFLINE READY</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {features.map((f) => {
          const c = colorMap[f.color];
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className={`flex flex-col gap-2.5 p-4 rounded-2xl bg-slate-950/60 border ${c.border} hover:bg-slate-950 transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 ${c.bg} rounded-xl`}>
                  <Icon className={`h-4 w-4 ${c.text}`} />
                </div>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-sans font-semibold text-xs text-slate-200">{f.title}</p>
                <p className={`font-mono text-[10px] mt-0.5 px-1.5 py-0.5 rounded-md border inline-block ${c.badge}`}>
                  {f.tech}
                </p>
              </div>
              <p className="font-sans text-[10px] text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="px-5 sm:px-6 pb-5 flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-900 pt-4">
        <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span>
          AI models are downloaded once and cached by your browser. First-use takes a few seconds to warm up. After that, everything is instant.
        </span>
      </div>
    </div>
  );
}
