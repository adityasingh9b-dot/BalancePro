import React, { useState, useEffect } from 'react';
import { UserProfile, ActiveClass, DietPlan, VideoCategory, VideoItem } from '../types';
import { db, storage } from '../services/firebaseService'; // Real service use karein
import { ref, onValue } from 'firebase/database';
import { ref as sRef, getDownloadURL } from 'firebase/storage';
import PostureMonitor from './PostureMonitor';

interface ClientHomeProps {
  user: UserProfile;
  onJoinMeeting: (meetingId: string) => void;
}

const ClientHome: React.FC<ClientHomeProps> = ({ user, onJoinMeeting }) => {
  const [activeClass, setActiveClass] = useState<ActiveClass | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [isAiMode, setIsAiMode] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  
  // In-App Player State
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

useEffect(() => {
    // Real-time listeners with cleanup
    const unsubClass = onValue(ref(db, 'active_class'), (snap) => {
      const data = snap.val();
      setActiveClass(data?.status === 'live' && data.invitedUids?.includes(user.uid) ? data : null);
    });

    const unsubCats = onValue(ref(db, 'video_categories'), (snap) => {
      const data = snap.val();
      setCategories(data ? Object.values(data) : []);
    });

    const unsubVids = onValue(ref(db, 'videos'), (snap) => {
      const data = snap.val();
      setVideos(data ? Object.values(data) : []);
    });

    const unsubDiet = onValue(ref(db, `prescriptions/${user.uid}`), (snap) => {
      setDietPlan(snap.val());
    });

    // ClientHome.tsx ke useEffect ke andar
const unsubBanner = onValue(ref(db, 'trending_banner'), (snap) => {
  const data = snap.val();
  // Agar URL hai toh seedha set karein, koi fetch karne ki zaroorat nahi
  if (data?.url) {
    setBannerUrl(data.url);
  } else {
    setBannerUrl(null);
  }
});

    return () => { unsubClass(); unsubCats(); unsubVids(); unsubDiet(); unsubBanner(); };
  }, [user.uid]);


const handlePlayVideo = (vidId: string) => {
  // 1. Videos array mein se sahi video object dhundo
  const video = videos.find(v => v.id === vidId);
  
  if (video && video.url) {
    setPlayingVideoId(vidId);
    // 2. Direct Cloudinary URL set karein jo database mein save hai
    setVideoUrl(video.url);
  } else {
    console.error("Video record or URL missing in DB");
    alert("Video link broken or not found.");
  }
};

// Purana useEffect (Line 54-69) delete kar dein, uski zaroorat nahi hai.

  if (isAiMode) return <PostureMonitor onBack={() => setIsAiMode(false)} />;

  const filteredVideos = videos.filter(v => v.categoryId === selectedCatId);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-8 pb-32 animate-in fade-in">
      
      {/* Today's Trending Banner */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2 ml-1">
          <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse"></span>
          <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Today's Trending</h4>
        </div>
        <div className="relative w-full rounded-[40px] overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl group transition-all">
          {bannerUrl ? (
            <div className="aspect-[4/3] sm:aspect-[16/9] w-full">
              <img src={bannerUrl} alt="Daily Trending" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
              <div className="absolute bottom-8 left-8">
                 <span className="bg-lime-400 text-zinc-950 text-[9px] font-black uppercase px-3 py-1 rounded-full mb-3 inline-block shadow-lg">Studio Special</span>
                 <h2 className="text-2xl font-black italic uppercase text-white leading-tight">Coach Nitesh's <br/>Daily Focus</h2>
              </div>
            </div>
          ) : (
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex flex-col items-center justify-center p-10 text-center">
               <div className="w-12 h-12 rounded-full border border-zinc-700 flex items-center justify-center mb-4 text-zinc-700">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
               <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Waiting for Daily Update...</p>
            </div>
          )}
        </div>
      </section>

      {/* Live Class Alert */}
      {activeClass && (
        <div className="bg-lime-400 text-zinc-950 p-6 rounded-[32px] shadow-2xl text-center animate-bounce-short">
           <div className="flex items-center gap-2 justify-center mb-1"><span className="w-2 h-2 bg-zinc-950 rounded-full animate-ping"></span><span className="text-[10px] font-black uppercase tracking-widest">Live Studio</span></div>
           <h2 className="text-xl font-black italic uppercase">Coach Nitesh is Live!</h2>
           <button onClick={() => onJoinMeeting(activeClass.meetingId!)} className="w-full mt-4 bg-zinc-950 text-white py-4 rounded-2xl font-black uppercase text-xs">Join Now</button>
        </div>
      )}

      {/* The Lab Grid */}
      <div className="space-y-6">
        <div className="flex justify-between items-end">
           <div>
             <h4 className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mb-1">Vault</h4>
             <h3 className="text-2xl font-black italic uppercase text-white leading-none">The Exercise Lab</h3>
           </div>
           {selectedCatId && <button onClick={() => setSelectedCatId(null)} className="text-lime-400 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-lime-400/20">All Drills</button>}
        </div>

        {!selectedCatId ? (
          <div className="grid grid-cols-2 gap-4">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCatId(cat.id)} className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px] text-left group hover:border-lime-400/50 transition-all aspect-square flex flex-col justify-between shadow-xl">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{videos.filter(v=>v.categoryId===cat.id).length} Drills</span>
                <span className="text-xl font-black text-white italic uppercase group-hover:text-lime-400 transition-colors leading-none">{cat.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
             {filteredVideos.map(vid => (
               <div key={vid.id} className="bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden group shadow-lg">
                  <div className="aspect-video bg-zinc-950 relative flex items-center justify-center cursor-pointer" onClick={() => handlePlayVideo(vid.id)}>
                    <div className="w-14 h-14 bg-lime-400 text-zinc-950 rounded-full flex items-center justify-center shadow-2xl scale-100 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div className="p-6">
                     <span className="text-lg font-black text-white italic uppercase">{vid.title}</span>
                     <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-1">Direct from Studio</p>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* Diet Plan Section */}
      <div className="space-y-4">
        <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest ml-1">Current Protocol</h4>
        {dietPlan ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="bg-zinc-800/50 p-6 border-b border-zinc-800">
              <h3 className="font-black text-white text-lg mb-2 italic uppercase">Nutrition</h3>
              <p className="text-zinc-400 text-sm font-medium whitespace-pre-wrap">{dietPlan.nutrients}</p>
            </div>
            <div className="p-6">
              <h3 className="font-black text-white text-lg mb-2 italic uppercase">Meal Blueprint</h3>
              <p className="text-zinc-400 text-sm font-medium whitespace-pre-wrap">{dietPlan.meals}</p>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-dashed border-zinc-800 p-12 text-center rounded-[32px] text-zinc-600 text-xs italic">
            Coach Nitesh hasn't deployed your diet protocol yet.
          </div>
        )}
      </div>

      {/* AI Posture Section */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[40px] cursor-pointer hover:border-lime-400/50 transition-all shadow-xl group relative overflow-hidden" onClick={() => setIsAiMode(true)}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-lime-400/5 rounded-full blur-2xl"></div>
        <h3 className="text-2xl font-black italic uppercase text-white leading-none mb-1">Vision AI</h3>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Real-time Form Correction</p>
      </div>

      {/* In-App Video Player Overlay */}
      {playingVideoId && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-4xl space-y-4">
              <div className="flex justify-between items-center">
                 <h2 className="text-white font-black italic uppercase text-xl">
                    {videos.find(v => v.id === playingVideoId)?.title}
                 </h2>
                 <button onClick={() => setPlayingVideoId(null)} className="w-10 h-10 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors">✕</button>
              </div>
              <div className="aspect-video bg-black rounded-[40px] overflow-hidden border border-zinc-800 shadow-2xl relative">
                {videoUrl ? (
                  <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Fetching Drill...</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-short { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .animate-bounce-short { animation: bounce-short 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default ClientHome;
