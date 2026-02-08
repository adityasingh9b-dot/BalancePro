import React, { useRef, useEffect, useState } from 'react';
// FIX: Using the correct Web-compatible SDK
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. GLOBAL API INIT
const API_KEY = "AIzaSyDBAMQVeCbWgaQxzggJyYTlU2kUebIHjDc"; 
// FIX: Initializing the Web SDK correctly
const genAI = new GoogleGenerativeAI(API_KEY);

interface PostureMonitorProps {
  onBack: () => void;
}

// --- HELPERS (Unchanged) ---
function decodeBase64(base64: string) {
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
  
  const [feedback, setFeedback] = useState("Align your body in the frame...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // 1. SETUP CAMERA & AUDIO
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
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
      } catch (err) {
        console.error("Camera access denied", err);
        setFeedback("Camera permission denied. Please allow access.");
      }
    }
    setupCamera();
    
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 2. TTS FUNCTION
  const playCoachingVoice = async (text: string) => {
    if (isMuted || !audioContextRef.current || isSpeaking) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    try {
      setIsSpeaking(true);
      // NOTE: Using gemini-1.5-flash for everything to ensure browser compatibility
      // If you specifically need 2.0-flash-exp, ensure your API key has access to it.
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      
      const result = await model.generateContent({
        contents: [{ parts: [{ text: `Speak as an energetic gym coach. Say exactly this: "${text}"` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      // Handle the response structure safely
      const base64Audio = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
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

  // 3. VISION ANALYSIS FUNCTION
  const analyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || isSpeaking) return;
    if (videoRef.current.readyState !== 4) return; 
    
    setIsAnalyzing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 400, 300);
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent({
        contents: [{
          parts: [
            { text: "You are a fitness coach. Look at this person. Give a 1-sentence correction about their form or a compliment. Keep it short (max 10 words). Direct address." },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }]
      });
      
      let newFeedback = "Keep moving!";
      if (typeof result.response.text === 'function') {
         newFeedback = result.response.text();
      } else {
         newFeedback = "Great work!";
      }
      
      setFeedback(newFeedback);
      await playCoachingVoice(newFeedback);
      
    } catch (err) {
      console.error("Analysis Error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(analyzeFrame, 12000); 
    return () => clearInterval(interval);
  }, [isSpeaking, isMuted]);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-6 overflow-hidden">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="text-[10px] uppercase font-black tracking-widest">Exit AI Vision</span>
        </button>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsMuted(!isMuted)} 
             className={`p-2 rounded-xl border transition-all ${isMuted ? 'border-red-500/30 text-red-500' : 'border-zinc-800 text-zinc-400'}`}
           >
             {isMuted ? (
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
             ) : (
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
             )}
           </button>
           <span className="bg-lime-400/10 text-lime-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-lime-400/20">
            Vision AI Active
          </span>
        </div>
      </div>

      {/* MAIN VIEW */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <canvas ref={canvasRef} width="400" height="300" className="hidden" />
          
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-1 bg-lime-400/30 blur-sm animate-scan"></div>
            <div className="absolute inset-0 border-[20px] border-zinc-950/20"></div>
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <div className={`bg-zinc-950/80 backdrop-blur-2xl border border-zinc-700/50 p-6 rounded-[32px] shadow-2xl transition-all duration-500 ${isSpeaking ? 'scale-105 border-lime-400/50' : 'scale-100'}`}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full ${isAnalyzing ? 'bg-amber-500 animate-pulse' : 'bg-lime-400'}`}></div>
                  {isSpeaking && <div className="absolute inset-[-4px] border border-lime-400 rounded-full animate-ping"></div>}
                </div>
                <div className="flex-1">
                  <p className={`text-white font-black italic uppercase tracking-tight leading-tight transition-all duration-300 ${isSpeaking ? 'text-lg text-lime-400' : 'text-base'}`}>
                    {feedback}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center max-w-sm space-y-3">
          <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Coach Nitesh AI</h3>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
            Scanning form... <span className="text-lime-400">Audio feedback enabled.</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scan { 0% { transform: translateY(0); } 100% { transform: translateY(400px); } }
        .animate-scan { animation: scan 3s linear infinite; }
      `}</style>
    </div>
  );
};

export default PostureMonitor;
