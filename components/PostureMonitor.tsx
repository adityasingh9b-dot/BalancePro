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

    recognition.onstart = () => {
      setIsMicOn(true);
      console.log("🎤 Monitoring Active");
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      handleGroqChat(transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      console.error("Mic Error:", event.error);
      setIsMicOn(false);
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
        setFeedback("I'm listening. Ask me anything about your fitness!");
      } catch (err) { console.error(err); }
    }
  };

  const handleGroqChat = async (userText: string) => {
    if (isSpeaking || isProcessing) return;
    setIsProcessing(true);
    recognitionRef.current?.stop(); 

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    // YEH HAI NAYA PROFESSIONAL PROMPT
    const systemPrompt = `
      You are Coach Nitesh, the AI assistant of Nitesh Tyagi (Founder of BalancePro). 
      BalancePro is a premier fitness company focused on sustainable health and professional coaching.
      Your tone: Professional, disciplined, encouraging, and knowledgeable. 
      Language: Hinglish (Hindi + English) naturally spoken in Indian gyms.
      Guidelines:
      1. Strictly NO abusive language or insults.
      2. Provide scientific yet simple fitness advice.
      3. If asked about BalancePro, mention it's Nitesh Tyagi's vision for a balanced lifestyle.
      4. Keep responses short and punchy (Max 25 words).
      5. Motivate the user to maintain proper form and consistency.
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
      setFeedback("Connection slow hai, ek minute rukiye.");
      if (shouldBeOnRef.current) recognitionRef.current?.start();
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0; // Professional clear voice

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

      {/* Modern Visualizer */}
      <div className={`w-64 h-64 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-lime-500/10 scale-105 border-lime-500/30' : 'bg-zinc-900 border-zinc-800'} border-2`}>
        {isMicOn && <div className="absolute inset-0 rounded-full bg-lime-500 animate-ping opacity-10"></div>}
        {isSpeaking && <div className="absolute inset-0 rounded-full bg-blue-500 animate-pulse opacity-20 shadow-[0_0_60px_rgba(59,130,246,0.2)]"></div>}
        
        <div className="flex flex-col items-center">
            <span className="text-6xl mb-2">{isSpeaking ? "🗣️" : isMicOn ? "🎧" : "🧘"}</span>
            <span className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 uppercase">BalancePro</span>
        </div>
      </div>

      {/* Info Area */}
      <div className="mt-12 text-center max-w-sm h-32 flex flex-col justify-center">
        <h2 className="text-lime-500 font-black uppercase tracking-widest text-[10px] mb-2">Expert Assistant</h2>
        <p className={`text-lg font-medium leading-tight transition-all duration-300 ${isSpeaking ? 'text-white' : 'text-zinc-400 italic'}`}>
          {isProcessing ? "Analyzing query..." : feedback}
        </p>
      </div>

      {/* Professional Toggle */}
      <div className="mt-10">
        <button
          onClick={toggleMic}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isMicOn ? 'bg-lime-600 border-4 border-lime-400 shadow-lime-500/20' : 'bg-white text-black hover:scale-105'}`}
        >
          <span className="font-black text-xs uppercase tracking-widest">{isMicOn ? 'Stop' : 'Start'}</span>
        </button>
      </div>
      
      <div className="absolute bottom-10 opacity-20 text-[8px] font-bold tracking-[0.5em] uppercase">
        Sustainability • Consistency • Balance
      </div>
    </div>
  );
};

export default PostureMonitor;
