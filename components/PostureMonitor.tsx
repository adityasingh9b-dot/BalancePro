import React, { useRef, useEffect, useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

interface PostureMonitorProps {
  onBack: () => void;
}

// Helper for Base64 decoding
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper for PCM Audio Decoding
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const [feedback, setFeedback] = useState("Coach Nitesh is watching... Beta, position le lo!");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
      } catch (err) {
        console.error("Camera access denied", err);
        setFeedback("Camera setup failed. Allow permissions!");
      }
    }
    setupCamera();
    
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playCoachingVoice = async (text: string) => {
    if (isMuted || !audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      setIsSpeaking(true);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak this as a high-energy Indian gym coach: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, 
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(
          decodeBase64(base64Audio),
          audioContextRef.current,
          24000,
          1,
        );
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error("TTS Error:", err);
      setIsSpeaking(false);
    }
  };

  const analyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || isSpeaking) return;
    
    setIsAnalyzing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Capture frame with decent quality for Pro model reasoning
    ctx.drawImage(videoRef.current, 0, 0, 400, 300);
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Upgraded to Pro for complex spatial reasoning
        contents: {
          parts: [
            { text: "Coach, form check karo! Analyze my movement. Be specific about joint alignment and back posture. Give me 1 quick correction or shoutout in Hinglish (mix of Hindi and English). Keep it short and high energy!" },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        },
        config: {
          systemInstruction: "You are Coach Nitesh, a hardcore but motivating gym trainer from India. You are watching the client live. Your goal is to ensure perfect form. Use 'Hinglish' (English with common Hindi filler words like 'Beta', 'Shabash', 'Ruko'). Be authoritative and direct. Focus on safety (e.g., 'Back straight rakho!', 'Knees lock mat karo'). Max 15 words.",
          temperature: 0.8
        }
      });
      
      const newFeedback = response.text?.trim() || "Josh kam nahi hona chahiye, keep moving!";
      setFeedback(newFeedback);
      await playCoachingVoice(newFeedback);
    } catch (err) {
      console.error("Analysis Error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(analyzeFrame, 9000); // 9 second loop to balance quota and feedback
    return () => clearInterval(interval);
  }, [isSpeaking, isMuted]);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="text-[10px] uppercase font-black tracking-widest">Back to Studio</span>
        </button>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsMuted(!isMuted)} 
             className={`p-3 rounded-2xl border transition-all ${isMuted ? 'border-red-500/30 text-red-500 bg-red-500/5' : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
           >
             {isMuted ? (
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
             ) : (
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
             )}
           </button>
           <div className="flex items-center gap-2 bg-lime-400/10 px-4 py-2 rounded-full border border-lime-400/20 shadow-lg">
             <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-amber-500 animate-pulse' : 'bg-lime-400'}`}></span>
             <span className="text-lime-400 text-[10px] font-black uppercase tracking-widest">
               {isAnalyzing ? 'Coach is Thinking' : 'Coach is Watching'}
             </span>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 lg:flex-row lg:gap-12">
        <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800 shadow-2xl">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <canvas ref={canvasRef} width="400" height="300" className="hidden" />
          
          <div className="absolute inset-0 pointer-events-none border-[12px] border-zinc-950/20">
            <div className={`absolute top-0 left-0 w-full h-1 bg-lime-400/30 blur-sm transition-opacity duration-500 ${isAnalyzing ? 'opacity-100 animate-scan' : 'opacity-0'}`}></div>
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <div className={`bg-zinc-950/90 backdrop-blur-2xl border border-zinc-700/50 p-6 rounded-[32px] shadow-2xl transition-all duration-500 transform ${isSpeaking ? 'scale-105 border-lime-400/60 -translate-y-2' : 'scale-100'}`}>
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <div className={`w-4 h-4 rounded-full ${isAnalyzing ? 'bg-amber-500 animate-pulse' : 'bg-lime-400'}`}></div>
                  {isSpeaking && <div className="absolute inset-[-6px] border-2 border-lime-400 rounded-full animate-ping"></div>}
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

        <div className="text-center lg:text-left max-w-sm space-y-6">
          <div className="space-y-2">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">Vision Pro AI</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
              Coach Nitesh Virtual Training Engine
            </p>
          </div>
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
             <div className="flex items-center gap-3">
                <span className="text-lime-400 text-lg font-black italic tracking-tighter">01</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Skeletal Form Analysis</span>
             </div>
             <div className="flex items-center gap-3">
                <span className="text-lime-400 text-lg font-black italic tracking-tighter">02</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Live Rep Correction</span>
             </div>
             <div className="flex items-center gap-3">
                <span className="text-lime-400 text-lg font-black italic tracking-tighter">03</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Safety Compliance Check</span>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan { 
          0% { transform: translateY(0); opacity: 0.3; } 
          50% { opacity: 1; }
          100% { transform: translateY(450px); opacity: 0.3; } 
        }
        .animate-scan { animation: scan 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default PostureMonitor;
