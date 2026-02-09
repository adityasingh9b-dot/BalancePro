import React, { useRef, useState, useEffect } from 'react';

interface PostureMonitorProps {
  onBack: () => void;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [feedback, setFeedback] = useState("Coach Nitesh ready hai, puchiye apne sawal...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const shouldBeOnRef = useRef(false);

  useEffect(() => {
    if (!SpeechRecognition) {
      setFeedback("Browser support nahi kar raha. Please Chrome use karein.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = false;
    recognition.lang = 'hi-IN';

    recognition.onstart = () => setIsMicOn(true);

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      handleGroqChat(transcript);
    };

    recognition.onend = () => {
      if (shouldBeOnRef.current && !isSpeaking && !isProcessing) {
        try { recognition.start(); } catch (e) {}
      } else {
        setIsMicOn(false);
      }
    };

    recognitionRef.current = recognition;
  }, [isSpeaking, isProcessing]);

  // Function to stop everything before going back
  const handleExit = () => {
    shouldBeOnRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    onBack();
  };

  const toggleMic = () => {
    if (isMicOn) {
      shouldBeOnRef.current = false;
      recognitionRef.current?.stop();
      setFeedback("Session paused hai. Jab tayyar ho, Start dabayein.");
    } else {
      window.speechSynthesis.cancel();
      shouldBeOnRef.current = true;
      try {
        recognitionRef.current?.start();
        setFeedback("Main sun raha hoon... Diet ya workout se related kuch bhi puchiye.");
      } catch (err) { console.error(err); }
    }
  };

  const handleGroqChat = async (userText: string) => {
    if (isSpeaking || isProcessing) return;
    setIsProcessing(true);
    recognitionRef.current?.stop(); 

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    const systemPrompt = `
      You are Coach Nitesh, the expert AI trainer of BalancePro, founded by Nitesh Tyagi.
      STRICT RULES:
      1. LANGUAGE: Use Hinglish (mix of Hindi and English) written in LATIN SCRIPT (English alphabet). 
      2. LENGTH: Give detailed and expert responses. Minimum 25 words, maximum 50 words.
      3. TONE: Professional, motivating, and friendly gym coach vibe.
      4. NUMBERS: Never use digits like '5'. Write as 'paanch'.
      5. BRAND: Mention BalancePro consistency.
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
      setFeedback("Network slow hai, ek baar phir try karein.");
      if (shouldBeOnRef.current) recognitionRef.current?.start();
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setFeedback(text);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (shouldBeOnRef.current) {
        setTimeout(() => { try { recognitionRef.current?.start(); } catch(e) {} }, 300);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* 🔙 ENHANCED BACK BUTTON */}
      <button 
        onClick={handleExit} 
        className="absolute top-10 left-6 flex items-center gap-2 group z-50"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
          <span className="text-xl">←</span>
        </div>
        <span className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase group-hover:text-white transition-colors">
          Go Back
        </span>
      </button>

      {/* Visualizer Circle */}
      <div className={`w-72 h-72 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-lime-500/10 scale-105 border-lime-500/30' : 'bg-zinc-900 border-zinc-800'} border-2`}>
        {isMicOn && <div className="absolute inset-0 rounded-full bg-lime-500 animate-ping opacity-10"></div>}
        {isSpeaking && <div className="absolute inset-0 rounded-full bg-blue-500 animate-pulse opacity-20 shadow-[0_0_80px_rgba(59,130,246,0.3)]"></div>}
        
        <div className="flex flex-col items-center px-4 text-center">
            <img 
              src="/assets/logo1.jpeg" 
              alt="BalancePro" 
              // ✨ ADDED ROUNDED EDGES (rounded-2xl)
              className={`w-36 h-auto object-contain mb-4 rounded-2xl shadow-lg transition-all duration-500 ${isSpeaking ? 'scale-110' : 'scale-100 opacity-90'}`}
              onError={(e) => { (e.target as any).src = "https://via.placeholder.com/150?text=BP"; }}
            />
            <span className="text-[12px] font-black tracking-[0.4em] text-lime-500 uppercase">BalancePro</span>
        </div>
      </div>

      {/* Feedback Area */}
      <div className="mt-12 text-center max-w-md h-56 flex flex-col justify-center px-6">
        <h2 className="text-zinc-600 font-black uppercase tracking-widest text-[10px] mb-3">Coach Nitesh AI</h2>
        <p className={`text-lg font-semibold italic leading-relaxed transition-all duration-300 ${isSpeaking ? 'text-white' : 'text-zinc-400'}`}>
          {isProcessing ? "Analyzing your query..." : feedback}
        </p>
      </div>

      {/* Start Button */}
      <div className="mt-6">
        <button
          onClick={toggleMic}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${isMicOn ? 'bg-lime-600 border-4 border-lime-400' : 'bg-white text-black hover:scale-110 active:scale-95'}`}
        >
          <span className="font-black text-[10px] uppercase tracking-widest">{isMicOn ? 'Stop' : 'Start'}</span>
          <span className="font-bold text-[10px] italic">CONSULT</span>
        </button>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-10 flex flex-col items-center gap-2 opacity-30">
        <div className="h-[1px] w-12 bg-lime-500"></div>
        <p className="text-[8px] font-bold tracking-[0.5em] uppercase text-center">
          Sustainability • Consistency • Balance
        </p>
      </div>
    </div>
  );
};

export default PostureMonitor;
