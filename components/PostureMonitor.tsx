import React, { useRef, useEffect, useState } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. INIT GEMINI
const API_KEY = "YOUR_API_KEY_HERE"; // Bhai apni key yahan daal dena
const genAI = new GoogleGenerativeAI(API_KEY);

interface PostureMonitorProps {
  onBack: () => void;
}

// --- AUDIO HELPERS ---
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
  
  const [feedback, setFeedback] = useState("Stand in front of the camera...");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenRef = useRef<number>(0);

  // 2. COACH NITESH VOICE (Gemini TTS)
  const coachNiteshTalks = async (instruction: string) => {
    const now = Date.now();
    if (isMuted || isSpeaking || now - lastSpokenRef.current < 7000) return;

    try {
      setIsSpeaking(true);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: [{ parts: [{ text: `Act as Coach Nitesh, a tough gym trainer. Give a very short, aggressive motivational correction for: ${instruction}. Max 10 words.` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          setIsSpeaking(false);
          lastSpokenRef.current = Date.now();
        };
        source.start();
      }
    } catch (err) {
      console.error("Coach Voice Error:", err);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvasCtx = canvasRef.current.getContext('2d')!;
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#BEF264', lineWidth: 4 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FFFFFF', lineWidth: 2, radius: 3 });

        const shoulder = results.poseLandmarks[11];
        const hip = results.poseLandmarks[23];

        if (shoulder && hip) {
          const alignment = Math.abs(shoulder.x - hip.x);
          if (alignment > 0.15) {
            setFeedback("Fix your posture! Coach is watching.");
            coachNiteshTalks("User is slouching, tell them to straighten their back now.");
          } else {
            setFeedback("Looking good, Champ!");
          }
        }
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => { await pose.send({ image: videoRef.current! }); },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      pose.close();
    };
  }, [isMuted]);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-400 font-black uppercase text-[10px]">← Exit</button>
        <div className="flex gap-4">
            <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 text-xs uppercase font-bold">
            {isMuted ? '🔇 Muted' : '🔊 Audio On'}
            </button>
            <span className="text-lime-400 text-xs font-bold animate-pulse">● LIVE TRACKING</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-full max-w-2xl aspect-video rounded-[40px] overflow-hidden border-4 border-zinc-800 shadow-2xl">
          <video ref={videoRef} className="hidden" />
          <canvas ref={canvasRef} className="w-full h-full object-cover scale-x-[-1]" width="640" height="480" />
          
          <div className="absolute bottom-6 left-6 right-6">
             <div className={`bg-zinc-950/90 backdrop-blur-xl p-6 rounded-[32px] border-2 transition-all duration-500 ${isSpeaking ? 'border-lime-400 scale-105' : 'border-zinc-800'}`}>
                <p className="text-lime-400 font-black italic uppercase text-center text-xl tracking-tight">
                  {feedback}
                </p>
             </div>
          </div>
        </div>
        <h2 className="mt-6 text-white font-black italic uppercase tracking-tighter text-3xl">Coach Nitesh <span className="text-lime-400">Vision</span></h2>
      </div>
    </div>
  );
};

export default PostureMonitor;
