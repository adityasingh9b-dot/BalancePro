import React, { useState, useEffect } from 'react';
import { UserProfile, ActiveClass, DietPlan, VideoCategory, VideoItem } from '../types';
import { db } from '../services/firebaseService'; 
import { ref, onValue } from 'firebase/database';
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
  
  const [isPaused, setIsPaused] = useState(false);
const [touchStart, setTouchStart] = useState<number | null>(null); // Swipe track karne ke liye
  
  // Banner Slider States
  const [bannerUrls, setBannerUrls] = useState<string[]>([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  // In-App Player State
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // EFFECT 1: Real-time Firebase Listeners
  useEffect(() => {
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

    const unsubBanner = onValue(ref(db, 'trending_banner'), (snap) => { // <--- 's' HATA DIYA
  const data = snap.val();
  if (data) {
    // Objects ko array mein convert kar rahe hain slider ke liye
    const urls = Object.values(data).map((item: any) => item.url);
    setBannerUrls(urls);
  } else {
    setBannerUrls([]);
  }
});

    // Cleanup all listeners on unmount
    return () => { 
      unsubClass(); 
      unsubCats(); 
      unsubVids(); 
      unsubDiet(); 
      unsubBanner(); 
    };
  }, [user.uid]);

useEffect(() => {
  if (bannerUrls.length <= 1 || isPaused) return;

  const timer = setInterval(() => {
    setCurrentIndex((prev) => (prev + 1) % bannerUrls.length);
  }, 3500);

  return () => clearInterval(timer);
}, [bannerUrls, isPaused]);

const handleTouchStart = (e: React.TouchEvent) => {
  setIsPaused(true);
  // Hum clientX use kar rahe hain horizontal track karne ke liye
  setTouchStart(e.targetTouches[0].clientX);
};

const handleTouchEnd = (e: React.TouchEvent) => {
  setIsPaused(false);
  
  // Strict null check (Zero value allow karne ke liye)
  if (touchStart === null) return;

  const touchEnd = e.changedTouches[0].clientX;
  const distance = touchStart - touchEnd;

  // Sensitivity threshold: 50px
  if (distance > 50) {
    // Swipe Left -> Agli image
    setCurrentIndex((prev) => (prev + 1) % bannerUrls.length);
  } else if (distance < -50) {
    // Swipe Right -> Pichli image
    setCurrentIndex((prev) => (prev === 0 ? bannerUrls.length - 1 : prev - 1));
  }
  
  // Reset state
  setTouchStart(null);
};

  const handlePlayVideo = (vidId: string) => {
    const video = videos.find(v => v.id === vidId);
    if (video && video.url) {
      setPlayingVideoId(vidId);
      setVideoUrl(video.url);
    } else {
      console.error("Video record or URL missing in DB");
      alert("Video link broken or not found.");
    }
  };
  


  if (isAiMode) return <PostureMonitor onBack={() => setIsAiMode(false)} />;

  const filteredVideos = videos.filter(v => v.categoryId === selectedCatId);

return (
  <div className="min-h-screen bg-[#081221] text-slate-200 selection:bg-[#FFB800] selection:text-black">
    <div className="p-6 max-w-2xl mx-auto space-y-16 pb-32 animate-in fade-in duration-700">

      {/* Today's Trending Banner - Midnight Edition (Slider) */}
      <section className="space-y-4">
        <div className="flex justify-between items-end mb-2 ml-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#FFB800] rounded-full animate-pulse shadow-[0_0_8px_#FFB800]"></span>
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Today's Trending</h4>
          </div>
          
          {/* Slide Indicators (Dots) */}
          {bannerUrls.length > 1 && (
            <div className="flex gap-1.5 px-2 py-1 bg-black/20 rounded-full border border-white/5">
              {bannerUrls.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1 rounded-full transition-all duration-500 ${
                    idx === currentIndex ? 'w-4 bg-[#FFB800]' : 'w-1 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* --- INTERACTIVE SLIDER CONTAINER --- */}
        <div 
  className="relative w-full rounded-[32px] overflow-hidden bg-[#0F1A2D] border border-white/5 shadow-2xl group touch-pan-y"
  onMouseEnter={() => setIsPaused(true)}
  onMouseLeave={() => setIsPaused(false)}
  onTouchStart={handleTouchStart} 
  onTouchEnd={handleTouchEnd}     
>
          {bannerUrls.length > 0 ? (
            <div className="aspect-[4/3] sm:aspect-[16/9] w-full relative">
              
              {/* --- Sliding Images Container --- */}
              <div 
                className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]" 
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {bannerUrls.map((url, index) => (
                  <img 
                    key={index} 
                    src={url} 
                    alt={`Trending ${index}`} 
                    className="w-full h-full object-cover flex-shrink-0 select-none pointer-events-none" 
                  />
                ))}
              </div>

              {/* Midnight Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#081221] via-transparent to-transparent pointer-events-none"></div>
              
             {/* Banner Content */}
<div className="absolute bottom-8 left-8 right-8 z-10 pointer-events-none">
  <span className="bg-[#FF0000] text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg mb-4 inline-block shadow-lg tracking-wider">
    Trending Now
  </span>
  {/* text-white ko text-black kar diya hai neeche */}
  <h2 className="text-3xl font-black italic uppercase text-black leading-tight tracking-tight drop-shadow-2xl">
    Nitesh Tyagi<br/>
    <span className="text-[#FFB800]">TESTIMONALS</span>
  </h2>
</div>

              {/* Glassy Slide Number */}
              <div className="absolute top-6 right-6 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[9px] font-bold text-white/60">
                {currentIndex + 1} / {bannerUrls.length}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="aspect-[16/9] w-full bg-[#0F1A2D] flex flex-col items-center justify-center p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-slate-700 border border-white/5">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Awaiting Content Deployment...</p>
            </div>
          )}
        </div>
      </section>

      {/* Part 2: Live Class Alert will follow here... */}
      {activeClass && (
        <div className="relative group overflow-hidden bg-[#0F1A2D] border border-[#FF0000]/30 p-8 rounded-[32px] shadow-2xl animate-in slide-in-from-top duration-500">
          {/* Subtle Red Glow Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF0000]/10 to-transparent opacity-50"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-3">
              {/* Red Signal Dot */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF0000] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF0000]"></span>
              </span>
              <span className="text-[10px] font-black uppercase text-[#FF0000] tracking-[0.3em]">Studio is Live</span>
            </div>
            
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tight mb-6 text-center">
              Coach Nitesh <span className="text-[#FFB800]">is live!</span>
            </h2>
            
            {/* Trainer Style Action Button */}
            <button 
              onClick={() => onJoinMeeting(activeClass.meetingId!)} 
              className="w-full bg-[#FFB800] text-[#081221] py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-[#FFB800]/10 hover:shadow-[#FFB800]/20 active:scale-95 transition-all duration-300"
            >
              Enter Active Session
            </button>
            
            <p className="mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
              High-Quality Stream • Real-Time Class
            </p>
          </div>

          {/* Decorative Corner Accent */}
          <div className="absolute top-0 right-0 p-2">
            <div className="w-12 h-12 bg-[#FFB800]/5 rounded-bl-[100px] border-b border-l border-white/5"></div>
          </div>
        </div>
      )}

{/* Part 3: The Lab Grid - Midnight Vault Edition */}
<div className="space-y-8">
  <div className="flex justify-between items-end px-1">
      <div className="space-y-1">
        <h4 className="text-[10px] font-black uppercase text-[#FFB800] tracking-[0.4em]">Vault</h4>
        <h3 className="text-3xl font-black italic uppercase text-white leading-none tracking-tighter">The Exercise Lab</h3>
      </div>
      {selectedCatId && (
        <button 
          onClick={() => setSelectedCatId(null)} 
          className="text-[#FFB800] text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-xl border border-[#FFB800]/20 bg-[#FFB800]/5 hover:bg-[#FFB800] hover:text-[#081221] active:scale-95 transition-all duration-300"
        >
          ← All Drills
        </button>
      )}
  </div>

  {!selectedCatId ? (
    /* Category Grid - Trainer Folder Style */
    <div className="grid grid-cols-2 gap-4 px-1">
      {categories.map(cat => (
        <button 
          key={cat.id} 
          onClick={() => setSelectedCatId(cat.id)} 
          className="bg-[#0F1A2D] border border-white/5 p-6 rounded-[32px] text-left group hover:border-[#FFB800]/30 transition-all aspect-square flex flex-col justify-between shadow-2xl relative overflow-hidden active:scale-[0.98]"
        >
          <div className="relative z-10">
            <div className="bg-white/5 w-fit px-3 py-1 rounded-lg border border-white/5 mb-2">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {videos.filter(v=>v.categoryId===cat.id).length} Drills
              </span>
            </div>
          </div>
          
          <span className="text-xl font-black text-white italic uppercase group-hover:text-[#FFB800] transition-colors leading-tight relative z-10 tracking-tight">
            {cat.name}
          </span>

          {/* Abstract Background Shapes like Trainer CRM UI */}
          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-gradient-to-br from-[#FFB800]/10 to-transparent rounded-full blur-2xl group-hover:bg-[#FFB800]/20 transition-all"></div>
        </button>
      ))}
    </div>
  ) : (
    /* Video Grid - Premium Studio Style */
    <div className="grid grid-cols-2 gap-4 px-1">
       {filteredVideos.map(vid => (
         <div 
           key={vid.id} 
           onClick={() => handlePlayVideo(vid.id)}
           className="bg-[#0F1A2D] border border-white/5 p-6 rounded-[32px] text-left group hover:border-[#FFB800]/40 transition-all aspect-square flex flex-col justify-between shadow-2xl relative overflow-hidden cursor-pointer active:scale-[0.98]"
         >
            {/* Play Button - Trainer Gold Branding */}
            <div className="w-12 h-12 bg-[#FFB800] text-[#0F1A2D] rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
              <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>

            <div className="relative z-10">
               <span className="text-lg font-black text-white italic uppercase leading-[1.1] group-hover:text-[#FFB800] transition-colors line-clamp-2 mb-1 tracking-tight">
                 {vid.title}
               </span>
               <div className="flex items-center gap-2">
                 <div className="flex gap-0.5">
                   <span className="w-1.5 h-1.5 bg-[#FF0000] rounded-full"></span>
                 </div>
                 <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Mastery Drill</p>
               </div>
            </div>
            
            {/* Glossy overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#FFB800]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
         </div>
       ))}
    </div>
  )}
</div>


{/* Part 4: Diet Plan Section - Midnight Protocol Edition */}
<div className="space-y-6">
  <div className="flex items-center gap-3 ml-1">
    <div className="flex gap-1">
      <span className="w-1 h-3 bg-[#FF0000] rounded-full"></span>
      <span className="w-1 h-3 bg-[#FFB800] rounded-full opacity-50"></span>
    </div>
    <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-[0.4em]">Current Protocol</h4>
  </div>

  {dietPlan ? (
    <div className="bg-[#0F1A2D] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all">
      {/* Nutrition Header - Trainer UI Prescription Style */}
      <div className="bg-[#16243d] p-8 border-b border-white/5 relative overflow-hidden">
        {/* Background Accent Icon */}
        <div className="absolute -top-2 -right-2 opacity-[0.03] rotate-12">
          <svg className="w-32 h-32 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#FFB800]/10 text-[#FFB800] text-[8px] font-black px-2 py-1 rounded border border-[#FFB800]/20 uppercase tracking-widest">Macro Goals</span>
          </div>
          <h3 className="font-black text-white text-2xl mb-4 italic uppercase tracking-tight">Nutrition <span className="text-[#FFB800]">Logic</span></h3>
          <p className="text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-wrap font-mono opacity-90">
            {dietPlan.nutrients}
          </p>
        </div>
      </div>

      {/* Meal Blueprint - Deep Midnight Section */}
      <div className="p-8 relative bg-gradient-to-b from-transparent to-black/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-white/5 text-slate-500 text-[8px] font-black px-2 py-1 rounded border border-white/5 uppercase tracking-widest">Daily Schedule</span>
        </div>
        <h3 className="font-black text-white text-2xl mb-4 italic uppercase tracking-tight">Meal <span className="text-slate-500">Blueprint</span></h3>
        <p className="text-slate-400 text-sm font-medium leading-relaxed whitespace-pre-wrap opacity-80">
          {dietPlan.meals}
        </p>
      </div>
    </div>
  ) : (
    /* Empty State: Matching Trainer UI's Clean Registry Vibe */
    <div className="bg-[#0F1A2D] border-2 border-dashed border-white/5 p-16 text-center rounded-[40px] group transition-all hover:border-[#FFB800]/20">
       <div className="w-16 h-16 bg-[#16243d] rounded-[24px] flex items-center justify-center mx-auto mb-6 border border-white/5 text-slate-700 group-hover:text-[#FFB800] group-hover:scale-110 transition-all duration-500">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
       </div>
       <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] leading-relaxed">
         Protocol Status: <span className="text-[#FF0000]">Pending</span> <br/>
         <span className="opacity-50">Waiting for Coach Nitesh to Deploy</span>
       </p>
    </div>
  )}
</div>



{/* Part 5: AI Posture Section - Neural Vision Edition */}
<div 
  className="relative bg-[#0F1A2D] border border-white/5 p-10 rounded-[48px] cursor-pointer hover:border-[#FFB800]/30 transition-all duration-500 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] group overflow-hidden" 
  onClick={() => setIsAiMode(true)}
>
  {/* Trainer UI Style: Dynamic Scanner Light Effect */}
  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FFB800] to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-y-[100px] transition-all duration-[2000ms] ease-in-out"></div>
  
  {/* Radial Glow Background */}
  <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#FFB800]/5 rounded-full blur-[80px] group-hover:bg-[#FFB800]/10 transition-all duration-700"></div>

  <div className="flex justify-between items-center relative z-10">
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* Active Pulse Signal */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB800] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FFB800]"></span>
        </span>
        <p className="text-[#FFB800] text-[10px] font-black uppercase tracking-[0.4em] drop-shadow-[0_0_5px_rgba(255,184,0,0.5)]">
          Neural Engine v3.0
        </p>
      </div>
      
      <div>
        <h3 className="text-4xl font-black italic uppercase text-white leading-none mb-2 tracking-tighter">
          Vision <span className="text-slate-600 group-hover:text-white transition-colors">AI</span>
        </h3>
        <p className="text-slate-500 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-4 h-[1px] bg-slate-800"></span>
          Real-time Form Correction
        </p>
      </div>
    </div>

    {/* AI Tech Icon - Matching Trainer Studio Icons */}
    <div className="relative">
      <div className="absolute inset-0 bg-[#FFB800]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="relative bg-[#16243d] p-6 rounded-[28px] border border-white/5 shadow-inner group-hover:border-[#FFB800]/40 transition-all duration-500 group-hover:-rotate-6">
        <svg className="w-10 h-10 text-[#FFB800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  </div>

  {/* HUD Style Corner Accents */}
  <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-white/10 rounded-tl-lg"></div>
  <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-[#FFB800]/20 rounded-br-lg group-hover:border-[#FFB800]/50 transition-colors"></div>

  {/* Scanline Overlay */}
  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
</div>
      

{/* Final Part: In-App Video Player Overlay - Cinema Pro Polish */}
      {playingVideoId && (
        <div className="fixed inset-0 z-[100] bg-[#081221]/98 backdrop-blur-2xl flex flex-col items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300">
           <div className="w-full max-w-5xl space-y-6">
              
              {/* Player Header: Integrated Studio Look */}
              <div className="flex justify-between items-center px-2">
                 <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1 h-1 bg-[#FFB800] rounded-full animate-pulse"></span>
                      <span className="text-[#FFB800] text-[10px] font-black uppercase tracking-[0.4em]">Now Training</span>
                    </div>
                    <h2 className="text-white font-black italic uppercase text-xl md:text-3xl tracking-tighter">
                       {videos.find(v => v.id === playingVideoId)?.title}
                    </h2>
                 </div>
                 
                 {/* Close Button: Trainer UI Signature Red */}
                 <button 
                   onClick={() => setPlayingVideoId(null)} 
                   className="w-14 h-14 bg-white/5 text-white rounded-[20px] flex items-center justify-center hover:bg-[#FF0000] hover:text-white transition-all active:scale-95 border border-white/10 group shadow-xl"
                 >
                   <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
              </div>

              {/* Video Container: Cinema Depth */}
              <div className="aspect-video bg-black rounded-[40px] md:rounded-[56px] overflow-hidden border border-white/5 shadow-[0_0_120px_rgba(0,0,0,1)] relative group ring-1 ring-white/5">
                {videoUrl ? (
                  <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    loop 
                    playsInline 
                    webkit-playsinline="true" 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#0F1A2D]">
                    {/* Minimalist Gold Loader */}
                    <div className="relative">
                      <div className="w-12 h-12 border-2 border-[#FFB800]/10 border-t-[#FFB800] rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#FFB800]">BP</div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">Initializing Studio Stream...</p>
                  </div>
                )}
              </div>

              {/* Bottom Branding: High-End Minimalist */}
              <div className="flex flex-col items-center gap-2 opacity-40">
                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <p className="text-white text-[10px] font-black uppercase tracking-[0.6em]">BalancePro Studio Vault</p>
              </div>
           </div>
        </div>
      )}

      {/* Global Aesthetics Style */}
      <style>{`
        @keyframes bounce-short { 
          0%, 100% { transform: translateY(0); } 
          50% { transform: translateY(-5px); } 
        }
        .animate-bounce-short { 
          animation: bounce-short 2s ease-in-out infinite; 
        }
        
        /* Custom Scrollbar for Trainer UI vibe */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #081221; }
        ::-webkit-scrollbar-thumb { background: #0F1A2D; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #FFB800; }
      `}</style>
    </div>
    </div>
  );
};

export default ClientHome;
