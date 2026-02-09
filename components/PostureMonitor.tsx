import React, { useRef, useState, useEffect } from 'react';

interface PostureMonitorProps {
  onBack: () => void;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [feedback, setFeedback] = useState("BalancePro Coach Nitesh is ready...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const shouldBeOnRef = useRef(false);

  useEffect(() => {
    if (!SpeechRecognition) {
      setFeedback("Browser not supported. Use Chrome.");
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

  const toggleMic = () => {
    if (isMicOn) {
      shouldBeOnRef.current = false;
      recognitionRef.current?.stop();
      setFeedback("Session Paused.");
    } else {
      window.speechSynthesis.cancel();
      shouldBeOnRef.current = true;
      try {
        recognitionRef.current?.start();
        setFeedback("Main sun raha hoon, apni diet ya workout ke baare mein pucho.");
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
      Knowledge: Expert in Strength Training, Diet (Protien, Carbs, Fats), Supplements, and Sustainable Lifestyle.
      Tone: Professional, highly motivating, and knowledgeable.
      Language: Hindi/Hinglish.
      
      Instructions:
      1. Give detailed advice on diet and fitness queries.
      2. Keep responses between 10 to 20 words so they feel complete but fast.
      3. CRITICAL: Never write digits like '3' or '4'. Always write them as 'teen', 'chaar', 'pandrah' in Hindi/Hinglish.
      4. If asked about BalancePro, say it's Nitesh Tyagi's platform for professional fitness results.
      5. Always encourage consistency.
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
      setFeedback("Network slow hai, ek minute rukiye.");
      if (shouldBeOnRef.current) recognitionRef.current?.start();
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95; // Slightly slower for better clarity
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
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <button onClick={onBack} className="absolute top-10 left-6 text-zinc-500 font-bold text-[10px] tracking-widest uppercase hover:text-white transition-colors">
        ← Close Session
      </button>

      {/* Visualizer with Logo */}
      <div className={`w-72 h-72 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-lime-500/10 scale-105 border-lime-500/30' : 'bg-zinc-900 border-zinc-800'} border-2`}>
        {isMicOn && <div className="absolute inset-0 rounded-full bg-lime-500 animate-ping opacity-10"></div>}
        {isSpeaking && <div className="absolute inset-0 rounded-full bg-blue-500 animate-pulse opacity-20 shadow-[0_0_80px_rgba(59,130,246,0.3)]"></div>}
        
        <div className="flex flex-col items-center">
            {/* Logo Image */}
            <img 
              src="../assets/logo.png" 
              alt="BalancePro" 
              className={`w-32 h-32 object-contain mb-4 transition-opacity duration-300 ${isSpeaking ? 'opacity-100' : 'opacity-80'}`}
              onError={(e) => {
                // Fallback if image path is wrong
                (e.target as any).src = "https://via.placeholder.com/150?text=BP";
              }}
            />
            <span className="text-[12px] font-black tracking-[0.4em] text-lime-500 uppercase">BalancePro</span>
        </div>
      </div>

      {/* Feedback Area */}
      <div className="mt-12 text-center max-w-sm h-40 flex flex-col justify-center px-4">
        <h2 className="text-zinc-600 font-black uppercase tracking-widest text-[10px] mb-3">Nitesh Tyagi's AI</h2>
        <p className={`text-xl font-bold italic leading-snug transition-all duration-300 ${isSpeaking ? 'text-white' : 'text-zinc-500'}`}>
          {isProcessing ? "Coach is calculating..." : feedback}
        </p>
      </div>

      {/* Control Button */}
      <div className="mt-8">
        <button
          onClick={toggleMic}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${isMicOn ? 'bg-lime-600 border-4 border-lime-400' : 'bg-white text-black hover:scale-110'}`}
        >
          <span className="font-black text-[10px] uppercase tracking-widest">{isMicOn ? 'Stop' : 'Start'}</span>
          <span className="font-bold text-[10px] italic">COACH</span>
        </button>
      </div>
      
      <div className="absolute bottom-10 flex flex-col items-center gap-2 opacity-30">
        <div className="h-[1px] w-12 bg-lime-500"></div>
        <p className="text-[8px] font-bold tracking-[0.5em] uppercase text-center">
          Sustainable Health • Professional Coaching
        </p>
      </div>
    </div>
  );
};

export default PostureMonitor;
