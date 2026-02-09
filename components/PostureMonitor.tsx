import React, { useRef, useState, useEffect } from 'react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

interface PostureMonitorProps {
  onBack: () => void;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [feedback, setFeedback] = useState("Coach Nitesh ready hai, puchiye apne sawal...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const shouldBeOnRef = useRef(false);

  // Initial Permission Check
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const available = await SpeechRecognition.available();
        if (available.available) {
          await SpeechRecognition.requestPermissions();
        } else {
          setFeedback("Speech Recognition is device par available nahi hai.");
        }
      } catch (e) {
        console.error("Permission error:", e);
      }
    };
    checkPermission();
  }, []);

  const handleExit = async () => {
    shouldBeOnRef.current = false;
    await SpeechRecognition.stop();
    window.speechSynthesis.cancel();
    onBack();
  };

  const toggleMic = async () => {
    if (isMicOn) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const startListening = async () => {
    window.speechSynthesis.cancel();
    shouldBeOnRef.current = true;
    setIsMicOn(true);
    setFeedback("Main sun raha hoon...");

    try {
      // Start listening with Hindi language
      await SpeechRecognition.start({
        language: "hi-IN",
        partialResults: false,
        popup: true, // Native Google popup for better reliability
      });

      // Listen for the result
      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          const text = data.matches[0];
          stopListening();
          handleGroqChat(text);
        }
      });
    } catch (err) {
      console.error("Listening error:", err);
      setIsMicOn(false);
      setFeedback("Mic start nahi hua. Check settings.");
    }
  };

  const stopListening = async () => {
    shouldBeOnRef.current = false;
    setIsMicOn(false);
    await SpeechRecognition.stop();
    SpeechRecognition.removeAllListeners();
  };

  const handleGroqChat = async (userText: string) => {
    if (isSpeaking || isProcessing) return;
    setIsProcessing(true);

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    const systemPrompt = `
      You are Coach Nitesh, expert trainer of BalancePro.
      Respond in LATIN SCRIPT Hinglish (English alphabet).
      Detailed response (25-50 words). 
      No digits, use words like 'dus' or 'bees'.
      Focus on BalancePro consistency.
    `;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText }
          ]
        })
      });

      const data = await response.json();
      const coachReply = data.choices[0].message.content;
      speakResponse(coachReply);
    } catch (err) {
      setFeedback("Network slow hai, try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 1.0; 

    utterance.onstart = () => {
      setIsSpeaking(true);
      setFeedback(text);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (shouldBeOnRef.current) {
        setTimeout(() => startListening(), 500);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <div className="w-full p-6 flex items-center justify-between z-50 pt-12">
        <button onClick={handleExit} className="flex items-center gap-3 group active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
            <span className="text-xl">←</span>
          </div>
          <span className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase">Go Back</span>
        </button>
        <div className="text-[10px] font-black tracking-[0.3em] text-lime-500 uppercase opacity-50">Coach AI v1.0</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-evenly px-6 pb-12">
        {/* Visualizer */}
        <div className={`w-64 h-64 md:w-80 md:h-80 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-lime-500/10 scale-105 border-lime-500/30' : 'bg-zinc-900 border-zinc-800'} border-2`}>
          {isMicOn && <div className="absolute inset-0 rounded-full bg-lime-500 animate-ping opacity-10"></div>}
          <div className="flex flex-col items-center px-4 text-center">
              <img src="/assets/logo1.jpeg" alt="BalancePro" className={`w-32 md:w-40 h-auto object-contain mb-3 rounded-2xl shadow-2xl ${isSpeaking ? 'scale-110' : 'scale-100 opacity-90'}`} />
              <span className="text-[10px] md:text-[12px] font-black tracking-[0.4em] text-lime-500 uppercase">BalancePro</span>
          </div>
        </div>

        {/* Feedback */}
        <div className="w-full max-w-md text-center flex flex-col justify-center min-h-[140px]">
          <h2 className="text-zinc-600 font-black uppercase tracking-widest text-[9px] mb-4">Coach Nitesh AI</h2>
          <p className={`text-lg md:text-xl font-semibold italic transition-all duration-300 ${isSpeaking ? 'text-white' : 'text-zinc-400'}`}>
            {isProcessing ? "Analyzing..." : feedback}
          </p>
        </div>

        {/* Control */}
        <div className="flex flex-col items-center">
          <button onClick={toggleMic} className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${isMicOn ? 'bg-lime-600 border-4 border-lime-400' : 'bg-white text-black'}`}>
            <span className="font-black text-[10px] uppercase tracking-widest">{isMicOn ? 'Stop' : 'Start'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostureMonitor;
