import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, UserRole, ActiveClass, DietPlan, ScheduleItem, VideoCategory, VideoItem } from '../types';
import { db } from '../services/firebaseService';
import { ref, set, onValue, remove } from 'firebase/database';
import { storage } from '../services/firebaseService';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const meetingId = `BP_Studio_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

const UPLOAD_PRESET = "balancepro";

interface TrainerHomeProps {
  user: UserProfile;
  onStartMeeting: (meetingId: string) => void;
}

const TrainerHome: React.FC<TrainerHomeProps> = ({ user, onStartMeeting }) => {
  // --- STATES (FIXED: Moved inside component) ---
  const [activeClassData, setActiveClassData] = useState<any>(null); 
  const [view, setView] = useState<'classes' | 'clients' | 'management' | 'media'>('classes');
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [trendingBanner, setTrendingBanner] = useState<{ id: string, updatedOn: number } | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Vault/CRM/Other States
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newVidTitle, setNewVidTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberCode, setNewMemberCode] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [selectedInvites, setSelectedInvites] = useState<string[]>([]);
  const [selectedClientForDiet, setSelectedClientForDiet] = useState<string>('');
  const [nutrients, setNutrients] = useState('');
  const [meals, setMeals] = useState('');

  useEffect(() => {
    // 1. Categories Sync
    onValue(ref(db, 'video_categories'), (snap) => {
      const data = snap.val();
      setCategories(data ? Object.values(data) : []);
    });

    // 2. Videos Sync
    onValue(ref(db, 'videos'), (snap) => {
      const data = snap.val();
      setVideos(data ? Object.values(data) : []);
    });

    // 3. Users/Clients Sync
    onValue(ref(db, 'users'), (snap) => {
      const data = snap.val() || {};
      const all = Object.values(data) as UserProfile[];
      setClients(all.filter(u => u.role === UserRole.CLIENT));
    });

    // 4. ACTIVE CLASS SYNC (FIXED Logic)
    onValue(ref(db, 'active_class'), (snap) => {
      const data = snap.val();
      setIsLive(data?.status === 'live');
      setActiveClassData(data); // Storing full object to access meetingId
    });

    // 5. Schedules Sync
    onValue(ref(db, 'schedules'), (snap) => {
      const data = snap.val();
      setSchedules(data ? Object.values(data) : []);
    });

    // 6. Banner Sync
    onValue(ref(db, 'trending_banner'), (snap) => {
      const data = snap.val();
      if (data?.url) setBannerPreview(data.url);
    });
  }, []);

const startLiveClass = async (invites: string[], customId?: string) => {
    // Safety check: invites hamesha array hona chahiye
    const safeInvites = Array.isArray(invites) ? invites : [];
    
    const uniqueId = customId || `BPStudio${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    
    const classData = {
      meetingId: uniqueId,
      status: 'live',
      trainerName: user.name || 'Trainer',
      startTime: Date.now(),
      invitedUids: safeInvites // No more undefined
    };

    try {
      await set(ref(db, 'active_class'), classData);
      onStartMeeting(uniqueId);
    } catch (e) {
      console.error("Firebase Sync Error:", e);
      alert("Firebase update failed! Check internet or console.");
    }
  };
  
  const handleDeleteSchedule = async (schedId: string) => {
    if (confirm("Bhai, ye scheduled class uda du?")) {
      try {
        await remove(ref(db, `schedules/${schedId}`));
      } catch (e) {
        alert("Delete failed!");
      }
    }
  };

  const handleAddVideo = async () => {
    if (!activeCategoryId || !newVidTitle || !selectedFile) return;
    setIsSyncing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('resource_type', 'video');
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/do7jfmqqf/video/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        const vidId = Date.now().toString();
        await set(ref(db, `videos/${vidId}`), {
          id: vidId, categoryId: activeCategoryId, title: newVidTitle, url: data.secure_url, addedOn: Date.now()
        });
        alert("Video Deployed!");
        setNewVidTitle(''); setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (e) { alert("Upload Failed!"); } finally { setIsSyncing(false); }
  };


