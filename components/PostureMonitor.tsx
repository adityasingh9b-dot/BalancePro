import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface PostureMonitorProps {
  onBack: () => void;
}

// Global variable to survive React's Strict Mode / Re-mounts
let globalLastRequestTime = 0;

// --- UTILS ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const genAIInstanceRef = useRef<GoogleGenerativeAI | null>(null);
  const analyzeRef = useRef<() => void>(undefined);

  if (!genAIInstanceRef.current) {
    const KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (KEY) {
      genAIInstanceRef.current = new GoogleGenerativeAI(KEY);
      console.log("✅ Coach Nitesh Brain Ready!");
    }
  }

  const [feedback, setFeedback] = useState("Coach is watching...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 640, height: 480 } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
      } catch (err) {
        setFeedback("Camera enable karo bhai!");
      }
    }
    setupCamera();
    return () => { audioContextRef.current?.close(); };
  }, []);

  const playCoachingVoice = useCallback(async (text: string) => {
    const aiInstance = genAIInstanceRef.current;
    if (isMuted || !audioContextRef.current || !aiInstance) return;
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    try {
      setIsSpeaking(true);
      const model = aiInstance.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1beta" });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Speak as Coach Nitesh (hardcore Indian gym coach) in Hinglish: ${text}` }] }],
        generationConfig: {
          //@ts-ignore
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = result.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      if (base64Audio && audioContextRef.current) {
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (err) {
      setIsSpeaking(false);
    }
  }, [isMuted]);

  const analyzeFrame = useCallback(async () => {
    const now = Date.now();
    if (now - globalLastRequestTime < 20000) return;

    const currentAI = genAIInstanceRef.current;
    if (!videoRef.current || !canvasRef.current || isAnalyzing || isSpeaking || !currentAI) return;

    setIsAnalyzing(true);
    globalLastRequestTime = now;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx || !videoRef.current) return;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      
      const model = currentAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1beta" });
      const result = await model.generateContent([
        { text: "Act as Coach Nitesh (hardcore Indian gym trainer). Analyze form in image. Give 1 aggressive correction in Hinglish (max 10 words). Focus on back, shoulders or depth." },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
      ]);
      
      const responseText = result.response.text();
      if (responseText) {
        setFeedback(responseText);
        await playCoachingVoice(responseText);
      }
    } catch (err: any) {
      if (err.message?.includes("429")) setFeedback("Coach thoda rest kar raha hai...");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isSpeaking, playCoachingVoice]);

  useEffect(() => {
    analyzeRef.current = analyzeFrame;
  }, [analyzeFrame]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (analyzeRef.current) analyzeRef.current();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col p-4 font-sans text-white">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="text-zinc-500 font-bold text-xs uppercase hover:text-white">
          ← Exit Session
        </button>
        <div className="flex gap-2 items-center">
          <button onClick={() => setIsMuted(!isMuted)} className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
            {isMuted ? "🔇" : "🔊"}
          </button>
          <span className="bg-lime-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase">
            Coach Nitesh Live
          </span>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <div className="w-full max-w-xl aspect-video bg-zinc-900 rounded-[32px] overflow-hidden border-2 border-zinc-800 relative">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <canvas ref={canvasRef} className="hidden" width="640" height="480" />
          
          <div className="absolute bottom-6 left-6 right-6">
             <div className={`p-5 rounded-3xl backdrop-blur-xl bg-black/70 border-2 transition-all duration-300 ${isSpeaking ? 'border-lime-500 scale-105' : 'border-zinc-700'}`}>
                <p className="text-white text-center text-lg font-black italic uppercase tracking-tight">
                  {isAnalyzing && !isSpeaking ? "Analyzing..." : feedback}
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostureMonitor;
