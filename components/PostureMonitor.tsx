import React, { useRef, useEffect, useState } from 'react';
// Official Web SDK
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. GLOBAL INIT
const API_KEY = "AIzaSyDBAMQVeCbWgaQxzggJyYTlU2kUebIHjDc"; 
const genAI = new GoogleGenerativeAI(API_KEY);

interface PostureMonitorProps {
  onBack: () => void;
}

// --- HELPERS (Same as Old Code) ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

  // setup camera and audio
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
        console.error("Camera access denied", err);
      }
    }
    setupCamera();
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    };
  }, []);

  // 2. TTS FUNCTION (Fixed Model Name)
  const playCoachingVoice = async (text: string) => {
    if (isMuted || !audioContextRef.current || isSpeaking) return;
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    try {
      setIsSpeaking(true);
      // Fixed: 'gemini-2.0-flash' is the correct TTS model for v1beta
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const result = await model.generateContent({
        contents: [{ parts: [{ text: `Speak as an energetic gym coach: "${text}"` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContextRef.current, 24000, 1);
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

  // 3. VISION ANALYSIS (Fixed 404 issue)
  const analyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || isSpeaking) return;
    if (videoRef.current.readyState !== 4) return;
    
    setIsAnalyzing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 400, 300);
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
      // FIX: Using 'gemini-1.5-flash-latest' ensures it works on v1beta endpoint
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      
      const result = await model.generateContent({
        contents: [{
          parts: [
            { text: "Act as a fitness coach. Analyze the user's posture. Give a 1-sentence correction or compliment (max 12 words)." },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }]
      });

      // Handling response safely like your old code
      const responseText = result.response.text();
      const finalFeedback = responseText || "Looking good, keep it up!";
      
      setFeedback(finalFeedback);
      await playCoachingVoice(finalFeedback);
      
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
        {/* Header and UI (Same as before) */}
        <div className="flex justify-between items-center mb-6">
            <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase">Exit AI Vision</span>
            </button>
            <div className="flex items-center gap-4">
                <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-xl border ${isMuted ? 'text-red-500' : 'text-zinc-400'}`}>
                    {isMuted ? 'Muted' : 'Sound On'}
                </button>
                <span className="bg-lime-400/10 text-lime-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase">Vision AI Active</span>
            </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" width="400" height="300" />
                
                <div className="absolute bottom-6 left-6 right-6">
                    <div className={`bg-zinc-950/80 backdrop-blur-2xl p-6 rounded-[32px] border transition-all ${isSpeaking ? 'border-lime-400/50 scale-105' : 'border-zinc-700/50'}`}>
                        <p className="text-white font-black italic uppercase text-center">{feedback}</p>
                    </div>
                </div>
            </div>
            <h3 className="text-2xl font-black italic uppercase text-white">Coach Nitesh AI</h3>
        </div>
    </div>
  );
};

export default PostureMonitor;
