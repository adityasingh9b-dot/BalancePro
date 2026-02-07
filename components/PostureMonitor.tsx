import React, { useRef, useEffect, useState } from 'react';
import { GoogleGenAI } from "@google/genai";

interface PostureMonitorProps {
  onBack: () => void;
}



const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [feedback, setFeedback] = useState("Align your body in the frame...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
 const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false); // Ye line add karo



  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    setupCamera();

  }, []);


// 1. Voice Feature (Simple & Reliable)
  const speak = (text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };


const analyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || isSpeaking) return;
    
    const key = "AIzaSyClOCKVjhXSaqNiw4bTRZjnRYdSK5njxHs";
    setIsAnalyzing(true);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // IMPORTANT: Canvas internal size matches the drawing size
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];

    try {
      // analyzeFrame ke andar ye line update karo:
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "You are Coach Nitesh, a hardcore Indian gym trainer. Look at this frame. Identify the person's exercise. If their back is rounded, shoulders are drooping, or form is loose, SHOUT a specific correction in Hinglish (e.g., 'Back seedhi kar!', 'Chest up buddy!'). If form is perfect, say 'Shaandaar, lage raho!'. Be extremely specific about their joints. Max 15 words." },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }],
          // Safety settings ko thoda loose rakha taaki 'strict' tone block na ho
          safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }]
        })
      });

      const data = await response.json();
      console.log("Coach Nitesh Brain:", data); 

      const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (aiReply) {
        setFeedback(aiReply);
        speak(aiReply);
      }
    } catch (err) {
      console.error("Coach Brain Fade:", err);
    } finally {
      setIsAnalyzing(false);
    }
};
const startVoiceChat = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Mic not supported");

    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = async (event: any) => {
      const msg = event.results[0][0].transcript;
      const key = "AIzaSyClOCKVjhXSaqNiw4bTRZjnRYdSK5njxHs";
      setFeedback(`You: ${msg}`);
      
      try {
        // Is URL ko try karo
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ parts: [{ text: `User says: ${msg}. Reply as Coach Nitesh in 1 short sentence.` }] }]
    })
});
        const data = await response.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Bhai, awaaz saaf nahi aayi, phir se bol!";
        setFeedback(reply);
        speak(reply);
      } catch (e) { console.error("Mic Fetch Error:", e); }
    };
    recognition.start();
};
  useEffect(() => {
  const interval = setInterval(analyzeFrame, 13000);
  return () => clearInterval(interval);
}, [isSpeaking, isMuted]);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
        
        
        
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="text-[10px] uppercase font-black tracking-widest">Exit AI Vision</span>
        </button>
        <div className="flex items-center gap-4">
  {/* Ye Mic button add karo */}
  <button 
    onClick={startVoiceChat} 
    className={`p-2 rounded-xl border transition-all ${isListening ? 'bg-red-500' : 'border-zinc-800'}`}
  >
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"/></svg>
  </button>
  
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
           <span className="bg-lime-400/10 text-lime-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-lime-400/20 shadow-lg shadow-lime-400/5">
            Vision AI Active
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          
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