const handleDeleteCategory = async (catId: string) => {
  if (confirm('Delete this folder and its video links? Storage files must be deleted manually.')) {
    // 1. Is category ke saare video metadata ko dhundo aur remove karo
    const categoryVideos = videos.filter(v => v.categoryId === catId);
    for (const vid of categoryVideos) {
      await remove(ref(db, `videos/${vid.id}`));
    }
    
    // 2. Category ko remove karo
    await remove(ref(db, `video_categories/${catId}`));
    alert("Folder and links cleared. Check storage for orphaned files.");
  }
};

const handleDeleteVideo = async (vidId: string) => {
  if (!confirm("Are you sure? This will remove the video from the vault.")) return;

  try {
    // FIXED: Cloudinary files cannot be deleted using Firebase deleteObject.
    // We only remove the reference from the Realtime Database.
    await remove(ref(db, `videos/${vidId}`));
    
    alert("Video removed from Vault!");
  } catch (e) {
    console.error("Deletion error:", e);
    alert("Failed to remove video metadata.");
  }
};




// --- VAULT HANDLERS ---
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const catId = Date.now().toString();
    const newCat = { id: catId, name: newCatName.trim() };
    // Path: video_categories/123456...
    await set(ref(db, `video_categories/${catId}`), newCat);
    setNewCatName(''); setIsAddingCategory(false); setActiveCategoryId(catId);
  };






  // --- CRM / BRANDING HANDLERS ---
const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsSyncing(true);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET); // "balancepro" use karein
  formData.append('resource_type', 'image');

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/do7jfmqqf/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.secure_url) {
      // Seedha URL database mein save karein
      await set(ref(db, 'trending_banner'), { 
        url: data.secure_url, // 'id' ki jagah seedha 'url' save karein
        updatedOn: Date.now(),
        status: 'active'
      });
      setBannerPreview(data.secure_url);
      alert("Studio Banner Updated!");
    }
  } catch (err) {
    alert("Failed to update banner.");
  } finally {
    setIsSyncing(false);
  }
};

  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberPhone || !newMemberCode) return;
    const uid = `user_${newMemberPhone}`;
    const newUser: UserProfile = { 
      uid, 
      name: newMemberName, 
      phone: newMemberPhone, 
      role: UserRole.CLIENT, 
      registeredOn: Date.now(), 
      accessCode: newMemberCode 
    };
    await set(ref(db, `users/${uid}`), newUser);
    setNewMemberName(''); setNewMemberPhone(''); setNewMemberCode('');
  };

  const handleDeleteClient = async (uid: string) => {
    if (confirm("Permanently remove this member from BalancePro?")) {
      await remove(ref(db, `users/${uid}`));
      await remove(ref(db, `prescriptions/${uid}`));
    }
  };

  // --- DIET HANDLERS ---
  const handlePrescribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForDiet) return;
    const plan: DietPlan = { 
      id: Date.now().toString(), 
      date: Date.now(), 
      nutrients, 
      meals, 
      notes: "Coach Nitesh Plan" 
    };
    await set(ref(db, `prescriptions/${selectedClientForDiet}`), plan);
    setNutrients(''); setMeals(''); alert("Protocol deployed to cloud.");
  };



  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle || !schedTime) {
      alert("Title and Time are required!");
      return;
    }

    const schedId = Date.now().toString();
    const newSchedule: ScheduleItem = {
      id: schedId,
      title: schedTitle,
      time: new Date(schedTime).toLocaleString(),
      timestamp: new Date(schedTime).getTime(),
      trainer: user.name || 'Trainer',
      invitedUids: selectedInvites || [] // Ensure it's never undefined
    };

    try {
      await set(ref(db, `schedules/${schedId}`), newSchedule);
      // Reset everything after success
      setSchedTitle('');
      setSchedTime('');
      setSelectedInvites([]); // Clear selection for next time
      setShowScheduleForm(false);
    } catch (e) {
      console.error("Schedule Save Error:", e);
      alert("Failed to save schedule.");
    }
  };

