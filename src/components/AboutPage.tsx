/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Info, User, GraduationCap, Award, HelpCircle, ArrowRight } from "lucide-react";

export default function AboutPage() {
  const capabilities = [
    { title: "Object Detection Assistant", desc: "Allows visually impaired users to perceive nearby obstacles, chair structures, phones, or vehicles with spatial coordinates and intelligent voice alerts." },
    { title: "OCR Text Reader", desc: "Instantly scans menus, prescriptions, signboards, or physical documents, converting captured characters into plain texts and speaking them back smoothly." },
    { title: "Speech to Text Transcription", desc: "Assists hearing-impaired users by recording spoken syllables from companions and translating them into high-fidelity transcripts." },
    { title: "Vocal Synthesizer (TTS)", desc: "Enables speech-impaired individuals to type dialogues, synthesizing words into realistic human voices using neural models." },
    { title: "Sign Language Translator", desc: "Recognizes core communication gestures (Hello, Help, Thank You, Yes, No) through camera video and outputs readable textual translations." },
    { title: "Communication Bridge", desc: "A revolutionary multi-modal playground, allowing blind, deaf, and speech-impaired people to chat seamlessly across differing channels." }
  ];

  return (
    <div id="about-page-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed">
      {/* Left Column: Creator Profile */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col gap-5 shadow-xl text-center items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <User className="h-12 w-12" />
            </div>
            <span className="absolute bottom-0 right-0 p-1.5 bg-emerald-500 rounded-full border border-slate-900" title="Active developer profile" />
          </div>

          <div>
            <span className="font-sans text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Lead Developer</span>
            <h3 className="font-sans font-bold text-xl text-slate-100 mt-1">Monish Nandha Balan</h3>
            <p className="font-sans text-xs text-slate-400 mt-1.5 leading-relaxed">
              Passionate Researcher & Engineer specializing in AI-driven Assistive Technology and Human-Computer Interfaces.
            </p>
          </div>

          {/* Academic Info */}
          <div className="w-full flex flex-col gap-3 border-t border-slate-800/80 pt-5 text-left font-sans text-xs">
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-850">
              <GraduationCap className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block">Institution</span>
                <span className="text-slate-400 font-medium text-[11px] mt-0.5 block">SRM Institute of Science and Technology</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-850">
              <Award className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block">Department</span>
                <span className="text-slate-400 font-medium text-[11px] mt-0.5 block leading-relaxed">
                  Electronics and Communication Engineering with Data Science
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Project Summary and Architecture Details */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col gap-5 shadow-xl">
          <div className="border-b border-slate-800/85 pb-4">
            <h3 className="font-sans font-bold text-2xl text-slate-100 flex items-center gap-2.5">
              <span className="text-indigo-400">SenseMate</span>
              <span className="font-medium text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-1">MVP</span>
            </h3>
            <p className="font-sans text-xs text-slate-400 font-medium mt-1">Tagline: See. Hear. Communicate.</p>
          </div>

          <p className="font-sans text-xs sm:text-sm text-slate-300 leading-relaxed">
            SenseMate is an AI-powered accessibility companion engineered to maximize communication and independent living for Visually Impaired, Hearing-Impaired, and Speech-Impaired individuals. By utilizing highly responsive Computer Vision, Natural Language Processing, OCR parsing, and Vocal Speech synthesis on lightweight hardware, SenseMate resolves real-world boundaries to foster true social inclusion and spatial safety.
          </p>

          <div className="flex flex-col gap-4 border-t border-slate-800/80 pt-5">
            <h4 className="font-sans font-semibold text-sm text-slate-200">
              Core Capabilities Overview
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {capabilities.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-950 border border-slate-850 hover:border-indigo-500/10 rounded-2xl flex flex-col gap-1 transition-colors"
                >
                  <span className="font-sans font-semibold text-xs text-indigo-300">
                    {item.title}
                  </span>
                  <p className="font-sans text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
