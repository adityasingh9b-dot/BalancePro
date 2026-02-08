import React, { useRef, useEffect, useState } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface PostureMonitorProps {
  onBack: () => void;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [feedback, setFeedback] = useState("Stand in front of the camera...");
  const [isMuted, setIsMuted] = useState(false);
  const lastSpokenRef = useRef<number>(0);

  // 1. FREE VOICE FUNCTION (Browser Inbuilt)
  const speak = (text: string) => {
    const now = Date.now();
    // 5 seconds ka gap rakhte hain taaki AI lagataar na chilaye
    if (isMuted || now - lastSpokenRef.current < 5000) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Thoda slow and clear
    window.speechSynthesis.speak(utterance);
    lastSpokenRef.current = now;
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // 2. ANALYZE POSTURE (Pure Logic)
    pose.onResults((results) => {
      if (!canvasRef.current || !videoRef.current) return;

      const canvasCtx = canvasRef.current.getContext('2d')!;
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Draw video frame to canvas
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.poseLandmarks) {
        // Draw Skeleton
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#BEF264', lineWidth: 4 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FFFFFF', lineWidth: 2, radius: 3 });

        // LOGIC: Back Straight Check (Landmark 11: Left Shoulder, 23: Left Hip)
        const shoulder = results.poseLandmarks[11];
        const hip = results.poseLandmarks[23];

        if (shoulder && hip) {
          const alignment = Math.abs(shoulder.x - hip.x);
          if (alignment > 0.15) {
            setFeedback("Fix your posture! Straighten your back.");
            speak("Please straighten your back.");
          } else {
            setFeedback("Perfect form! Keep it up.");
            speak("Form looks great.");
          }
        }
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      pose.close();
    };
  }, [isMuted]);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-zinc-400 font-black tracking-widest uppercase text-[10px]">← Exit</button>
        <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400">
          {isMuted ? '🔇 Muted' : '🔊 Audio On'}
        </button>
      </div>

      {/* Main View */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-full max-w-2xl aspect-video rounded-[40px] overflow-hidden border-4 border-zinc-800">
          <video ref={videoRef} className="hidden" />
          <canvas ref={canvasRef} className="w-full h-full object-cover scale-x-[-1]" width="640" height="480" />
          
          <div className="absolute bottom-6 left-6 right-6">
             <div className="bg-zinc-950/90 backdrop-blur-xl p-6 rounded-[32px] border border-lime-400/30">
                <p className="text-lime-400 font-black italic uppercase text-center text-xl tracking-tight">
                  {feedback}
                </p>
             </div>
          </div>
        </div>
        <h2 className="mt-6 text-white font-black italic uppercase tracking-tighter text-3xl">BalancePro <span className="text-lime-400">Vision</span></h2>
      </div>
    </div>
  );
};

export default PostureMonitor;
