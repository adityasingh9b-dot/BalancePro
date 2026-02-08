import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";

// Vite-friendly initialization
const ai = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || "YOUR_FALLBACK_KEY");

interface PostureMonitorProps {
  onBack: () => void;
}

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
  
  const [feedback, setFeedback] = useState("Align your body in the frame...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Fixed missing state
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
      } catch (err) {
        console.error("Camera access denied.", err);
      }
    }
    setupCamera();
    return () => { audioContextRef.current?.close(); };
  }, []);

  const playCoachingVoice = async (text: string) => {
    if (isMuted || !audioContextRef.current) return;
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    try {
      setIsSpeaking(true);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Speak as Coach Nitesh (hardcore Indian gym coach) in Hinglish: ${text}` }] }],
        generationConfig: {
          //@ts-ignore
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = response.response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      
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
      console.error("TTS Error:", err);
      setIsSpeaking(false);
    }
  };

  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || isSpeaking) return;
    
    setIsAnalyzing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 400, 300);
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];

    try {
      const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
      const response = await model.generateContent([
        { text: "Act as Coach Nitesh. Analyze the user's gym form in the image. Give a 1-sentence correction or motivation in Hinglish. Max 12 words." },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
      ]);
      
      const newFeedback = response.response.text();
      setFeedback(newFeedback);
      await playCoachingVoice(newFeedback);
    } catch (err) {
      console.error("Analysis Error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isSpeaking]);

  useEffect(() => {
    const interval = setInterval(analyzeFrame, 8000); 
    return () => clearInterval(interval);
  }, [analyzeFrame]);

  // UI remains identical to your design...
  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-6 overflow-hidden">
        {/* Your existing JSX here */}
        {/* ... (Keep the beautiful UI you built) ... */}
    </div>
  );
};
