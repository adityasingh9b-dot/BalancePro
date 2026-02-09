import React, { useState, useEffect } from 'react';
import { VoiceRecorder } from 'capacitor-voice-recorder';

interface PostureMonitorProps {
  onBack: () => void;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [feedback, setFeedback] = useState("Coach Nitesh ready hai, puchiye apne sawal...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    VoiceRecorder.requestAudioRecordingPermission();
  }, []);

  const handleExit = () => {
    window.speechSynthesis.cancel();
    onBack();
  };

  const toggleMic = async () => {
    if (isMicOn) {
      const result = await VoiceRecorder.stopRecording();
      setIsMicOn(false);
      if (result.value && result.value.recordDataBase64) {
        processVoice(result.value.recordDataBase64);
      }
    } else {
      const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
      if (canRecord.value) {
        window.speechSynthesis.cancel();
        await VoiceRecorder.startRecording();
        setIsMicOn(true);
        setFeedback("Main sun raha hoon... Bolne ke baad STOP dabayein.");
      }
    }
  };

  const processVoice = async (base64Audio: string) => {
    setIsProcessing(true);
    setFeedback("Awaaz samajh raha hoon...");

    try {
      // 1. Convert Base64 to Blob for Groq Whisper
      const responseAudio = await fetch(`data:audio/wav;base64,${base64Audio}`);
      const audioBlob = await responseAudio.blob();
      
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.wav");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "hi");

      // 2. Get Text from Audio (Whisper)
      const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: formData
      });
      const whisperData = await whisperRes.json();
      const userText = whisperData.text;

      if (userText) {
        handleGroqChat(userText);
      } else {
        setFeedback("Kuch sunai nahi diya, firse boliye.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setFeedback("Error processing audio.");
      setIsProcessing(false);
    }
  };

  const handleGroqChat = async (userText: string) => {
    setFeedback(`Aapne kaha: "${userText}"`);
    
    const systemPrompt = `You are Coach Nitesh, expert trainer of BalancePro. Respond in LATIN SCRIPT Hinglish. Max 40 words. No digits.`;

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
      speakResponse(data.choices[0].message.content);
    } catch (err) {
      setFeedback("Network issue.");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.onstart = () => { setIsSpeaking(true); setFeedback(text); };
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
      <div className="w-full p-6 flex items-center justify-between z-50 pt-12">
        <button onClick={handleExit} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">←</div>
          <span className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase">Go Back</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-evenly px-6 pb-12">
        <div className={`w-64 h-64 rounded-full flex items-center justify-center relative transition-all duration-500 ${isMicOn ? 'bg-red-500/10 scale-105 border-red-500/30' : 'bg-zinc-900 border-zinc-800'} border-2`}>
          {isMicOn && <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-10"></div>}
          <div className="flex flex-col items-center px-4 text-center">
              <img src="/assets/logo1.jpeg" alt="BalancePro" className={`w-32 h-auto rounded-2xl ${isSpeaking ? 'scale-110' : 'scale-100 opacity-90'}`} />
              <span className="text-[10px] font-black tracking-[0.4em] text-lime-500 uppercase">Coach Nitesh</span>
          </div>
        </div>

        <div className="w-full max-w-md text-center min-h-[140px]">
          <p className={`text-lg font-semibold italic ${isSpeaking ? 'text-white' : 'text-zinc-400'}`}>
            {isProcessing ? "Analyzing..." : feedback}
          </p>
        </div>

        <button
          onClick={toggleMic}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${isMicOn ? 'bg-red-600 border-4 border-red-400' : 'bg-white text-black'}`}
        >
          <span className="font-black text-[10px] uppercase">{isMicOn ? 'Stop' : 'Start'}</span>
        </button>
      </div>
    </div>
  );
};

export default PostureMonitor;
