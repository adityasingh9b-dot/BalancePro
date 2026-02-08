
import React, { useRef, useEffect, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";

interface PostureMonitorProps {
  onBack: () => void;
}

// --- UTILS ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [feedback, setFeedback] = useState("Establishing Live Studio Connection...");
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Audio refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    let frameInterval: number;
    let stream: MediaStream;

    const setupLiveSession = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Setup Media
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Audio Contexts
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setIsConnected(true);
              setFeedback("Coach Nitesh is watching... Beta, position le lo!");
              
              // 1. Stream Audio
              const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContextRef.current!.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              // Handle Audio Output
              const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (audioBase64 && outputAudioContextRef.current) {
                setIsSpeaking(true);
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const audioBuffer = await decodeAudioData(decode(audioBase64), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setIsSpeaking(false);
                };
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }

              // Handle Transcription for Feedback Display
              if (message.serverContent?.outputTranscription) {
                setFeedback(message.serverContent.outputTranscription.text);
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
              }
            },
            onclose: () => setIsConnected(false),
            onerror: (e) => console.error("Live Error:", e)
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: "You are Coach Nitesh, a world-class Indian fitness trainer. You are watching the client via camera. Be high-energy, authoritative, and motivating. Speak in Hinglish (Hindi/English mix). Correct their form immediately if you see issues like rounded back or incorrect alignment. Focus on safety and breathing. Keep coaching short and punchy.",
            outputAudioTranscription: {}
          }
        });

        sessionRef.current = await sessionPromise;

        // 2. Stream Video (Images)
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        frameInterval = window.setInterval(() => {
          if (videoRef.current && videoRef.current.videoWidth) {
            canvas.width = 320;
            canvas.height = 240;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
            });
          }
        }, 1000); // 1 FPS for efficiency

      } catch (err) {
        console.error("Setup failed:", err);
        setFeedback("Failed to start Live Studio.");
      }
    };

    setupLiveSession();

    return () => {
      clearInterval(frameInterval);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (sessionRef.current) sessionRef.current.close();
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    };
  }, []);

  function createPcmBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-6 overflow-hidden">
      {/* HUD Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="text-[10px] uppercase font-black tracking-widest">Back to Studio</span>
        </button>
        <div className="flex items-center gap-4">
           <div className={`flex items-center gap-2 bg-lime-400/10 px-4 py-2 rounded-full border ${isConnected ? 'border-lime-400/20' : 'border-red-500/20'} shadow-lg`}>
             <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-lime-400 animate-pulse' : 'bg-red-500'}`}></span>
             <span className={`${isConnected ? 'text-lime-400' : 'text-red-500'} text-[10px] font-black uppercase tracking-widest`}>
               {isConnected ? 'LIVE COACHING ACTIVE' : 'CONNECTING...'}
             </span>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 lg:flex-row lg:gap-12">
        {/* Camera Container */}
        <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800 shadow-2xl">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* HUD Visual Overlay */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-zinc-950/20">
             <div className="absolute top-8 left-8 flex flex-col gap-1 opacity-40">
                <div className="w-16 h-[1px] bg-white"></div>
                <div className="w-[1px] h-16 bg-white"></div>
             </div>
             <div className="absolute bottom-8 right-8 flex flex-col items-end gap-1 opacity-40">
                <div className="w-[1px] h-16 bg-white"></div>
                <div className="w-16 h-[1px] bg-white"></div>
             </div>
          </div>

          {/* Real-time Feedback Bubble */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className={`bg-zinc-950/90 backdrop-blur-2xl border border-zinc-700/50 p-6 rounded-[32px] shadow-2xl transition-all duration-500 transform ${isSpeaking ? 'scale-105 border-lime-400/60 -translate-y-2' : 'scale-100'}`}>
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <div className={`w-4 h-4 rounded-full ${isSpeaking ? 'bg-lime-400 animate-ping' : 'bg-zinc-700'}`}></div>
                </div>
                <div className="flex-1">
                  <p className={`text-white font-black italic uppercase tracking-tight leading-tight transition-all duration-300 ${isSpeaking ? 'text-xl text-lime-400' : 'text-base'}`}>
                    {feedback}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Column */}
        <div className="text-center lg:text-left max-w-sm space-y-6">
          <div className="space-y-2">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">Coach Nitesh AI</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
              Powered by Gemini 2.5 Live
            </p>
          </div>
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-lime-400"></div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Continuous Posture Monitoring</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-lime-400"></div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Biomechanical Safety Analysis</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-lime-400"></div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Real-time Audio Correction</span>
             </div>
          </div>
          <p className="text-zinc-600 text-[9px] italic font-medium">
            Standing by to analyze your reps. Ensure full body is visible in frame.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostureMonitor;