return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl w-fit mx-auto shadow-2xl">
        {[{ id: 'classes', label: 'Live' }, { id: 'clients', label: 'Diet' }, { id: 'media', label: 'Vault' }, { id: 'management', label: 'CRM' }].map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id as any)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === tab.id ? 'bg-lime-400 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-white'}`}>{tab.label}</button>
        ))}
      </div>

      {/* LIVE VIEW */}
      {view === 'classes' && (
        <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
           <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-xl">
              <h3 className="text-zinc-500 text-[10px] font-black uppercase mb-8 tracking-[0.2em]">Studio Launch</h3>
              {isLive ? (
                 <div className="space-y-4">
                    <div className="p-10 bg-lime-400/5 border border-lime-400/20 rounded-[24px] text-center animate-pulse"><p className="text-lime-400 font-black uppercase tracking-widest text-xs">Studio is Live</p></div>
                    
                    <button 
                      onClick={() => activeClassData && onStartMeeting(activeClassData.meetingId)} 
                      className="w-full bg-lime-400 text-zinc-950 py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-lime-400/20"
                    >
                      Enter Active Session
                    </button>
                    
                    {/* FIXED: End session now clears the live status for everyone */}
                    <button onClick={() => remove(ref(db, 'active_class'))} className="w-full border border-zinc-800 text-zinc-500 py-5 rounded-2xl font-black text-xs hover:bg-red-500/10 hover:text-red-500 transition-colors">
                      End Session & Close Studio
                    </button>
                 </div>
              ) : (
                <div className="space-y-6">
                   <div className="max-h-60 overflow-y-auto bg-zinc-950/50 rounded-2xl p-2 border border-zinc-800">
                      {clients.map(c => (
                        <label key={c.uid} className="flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl cursor-pointer">
                          <input type="checkbox" checked={selectedInvites.includes(c.uid)} onChange={() => setSelectedInvites(prev => prev.includes(c.uid) ? prev.filter(i=>i!==c.uid) : [...prev, c.uid])} className="accent-lime-400 w-5 h-5 rounded-lg" />
                          <span className="text-sm font-bold text-white uppercase italic">{c.name}</span>
                        </label>
                      ))}
                   </div>
                   <button onClick={() => startLiveClass(selectedInvites)} className="w-full bg-lime-400 text-zinc-950 py-6 rounded-3xl font-black text-xl italic uppercase shadow-2xl shadow-lime-400/10 active:scale-95 transition-all">Go Live Now</button>
                </div>
              )}
           </div>

           <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col h-[600px] shadow-xl">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Upcoming</h3>
                <button onClick={() => setShowScheduleForm(true)} className="text-lime-400 text-[10px] font-black uppercase tracking-widest bg-lime-400/10 px-4 py-2 rounded-full border border-lime-400/20">+ Schedule</button>
             </div>
             {showScheduleForm ? (
                <form onSubmit={handleScheduleSubmit} className="space-y-4">
                   <input value={schedTitle} onChange={e => setSchedTitle(e.target.value)} placeholder="Session Title" className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-xl text-white outline-none font-bold" />
                   <input type="datetime-local" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-xl text-white outline-none" />
                   <div className="flex gap-2">
                      <button type="button" onClick={() => setShowScheduleForm(false)} className="flex-1 text-[10px] font-black uppercase text-zinc-500">Cancel</button>
                      <button type="submit" className="flex-1 bg-lime-400 text-zinc-950 py-3 rounded-xl text-[10px] font-black uppercase">Save</button>
                   </div>
                </form>
             ) : (
                <div className="space-y-4 overflow-y-auto">
                   {schedules.map(item => (
                     <div key={item.id} className="p-5 bg-zinc-800/40 rounded-[20px] border border-zinc-800 flex justify-between items-center group">
                       <div>
                         <span className="block font-black text-white italic uppercase">{item.title}</span>
                         <span className="text-[10px] text-zinc-600 font-bold uppercase">{item.time}</span>
                       </div>
                       
                       <div className="flex gap-2">
                         {/* FIXED: Launch now correctly triggers startLiveClass with invited users */}
                         <button 
                           onClick={() => startLiveClass(item.invitedUids || [])} 
                           className="bg-zinc-800 text-lime-400 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-lime-400/20 hover:bg-lime-400 hover:text-zinc-950 transition-all"
                         >
                           Launch
                         </button>
                         
                         {/* NEW: Delete Button for Scheduled Classes */}
                         <button 
                           onClick={() => confirm('Delete schedule?') && remove(ref(db, `schedules/${item.id}`))} 
                           className="bg-zinc-900 text-red-500 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                         >
                           Del
                         </button>
                       </div>
                     </div>
                   ))}
                </div>
             )}
           </div>
        </div>
      )}

      {/* DIET VIEW */}
      {view === 'clients' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 max-w-2xl mx-auto shadow-2xl animate-in fade-in">
          <h3 className="text-3xl font-black italic uppercase text-white mb-10 leading-none">Issue Prescription</h3>
          <form onSubmit={handlePrescribe} className="space-y-8">
            <select value={selectedClientForDiet} onChange={(e) => setSelectedClientForDiet(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 p-5 rounded-2xl text-white font-bold outline-none focus:border-lime-400">
              <option value="">Select Member...</option>
              {clients.map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}
            </select>
            <textarea value={nutrients} onChange={(e) => setNutrients(e.target.value)} placeholder="Nutrient Goals (Protein, Carbs, Fats...)" className="w-full bg-zinc-800 border border-zinc-700 p-6 rounded-3xl h-32 text-white font-medium outline-none focus:border-lime-400" />
            <textarea value={meals} onChange={(e) => setMeals(e.target.value)} placeholder="Daily Meal Protocol..." className="w-full bg-zinc-800 border border-zinc-700 p-6 rounded-3xl h-32 text-white font-medium outline-none focus:border-lime-400" />
            <button type="submit" className="w-full bg-lime-400 text-zinc-950 font-black py-6 rounded-[24px] text-xs uppercase tracking-widest shadow-2xl shadow-lime-400/20">Deliver Protocol</button>
          </form>
        </div>
      )}

      {/* VAULT VIEW */}
      {view === 'media' && (
        <div className="grid gap-6 md:grid-cols-[300px_1fr] animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 h-fit shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Folders</h3>
              <button onClick={() => { setIsAddingCategory(true); setTimeout(() => catInputRef.current?.focus(), 100); }} className="bg-lime-400 text-zinc-950 w-8 h-8 rounded-full font-black text-xl hover:scale-110 active:scale-95 transition-transform">+</button>
            </div>
            <div className="space-y-3">
              {isAddingCategory && (
                <div className="space-y-2 mb-4 p-4 bg-zinc-800/50 rounded-2xl">
                  <input ref={catInputRef} value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Name" className="w-full bg-zinc-800 border-2 border-lime-400/50 p-3 rounded-xl text-white text-xs outline-none font-bold" />
                  <div className="flex gap-2">
                    <button onClick={() => setIsAddingCategory(false)} className="flex-1 text-[9px] font-black uppercase text-zinc-500">✕</button>
                    <button onClick={handleAddCategory} className="flex-1 bg-lime-400 text-zinc-950 py-2 rounded-xl text-[9px] font-black uppercase">Add</button>
                  </div>
                </div>
              )}
              {categories.map((cat) => (
                <div key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={`flex items-center justify-between p-4 rounded-[20px] cursor-pointer transition-all ${activeCategoryId === cat.id ? 'bg-lime-400 text-zinc-950 shadow-lg' : 'bg-zinc-800/30 text-zinc-500 hover:bg-zinc-800'}`}>
                  <span className="text-sm font-black uppercase italic">{cat.name}</span>
                  {/* FIXED: Firebase delete with ID */}
                  <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete folder?')) remove(ref(db, `video_categories/${cat.id}`)); }} className="text-xs opacity-30 hover:opacity-100 p-1">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-10 min-h-[600px] shadow-xl">
            {activeCategoryId ? (
              <div className="space-y-10">
                <div className="p-8 bg-zinc-950/50 rounded-[32px] border border-zinc-800">
                   <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em] mb-6">Publish MP4 Drill</h3>
                   <div className="grid gap-6">
                      <input value={newVidTitle} onChange={e => setNewVidTitle(e.target.value)} placeholder="Exercise Name" className="w-full bg-zinc-800 border border-zinc-700 px-6 py-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-lime-400" />
                      <div className="relative group">
                        <input ref={fileInputRef} type="file" accept="video/mp4" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="hidden" id="mp4-upload" />
                        <label htmlFor="mp4-upload" className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[24px] p-10 cursor-pointer transition-all ${selectedFile ? 'border-lime-400 bg-lime-400/5' : 'border-zinc-800 bg-zinc-800/20 hover:border-zinc-700'}`}>
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{selectedFile ? selectedFile.name : 'Select MP4 Drill'}</span>
                          {selectedFile && <span className="text-[9px] text-zinc-600 mt-1 uppercase">{(selectedFile.size / (1024*1024)).toFixed(1)} MB</span>}
                        </label>
                      </div>
                      <button onClick={handleAddVideo} disabled={isSyncing || !selectedFile || !newVidTitle} className={`w-full bg-lime-400 text-zinc-950 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50`}>
                        {isSyncing ? 'Syncing to Lab...' : 'Deploy to Vault'}
                      </button>
                   </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                   {videos.filter(v => v.categoryId === activeCategoryId).map(vid => (
                     <div key={vid.id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-[32px] p-6 group hover:border-lime-400/30 transition-all">
                        <div className="aspect-video bg-zinc-950 rounded-[20px] flex items-center justify-center relative mb-4">
                           <svg className="w-10 h-10 text-zinc-800 group-hover:text-lime-400 transition-all" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                           {/* FIXED: Firebase individual video delete */}
                           <button 
  onClick={() => handleDeleteVideo(vid.id)} 
  className="absolute top-2 right-2 bg-zinc-950/80 text-white hover:text-red-500 p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
>
</button>
                        </div>
                        <span className="block font-black text-white text-base italic uppercase">{vid.title}</span>
                     </div>
                   ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-700 font-black uppercase text-[10px] tracking-widest">Select Folder to Manage Vault</div>
            )}
          </div>
        </div>
      )}

      {/* CRM VIEW */}
      {view === 'management' && (
        <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
           <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 h-fit shadow-xl">
                 <h3 className="text-white font-black text-xl mb-6 italic uppercase">Registry</h3>
                 <form onSubmit={handleRegisterMember} className="space-y-4">
                   <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Full Name" className="w-full bg-zinc-800 p-4 rounded-xl text-white font-bold outline-none border border-zinc-700 focus:border-lime-400" />
                   <input value={newMemberPhone} onChange={e => setNewMemberPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-zinc-800 p-4 rounded-xl text-white font-bold outline-none border border-zinc-700 focus:border-lime-400" />
                   <input value={newMemberCode} onChange={e => setNewMemberCode(e.target.value)} placeholder="Access Code" className="w-full bg-zinc-800 p-4 rounded-xl text-white font-bold outline-none border border-zinc-700 focus:border-lime-400" />
                   <button type="submit" className="w-full bg-lime-400 text-zinc-950 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform">Authorize Member</button>
                 </form>
              </div>

              {/* STUDIO BRANDING SECTION */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-xl">
                 <h3 className="text-white font-black text-lg mb-4 italic uppercase tracking-tight">Today's Trending</h3>
                 <div className="space-y-4">
                    <div className="relative aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                       {bannerPreview ? (
                         <img src={bannerPreview} alt="Trending" className="w-full h-full object-cover" />
                       ) : (
                         <div className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">No Banner Uploaded</div>
                       )}
                    </div>
                    <label className="block w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-4 rounded-xl text-center cursor-pointer border border-zinc-700 transition-all">
                       <span className="text-[10px] font-black uppercase tracking-widest">{isSyncing ? 'Processing...' : 'Upload Daily Image (JPG)'}</span>
                       <input type="file" accept="image/jpeg,image/jpg" className="hidden" onChange={handleBannerUpload} disabled={isSyncing} />
                    </label>
                 </div>
              </div>
           </div>

           <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 h-full min-h-[600px] overflow-y-auto shadow-xl">
              <h3 className="text-zinc-500 text-[10px] font-black uppercase mb-8 tracking-[0.2em]">Member Directory</h3>
              <div className="space-y-3">
                 {clients.map(client => (
                   <div key={client.uid} className="p-4 bg-zinc-800/40 rounded-2xl border border-zinc-800 flex justify-between items-center group hover:border-lime-400/30 transition-all">
                      <div className="flex flex-col">
                        <span className="text-white font-black italic uppercase">{client.name}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-zinc-500 font-bold">{client.phone}</span>
                           <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                           <span className="text-[10px] text-lime-400 font-bold tracking-widest uppercase">Key: {client.accessCode}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteClient(client.uid)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                   </div>
                 ))}
                 {clients.length === 0 && (
                   <div className="text-center py-20 opacity-20"><p className="text-[10px] font-black uppercase tracking-[0.2em]">Registry Empty</p></div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
export default TrainerHome;
