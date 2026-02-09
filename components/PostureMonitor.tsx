import React, { useRef, useState, useEffect } from 'react';

interface PostureMonitorProps {
  onBack: () => void;
}

// 1. Browser Capability Check
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [feedback, setFeedback] = useState("Tap button & speak...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // --- 2. SETUP SPEECH RECOGNITION (Run once) ---
  useEffect(() => {
    if (!SpeechRecognition) {
      setFeedback("Browser not supported. Use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one sentence
    recognition.interimResults = false;
    recognition.lang = 'hi-IN'; // Hinglish support

    recognition.onstart = () => {
      console.log("🎤 Mic Started");
      setIsMicOn(true);
      setFeedback("Listening... Bol bhai!");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("✅ Captured Audio:", transcript);
      handleGroqChat(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("❌ Mic Error:", event.error);
      setIsMicOn(false);
      if (event.error === 'not-allowed') {
        setFeedback("Mic permission denied!");
      } else {
        setFeedback("Did not hear you. Try again.");
      }
    };

    recognition.onend = () => {
      console.log("Mic Stopped");
      setIsMicOn(false);
    };

    recognitionRef.current = recognition;
  }, []);

  // --- 3. CONTROL MIC ---
  const toggleMic = () => {
    if (isProcessing || isSpeaking) return; // Prevent interruption

    if (isMicOn) {
      recognitionRef.current?.stop();
    } else {
      window.speechSynthesis.cancel(); // Stop AI voice if active
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error("Mic start error:", err);
      }
    }
  };

  // --- 4. GROQ AI LOGIC ---
  const handleGroqChat = async (userText: string) => {
    setIsProcessing(true);
    setFeedback("Coach thinking...");

    // Debug: Check API Key
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      console.error("🚨 API KEY MISSING: Check .env file");
      setFeedback("API Key missing! Check console.");
      setIsProcessing(false);
      return;
    }

    try {
      console.log("🚀 Sending to Groq:", userText);
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are Coach Nitesh, a hardcore Indian gym trainer. Speak in short, punchy Hinglish. Be rude but motivating. Max 15 words."
            },
            { role: "user", content: userText }
          ]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      console.log("🤖 Groq Replied:", data);
      const coachReply = data.choices[0].message.content;
      speakResponse(coachReply);

    } catch (err: any) {
      console.error("Fetch Error:", err);
      setFeedback("Network Error or Quota Full");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 5. BROWSER VOICE OUTPUT ---
  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 1.1; 
    utterance.pitch = 0.9;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setFeedback(text);
    };
    utterance.onend = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <button onClick={onBack} className="absolute top-10 left-6 text-zinc-600 font-black text-[10px] tracking-widest uppercase hover:text-white">
        ← Exit
      </button>

      {/* Visualizer Circle */}
      <div className={`w-64 h-64 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-red-500/20 scale-105' : 'bg-zinc-900 border-2 border-zinc-800'}`}>
        {isMicOn && <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>}
        {isSpeaking && <div className="absolute inset-0 rounded-full bg-lime-500 animate-pulse opacity-30 shadow-[0_0_60px_rgba(132,204,22,0.2)]"></div>}
        
        <div className="text-7xl drop-shadow-2xl">
            {isSpeaking ? "😤" : isMicOn ? "🎙️" : "💪"}
        </div>
      </div>

      {/* Feedback Area */}
      <div className="mt-12 text-center max-w-sm h-32 flex flex-col justify-center">
        <h2 className="text-lime-500 font-black italic uppercase tracking-widest text-xs mb-2">Coach Nitesh AI</h2>
        <p className={`text-xl font-bold italic leading-tight transition-all duration-300 ${isSpeaking ? 'text-white' : 'text-zinc-500'}`}>
          "{feedback}"
        </p>
      </div>

      {/* Control Button */}
      <div className="mt-10">
        <button
          onClick={toggleMic}
          disabled={isProcessing || isSpeaking}
          className={`group w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${(isProcessing || isSpeaking) ? 'opacity-50 cursor-not-allowed bg-zinc-800' : isMicOn ? 'bg-red-600 animate-bounce' : 'bg-white text-black hover:scale-105 active:scale-90'}`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest">{isMicOn ? 'Stop' : 'Tap'}</span>
          <span className="text-xs font-bold italic">TO TALK</span>
        </button>
      </div>
    </div>
  );
};

export default PostureMonitor;
