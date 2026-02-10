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
  
  // Call Controls
  const isCallActive = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  
  // Silence Detection Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [`> ${msg}`, ...prev.slice(0, 15)]);
  };

  useEffect(() => {
    VoiceRecorder.requestAudioRecordingPermission();
    return () => endCall();
  }, []);

  const endCall = () => {
    isCallActive.current = false;
    stopRecordingAndCleanup();
    TextToSpeech.stop().catch(() => {});
  };

  const stopRecordingAndCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsMicOn(false);
  };

  // --- SILENCE DETECTION LOGIC ---
  const monitorVolume = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (!isCallActive.current || isSpeaking) return;

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      let average = sum / bufferLength;

      // Agar volume bohot kam hai (Silence)
      if (average < 10) { 
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            if (isCallActive.current && !isSpeaking) {
              addLog("Silence detected, processing...");
              mediaRecorderRef.current?.stop(); // Trigger processing
            }
          }, 1500); // 1.5 seconds of silence
        }
      } else {
        // User bol raha hai, timer reset karo
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      if (isCallActive.current) requestAnimationFrame(checkVolume);
    };

    checkVolume();
  };

  // --- RECORDING LOOP ---
  const startRecordingTurn = async () => {
    if (!isCallActive.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        
        if (blob.size > 2000 && isCallActive.current) { // Process only if enough data
          processAudioBlob(blob, mimeType);
        } else if (isCallActive.current && !isSpeaking) {
          startRecordingTurn(); // Restart if it was just noise/too short
        }
      };

      recorder.start();
      setIsMicOn(true);
      setFeedback("Listening...");
      monitorVolume(stream);
    } catch (err: any) {
      addLog(`Mic Error: ${err.message}`);
      isCallActive.current = false;
    }
  };

  const toggleCall = () => {
    if (isCallActive.current) {
      addLog("Call Ended");
      endCall();
    } else {
      addLog("Call Started");
      isCallActive.current = true;
      setFeedback("Connecting to Coach...");
      startRecordingTurn();
    }
  };

  // --- AI PIPELINE ---
  const processAudioBlob = async (audioBlob: Blob, mimeType: string) => {
    if (!isCallActive.current) return;
    setIsProcessing(true);
    setFeedback("Thinking...");
    
    try {
      const formData = new FormData();
      formData.append("file", new File([audioBlob], "audio.webm", { type: mimeType }));
      formData.append("model", "whisper-large-v3-turbo");

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
        setIsProcessing(false);
        startRecordingTurn();
      }
    } catch (err) {
      setIsProcessing(false);
      startRecordingTurn();
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
            { 
              role: "system", 
              content: `You are the Personal AI Assistant of Nitesh Tyagi, the best fitness trainer in Lucknow and founder of BalancePro (https://www.balancepro.in/), mobile number of trainer is 7355519301. 
              Rules:
              1. Language: Strictly use Hinglish language only.
              2. Tone: Very respectful, professional, yet high energy.
              3. Context: Answer all fitness, posture, and health queries based on Nitesh Tyagi's expertise, as questioned by the clients.
              4. Length: Keep responses short and crisp (10-15 words).
              5. Ending: Always end with a follow-up like 'Aur kya help kar sakta hoon?' or 'Aapko kuch aur jaan-na hai?'.` 
            },
            { role: "user", content: userText }
          ]
        })
      });

      const data = await res.json();
      
      if (data.choices && data.choices[0]?.message?.content) {
        const reply = data.choices[0].message.content;
        speakResponse(reply);
      } else {
        // Agar API se response na aaye toh restart loop
        setIsProcessing(false);
        if (isCallActive.current) startRecordingTurn();
      }
    } catch (err) {
      addLog("Groq API Error");
      setIsProcessing(false);
      // Fail hone par bhi call disconnect nahi hogi, dubara sunna shuru karega
      if (isCallActive.current) startRecordingTurn();
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setFeedback(text);
      setIsProcessing(false);
      setIsSpeaking(true);

      await TextToSpeech.speak({
        text: text,
        lang: 'hi-IN', 
        rate: 1.1,
      });

      setIsSpeaking(false);
      // ✨ AI bol chuka hai, ab wapas suno
      if (isCallActive.current) {
        setTimeout(() => startRecordingTurn(), 300);
      }
    } catch (e) {
      setIsSpeaking(false);
      startRecordingTurn();
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Logs View */}
      <div className="absolute top-0 left-0 w-full h-24 bg-black/80 text-green-400 text-[9px] p-2 overflow-y-auto z-50 font-mono border-b border-green-900 pointer-events-none">
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>

      <div className="w-full p-6 flex items-center justify-between z-40 pt-28">
        <button onClick={onBack} className="flex items-center gap-3 active:opacity-50 text-zinc-500">
           ← Exit Call
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 pb-12">
        {/* Avatar Visualizer */}
        <div className={`w-64 h-64 rounded-full flex items-center justify-center relative transition-all duration-700 ${isMicOn ? 'bg-green-500/10 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.2)]' : 'border-zinc-800 bg-zinc-900'} border-2`}>
          {isMicOn && <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping opacity-20"></div>}
          <div className="flex flex-col items-center text-center p-4">
              <img 
                src="/assets/logo.jpeg" 
                alt="Coach" 
                className={`w-36 h-36 rounded-3xl object-cover shadow-2xl transition-all duration-300 ${isSpeaking ? 'scale-110 rotate-2 border-2 border-lime-400' : 'scale-100 opacity-80'}`} 
              />
              <span className={`mt-4 text-[10px] font-black tracking-[0.3em] uppercase ${isMicOn ? 'text-green-400' : 'text-zinc-500'}`}>
                {isMicOn ? '• Call Active •' : 'Call Disconnected'}
              </span>
          </div>
        </div>

        {/* Dynamic Text Output */}
        <div className="w-full max-w-xs text-center min-h-[80px] px-4 flex items-center justify-center">
          <p className={`text-xl font-semibold leading-tight ${isSpeaking ? 'text-white' : 'text-zinc-500'}`}>
            {isProcessing ? "Coach Nitesh is thinking..." : feedback}
          </p>
        </div>

        {/* Call Toggle Button */}
        <button
          onClick={toggleCall}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 ${isCallActive.current ? 'bg-red-600 rotate-135' : 'bg-green-600'}`}
        >
          {isCallActive.current ? (
            <span className="text-white font-bold text-xs">END</span>
          ) : (
            <span className="text-white font-bold text-xs">CALL</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default PostureMonitor;
