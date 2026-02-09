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
        setFeedback("Main sun raha hoon...");
      } catch (err) { console.error(err); }
    }
  };

  const handleGroqChat = async (userText: string) => {
    if (isSpeaking || isProcessing) return;
    setIsProcessing(true);
    recognitionRef.current?.stop(); 

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
      if (shouldBeOnRef.current) recognitionRef.current?.start();
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
        setTimeout(() => { try { recognitionRef.current?.start(); } catch(e) {} }, 300);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP HEADER (Fixed height to avoid overlap) */}
      <div className="w-full p-6 flex items-center justify-between z-50">
        <button 
          onClick={handleExit} 
          className="flex items-center gap-3 group active:scale-95 transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black shadow-lg">
            <span className="text-xl">←</span>
          </div>
          <span className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase group-hover:text-white">
            Go Back
          </span>
        </button>
        <div className="text-[10px] font-black tracking-[0.3em] text-lime-500 uppercase opacity-50">
          Coach AI v1.0
        </div>
      </div>

      {/* 2. MAIN CONTENT (Flexible area) */}
      <div className="flex-1 flex flex-col items-center justify-evenly px-6 pb-12">
        
        {/* Visualizer Circle */}
        <div className={`w-64 h-64 md:w-80 md:h-80 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-lime-500/10 scale-105 border-lime-500/30' : 'bg-zinc-900 border-zinc-800'} border-2`}>
          {isMicOn && <div className="absolute inset-0 rounded-full bg-lime-500 animate-ping opacity-10"></div>}
          {isSpeaking && <div className="absolute inset-0 rounded-full bg-blue-500 animate-pulse opacity-20 shadow-[0_0_60px_rgba(59,130,246,0.3)]"></div>}
          
          <div className="flex flex-col items-center px-4 text-center">
              <img 
                src="/assets/logo1.jpeg" 
                alt="BalancePro" 
                className={`w-32 md:w-40 h-auto object-contain mb-3 rounded-2xl shadow-2xl transition-all duration-500 ${isSpeaking ? 'scale-110' : 'scale-100 opacity-90'}`}
                onError={(e) => { (e.target as any).src = "https://via.placeholder.com/150?text=BP"; }}
              />
              <span className="text-[10px] md:text-[12px] font-black tracking-[0.4em] text-lime-500 uppercase">BalancePro</span>
          </div>
        </div>

        {/* Feedback Display (Height fixed to prevent jumping) */}
        <div className="w-full max-w-md text-center flex flex-col justify-center min-h-[140px]">
          <h2 className="text-zinc-600 font-black uppercase tracking-widest text-[9px] mb-4">Coach Nitesh AI</h2>
          <p className={`text-lg md:text-xl font-semibold italic leading-snug transition-all duration-300 ${isSpeaking ? 'text-white' : 'text-zinc-400'}`}>
            {isProcessing ? "Analyzing..." : feedback}
          </p>
        </div>

        {/* 3. CONTROL AREA */}
        <div className="flex flex-col items-center">
          <button
            onClick={toggleMic}
            className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${isMicOn ? 'bg-lime-600 border-4 border-lime-400' : 'bg-white text-black hover:scale-110 active:scale-90'}`}
          >
            <span className="font-black text-[10px] uppercase tracking-widest">{isMicOn ? 'Stop' : 'Start'}</span>
            <span className="font-bold text-[9px] italic">CONSULT</span>
          </button>
        </div>
      </div>
      
      {/* 4. FOOTER (Hidden on small screens if needed, or low opacity) */}
      <div className="w-full pb-8 flex flex-col items-center gap-2 opacity-20">
        <div className="h-[1px] w-8 bg-lime-500"></div>
        <p className="text-[7px] font-bold tracking-[0.5em] uppercase">
          Sustainability • Consistency
        </p>
      </div>
    </div>
  );
};

export default PostureMonitor;
