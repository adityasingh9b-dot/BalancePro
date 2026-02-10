import React, { useState, useEffect, useRef } from 'react';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

interface PostureMonitorProps {
  onBack: () => void;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [feedback, setFeedback] = useState("Coach Nitesh ready hai...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Naya Ref: Ye track karega ki "Continuous Mode" on hai ya nahi
  const isSessionActive = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [`> ${msg}`, ...prev.slice(0, 15)]);
  };

  useEffect(() => {
    addLog("System Ready: Continuous Mode Enabled");
    VoiceRecorder.requestAudioRecordingPermission();

    return () => {
      isSessionActive.current = false;
      stopNativeRecording();
      TextToSpeech.stop().catch(() => {}); 
    };
  }, []);

  const handleExit = () => {
    isSessionActive.current = false;
    TextToSpeech.stop().catch(() => {});
    stopNativeRecording();
    onBack();
  };

  // --- RECORDING LOGIC ---
  const startNativeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        processAudioBlob(blob, mimeType);
        stream.getTracks().forEach(t => t.stop());
      };

      // Timer based stop: 4 seconds tak chup rahoge toh automatic process hoga
      // Ya fir manually stop click karne par
      recorder.start();
      setIsMicOn(true);
      setFeedback("Sun raha hoon...");
      addLog("Mic Live...");

      // Optional: Auto-stop recording after 5 seconds of silence (advanced)
      // Abhi ke liye manually ya complete turn par focus karte hain.
    } catch (err: any) {
      addLog(`Mic Error: ${err.message}`);
      isSessionActive.current = false;
    }
  };

  const stopNativeRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      setIsMicOn(false);
    }
  };

  const toggleMic = () => {
    if (isMicOn) {
      isSessionActive.current = false; // Manually turned off
      stopNativeRecording();
      TextToSpeech.stop().catch(() => {});
      setFeedback("Coach paused.");
    } else {
      isSessionActive.current = true; // Session started
      startNativeRecording();
    }
  };

  // --- AI PIPELINE ---
  const processAudioBlob = async (audioBlob: Blob, mimeType: string) => {
    // Agar session manually band kar diya toh process mat karo
    if (!isSessionActive.current && !isMicOn) return;

    setIsProcessing(true);
    setFeedback("Processing...");
    
    try {
      const formData = new FormData();
      formData.append("file", new File([audioBlob], "audio.webm", { type: mimeType }));
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "hi");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_KEY.trim()}` },
        body: formData
      });

      const data = await res.json();
      if (data.text?.trim()) {
        addLog(`You: ${data.text}`);
        handleGroqChat(data.text);
      } else {
        // Agar kuch nahi suna aur session active hai, toh dubara listen karo
        setIsProcessing(false);
        if (isSessionActive.current) {
          addLog("Silence detected, re-listening...");
          startNativeRecording();
        }
      }
    } catch (err) {
      addLog("Transcription Failed");
      setIsProcessing(false);
      isSessionActive.current = false;
    }
  };

  const handleGroqChat = async (userText: string) => {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are Coach Nitesh. Reply in Hinglish. Keep it very short (max 12 words). Motivate for fitness." },
            { role: "user", content: userText }
          ]
        })
      });

      const data = await res.json();
      const reply = data.choices[0]?.message?.content;
      speakResponse(reply);
    } catch (err) {
      addLog("Chat API Error");
      setIsProcessing(false);
    }
  };

  // --- NATIVE SPEECH + AUTO RESTART ---
  const speakResponse = async (text: string) => {
    try {
      setFeedback(text);
      setIsProcessing(false);
      setIsSpeaking(true);

      await TextToSpeech.speak({
        text: text,
        lang: 'hi-IN', 
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });

      setIsSpeaking(false);
      
      // ✨ MAGIC PART: Bolne ke baad agar session active hai toh Mic wapas on karo
      if (isSessionActive.current) {
        addLog("Restarting Mic...");
        setTimeout(() => {
          if (isSessionActive.current) startNativeRecording();
        }, 300); // Chota sa gap natural feel ke liye
      }

    } catch (e) {
      addLog("TTS Error");
      setIsSpeaking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Logs */}
      <div className="absolute top-0 left-0 w-full h-24 bg-black/80 text-green-400 text-[9px] p-2 overflow-y-auto z-50 font-mono border-b border-green-900 pointer-events-none">
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>

      <div className="w-full p-6 flex items-center justify-between z-40 pt-28">
        <button onClick={handleExit} className="flex items-center gap-3 active:opacity-50">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">←</div>
          <span className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase">Go Back</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 pb-12">
        <div className={`w-60 h-60 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-red-500/10 border-red-500' : 'border-zinc-800 bg-zinc-900'} border-2`}>
          {isMicOn && <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>}
          <div className="flex flex-col items-center text-center p-4">
              <img 
                src="/assets/logo.jpeg" 
                alt="Coach" 
                className={`w-32 h-32 rounded-2xl object-cover shadow-2xl mb-4 transition-all duration-300 ${isSpeaking ? 'scale-110 shadow-[0_0_25px_rgba(163,230,53,0.4)] border-2 border-lime-400' : 'scale-100 opacity-80'}`} 
              />
              <span className="text-[10px] font-black tracking-[0.3em] text-lime-500 uppercase">
                {isMicOn ? 'Listening...' : 'Coach Nitesh'}
              </span>
          </div>
        </div>

        <div className="w-full max-w-xs text-center min-h-[60px] px-4">
          <p className={`text-lg font-medium leading-relaxed ${isSpeaking ? 'text-white' : 'text-zinc-500'}`}>
            {isProcessing ? "Coach is thinking..." : feedback}
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 mb-[-20px]">
           <div className={`w-2 h-2 rounded-full ${isSessionActive.current ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`}></div>
           <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
             {isSessionActive.current ? 'Auto-Mode On' : 'Tap to Start'}
           </span>
        </div>

        <button
          onClick={toggleMic}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95 ${isMicOn ? 'bg-red-600 shadow-red-900/50' : 'bg-white text-black'}`}
        >
          <div className={`w-3 h-3 mb-1 ${isMicOn ? 'bg-white' : 'bg-red-600'} rounded-sm ${isMicOn ? 'animate-pulse' : ''}`}></div>
          <span className="font-bold text-[10px] uppercase">{isMicOn ? 'STOP' : 'START'}</span>
        </button>
      </div>
    </div>
  );
};

export default PostureMonitor;
