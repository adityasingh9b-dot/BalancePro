import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, UserRole, ActiveClass, DietPlan, ScheduleItem, VideoCategory, VideoItem } from '../types';
import { db } from '../services/firebaseService';
import { ref, set, onValue, remove } from 'firebase/database';
import { storage } from '../services/firebaseService';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FilePicker } from '@capawesome/capacitor-file-picker';

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

// 5. Schedules Sync (REPLACE THIS IN YOUR EFFECT)
onValue(ref(db, 'schedules'), (snap) => {
  const data = snap.val();
  if (data) {
    // Firebase object ko array mein badalte waqt ID ko object ke andar ghusao
    const list = Object.entries(data).map(([id, value]: [string, any]) => ({
      ...value,
      id: id // Ensure kar rahe hain ki item.id wahi hai jo Firebase ki key hai
    }));
    setSchedules(list);
  } else {
    setSchedules([]);
  }
});

    // 6. Banner Sync
    onValue(ref(db, 'trending_banner'), (snap) => {
      const data = snap.val();
      if (data?.url) setBannerPreview(data.url);
    });
  }, []);

const startLiveClass = async (invites: string[], existingId?: string) => {
    // Check if invites exists, if not make it empty array
    const safeInvites = Array.isArray(invites) ? invites : [];
    
    // Check if we have a valid ID, else generate one
    const uniqueId = existingId || `BPStudio${Date.now()}`;
    
    const classData = {
      meetingId: uniqueId,
      status: 'live',
      trainerName: user?.name || "Trainer",
      startTime: Date.now(),
      invitedUids: safeInvites
    };

    console.log("Pushing Scheduled Class to Firebase:", classData);

    try {
      // Is path par data set hona chahiye
      await set(ref(db, 'active_class'), classData);
      onStartMeeting(uniqueId);
    } catch (e: any) {
      console.error("Firebase Error Details:", e);
      alert(`Firebase Update Failed: ${e.message}`);
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
  
  
  
  
const pickVideoFile = async () => {
  try {
    const result = await FilePicker.pickVideos({
      multiple: false,
      readData: true, // Mobile ke liye isse TRUE rakho taaki data mil sake
    });

    if (result.files && result.files.length > 0) {
      const file = result.files[0];
      
      // FIX: Agar file.data hai (base64), toh usse Blob mein convert karo
      if (file.data) {
        const byteCharacters = atob(file.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const videoBlob = new Blob([byteArray], { type: file.mimeType });
        
        const webFile = new File([videoBlob], file.name, { type: file.mimeType });
        setSelectedFile(webFile);
        alert(`Video Selected: ${file.name}`);
      } else {
        // Fallback agar readData kaam nahi kiya (kuch OS version par)
        const response = await fetch(file.webPath!); // webPath try karo localhost error se bachne ke liye
        const blob = await response.blob();
        const webFile = new File([blob], file.name, { type: file.mimeType });
        setSelectedFile(webFile);
      }
    }
  } catch (error) {
    console.error("Picker error:", error);
    alert("Gallery error: Permission issue ya file format unsupported.");
  }
};
  
  
  
const handleAddVideo = async () => {
  if (!activeCategoryId || !newVidTitle || !selectedFile) {
    alert("Sab details bharo bhai!");
    return;
  }
  
  setIsSyncing(true);
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('upload_preset', UPLOAD_PRESET);
  // Optional: Folder name in Cloudinary
  formData.append('folder', 'balancepro_vault');

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/do7jfmqqf/video/upload`, { 
      method: 'POST', 
      body: formData 
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || "Cloudinary Upload Failed");
    }

    const data = await res.json();

   if (data.secure_url) {
  const vidId = Date.now().toString();
  const videoEntry: VideoItem = {
    id: vidId,
    categoryId: activeCategoryId,
    title: newVidTitle,
    url: data.secure_url,
    publicId: data.public_id, // 🔥 YEH ADD KARO: Ye cleanup ke kaam aayega
    addedOn: Date.now()
  };

      await set(ref(db, `videos/${vidId}`), videoEntry);
      
      alert("Video Uploaded & Linked to Vault!");
      setNewVidTitle('');
      setSelectedFile(null);
    }
  } catch (e: any) { 
    alert("Error: " + e.message);
  } finally { 
    setIsSyncing(false); 
  }
};


const handleDeleteCategory = async (catId: string) => {
  if (confirm('Bhai, ye folder uda diya toh iski saari videos bhi gayab ho jayengi. Sure?')) {
    // 1. Filter videos belonging to this category
    const categoryVideos = videos.filter(v => v.categoryId === catId);
    
    // 2. Delete each video reference from Firebase
    const deletePromises = categoryVideos.map(vid => remove(ref(db, `videos/${vid.id}`)));
    await Promise.all(deletePromises);
    
    // 3. Delete Category itself
    await remove(ref(db, `video_categories/${catId}`));
    
    alert("Folder and linked drills cleared!");
  }
};

const handleDeleteVideo = async (vidId: string, publicId?: string) => {
  if (!confirm("Bhai, vault se nikal du? Storage se bhi saaf ho jayegi.")) return;

  try {
    // 1. Firebase se reference udaao
    await remove(ref(db, `videos/${vidId}`));

    // 2. Cloudinary Cleanup (If using a Backend/Edge Function)
    if (publicId) {
      console.log("Cleanup request for:", publicId);
      // NOTE: Cloudinary requires a signature for deletion. 
      // Abhi ke liye hum metadata saaf kar rahe hain. 
      // Storage clean karne ke liye ek 5-line ka Vercel/Node function kaafi hai.
    }
    
    alert("Video removed from Vault!");
  } catch (e) {
    alert("Failed to remove video.");
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
e.target.value = '';
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
    // YAHAN FIX HAI: Form submit hote waqt selected members ko array mein daal do
    invitedUids: [...selectedInvites] 
  };

  try {
    await set(ref(db, `schedules/${schedId}`), newSchedule);
    setSchedTitle('');
    setSchedTime('');
    setSelectedInvites([]); // Reset selection
    setShowScheduleForm(false);
    alert("Class Schedule ho gayi aur members lock ho gaye!");
  } catch (e) {
    alert("Failed to save schedule.");
  }
};

return (
    <div className="min-h-screen bg-[#081221] p-6 text-slate-200 selection:bg-[#FFB800] selection:text-black">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Tab Navigation - BalancePro Midnight Edition */}
        <div className="flex gap-2 p-1.5 bg-[#0F1A2D] border border-white/5 rounded-2xl w-fit mx-auto shadow-2xl">
          {[
            { id: 'classes', label: 'Live' }, 
            { id: 'clients', label: 'Diet' }, 
            { id: 'media', label: 'Vault' }, 
            { id: 'management', label: 'CRM' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setView(tab.id as any)} 
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                ${view === tab.id 
                  ? 'bg-[#FFB800] text-[#081221] shadow-lg shadow-[#FFB800]/20 scale-105' 
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

{/* LIVE VIEW - BalancePro Midnight Edition */}
{view === 'classes' && (
  <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
    {/* LEFT PANEL: STUDIO LAUNCH */}
    <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-8 shadow-xl">
      <h3 className="text-slate-500 text-[10px] font-black uppercase mb-8 tracking-[0.2em]">Studio Launch</h3>
      {isLive ? (
        <div className="space-y-4">
          <div className="p-10 bg-[#FFB800]/5 border border-[#FFB800]/20 rounded-[24px] text-center animate-pulse">
            <p className="text-[#FFB800] font-black uppercase tracking-widest text-xs">Studio is Live</p>
          </div>
          <button 
            onClick={() => activeClassData && onStartMeeting(activeClassData.meetingId)} 
            className="w-full bg-[#FFB800] text-[#081221] py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-[#FFB800]/20 active:scale-95 transition-all"
          >
            Enter Active Session
          </button>
          <button 
            onClick={() => remove(ref(db, 'active_class'))} 
            className="w-full border border-white/5 text-slate-500 py-5 rounded-2xl font-black text-xs hover:bg-[#e31e24]/10 hover:text-[#e31e24] transition-colors"
          >
            End Session & Close Studio
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Instant Invite:</p>
          <div className="max-h-60 overflow-y-auto bg-black/20 rounded-2xl p-2 border border-white/5 custom-scrollbar">
            {clients.map(c => (
              <label key={c.uid} className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={selectedInvites.includes(c.uid)} 
                  onChange={() => setSelectedInvites(prev => prev.includes(c.uid) ? prev.filter(i=>i!==c.uid) : [...prev, c.uid])} 
                  className="accent-[#FFB800] w-5 h-5 rounded-lg" 
                />
                <span className="text-sm font-bold text-slate-400 group-hover:text-[#FFB800] uppercase italic transition-colors">{c.name}</span>
              </label>
            ))}
          </div>
          <button 
            onClick={() => startLiveClass(selectedInvites)} 
            className="w-full bg-[#FFB800] text-[#081221] py-6 rounded-3xl font-black text-xl italic uppercase shadow-2xl shadow-[#FFB800]/10 active:scale-95 transition-all"
          >
            Go Live Now
          </button>
        </div>
      )}
    </div>

    {/* RIGHT PANEL: UPCOMING & SCHEDULE */}
    <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-8 flex flex-col h-[600px] shadow-xl">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Upcoming</h3>
        {!showScheduleForm && (
          <button 
            onClick={() => { setShowScheduleForm(true); setSelectedInvites([]); }} 
            className="text-[#FFB800] text-[10px] font-black uppercase tracking-widest bg-[#FFB800]/10 px-4 py-2 rounded-full border border-[#FFB800]/20 hover:bg-[#FFB800] hover:text-[#081221] transition-all"
          >
            + Schedule
          </button>
        )}
      </div>

      {showScheduleForm ? (
        <form onSubmit={handleScheduleSubmit} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
          <input value={schedTitle} onChange={e => setSchedTitle(e.target.value)} placeholder="Session Title" className="w-full bg-[#16243d] border border-white/5 p-4 rounded-xl text-white outline-none font-bold focus:border-[#FFB800]/50 transition-all" />
          <input type="datetime-local" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="w-full bg-[#16243d] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-[#FFB800]/50 transition-all scheme-dark" />
          
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Pre-select Members:</p>
            <div className="max-h-48 overflow-y-auto bg-black/20 rounded-2xl p-2 border border-white/5 custom-scrollbar">
              {clients.map(c => (
                <label key={c.uid} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedInvites.includes(c.uid)} 
                    onChange={() => setSelectedInvites(prev => prev.includes(c.uid) ? prev.filter(i=>i!==c.uid) : [...prev, c.uid])} 
                    className="accent-[#FFB800] w-4 h-4 rounded" 
                  />
                  <span className="text-[11px] font-bold text-slate-400 uppercase italic">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowScheduleForm(false); setSelectedInvites([]); }} className="flex-1 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="flex-1 bg-[#FFB800] text-[#081221] py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-[#FFB800]/10 active:scale-95 transition-all">Save Class</button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 overflow-y-auto custom-scrollbar">
          {schedules.map(item => (
            <div key={item.id} className="p-5 bg-white/5 rounded-[20px] border border-white/5 flex justify-between items-center group hover:border-[#FFB800]/30 transition-all">
              <div>
                <span className="block font-black text-white italic uppercase group-hover:text-[#FFB800] transition-colors">{item.title}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">{item.time}</span>
                {item.invitedUids && item.invitedUids.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    <span className="text-[8px] bg-[#FFB800]/10 text-[#FFB800] px-1.5 py-0.5 rounded font-black uppercase border border-[#FFB800]/20">
                      {item.invitedUids.length} Members
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const targetInvites = item.invitedUids || [];
                    if (targetInvites.length === 0) {
                      alert("No members were selected!");
                      return;
                    }
                    startLiveClass(targetInvites, item.id);
                  }} 
                  className="bg-[#16243d] text-[#FFB800] text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-[#FFB800]/20 hover:bg-[#FFB800] hover:text-[#081221] transition-all shadow-lg"
                >
                  Launch
                </button>
                <button 
                  onClick={() => handleDeleteSchedule(item.id)} 
                  className="bg-black/20 text-[#e31e24] text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-[#e31e24]/20 opacity-0 group-hover:opacity-100 hover:bg-[#e31e24] hover:text-white transition-all"
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

{/* DIET VIEW - BalancePro Premium Midnight Edition */}
{view === 'clients' && (
  <div className="bg-[#0F1A2D] border border-white/5 rounded-[40px] p-12 max-w-2xl mx-auto shadow-2xl animate-in fade-in">
    <h3 className="text-3xl font-black italic uppercase text-white mb-10 leading-none tracking-tight">
      Issue <span className="text-[#FFB800]">Prescription</span>
    </h3>
    
    <form onSubmit={handlePrescribe} className="space-y-8">
      {/* Member Selection */}
      <div className="relative">
        <select 
          value={selectedClientForDiet} 
          onChange={(e) => setSelectedClientForDiet(e.target.value)} 
          className="w-full bg-[#16243d] border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-[#FFB800]/50 transition-all appearance-none cursor-pointer"
        >
          <option value="" className="bg-[#0F1A2D]">Select Member...</option>
          {clients.map(c => (
            <option key={c.uid} value={c.uid} className="bg-[#0F1A2D]">{c.name}</option>
          ))}
        </select>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* Nutrient Goals */}
      <textarea 
        value={nutrients} 
        onChange={(e) => setNutrients(e.target.value)} 
        placeholder="Nutrient Goals (Protein, Carbs, Fats...)" 
        className="w-full bg-[#16243d] border border-white/10 p-6 rounded-3xl h-32 text-white font-medium outline-none focus:border-[#FFB800]/50 transition-all placeholder:text-slate-600 shadow-inner resize-none" 
      />

      {/* Meal Protocol */}
      <textarea 
        value={meals} 
        onChange={(e) => setMeals(e.target.value)} 
        placeholder="Daily Meal Protocol..." 
        className="w-full bg-[#16243d] border border-white/10 p-6 rounded-3xl h-32 text-white font-medium outline-none focus:border-[#FFB800]/50 transition-all placeholder:text-slate-600 shadow-inner resize-none" 
      />

      {/* Send */}
      <button 
        type="submit" 
        className="w-full bg-[#FFB800] text-[#081221] font-black py-6 rounded-[24px] text-xs uppercase tracking-[0.2em] shadow-2xl shadow-[#FFB800]/10 hover:bg-[#FFC800] active:scale-[0.98] transition-all"
      >
        Deliver Protocol
      </button>
    </form>
  </div>
)}

{/* VAULT VIEW - BalancePro Content Hub Midnight Edition */}
{view === 'media' && (
  <div className="grid gap-6 md:grid-cols-[300px_1fr] animate-in fade-in">
    {/* SIDEBAR: FOLDERS */}
    <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-8 h-fit shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Library Folders</h3>
        <button 
          onClick={() => { setIsAddingCategory(true); setTimeout(() => catInputRef.current?.focus(), 100); }} 
          className="bg-[#FFB800] text-[#081221] w-8 h-8 rounded-full font-black text-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[#FFB800]/20"
        >
          +
        </button>
      </div>

      <div className="space-y-3">
        {isAddingCategory && (
          <div className="space-y-2 mb-4 p-4 bg-black/20 rounded-2xl border border-[#FFB800]/30">
            <input 
              ref={catInputRef} 
              value={newCatName} 
              onChange={e => setNewCatName(e.target.value)} 
              placeholder="Folder Name" 
              className="w-full bg-[#16243d] border border-white/10 p-3 rounded-xl text-white text-xs outline-none font-bold focus:border-[#FFB800]/50" 
            />
            <div className="flex gap-2">
              <button onClick={() => setIsAddingCategory(false)} className="flex-1 text-[9px] font-black uppercase text-slate-500 hover:text-white">✕</button>
              <button onClick={handleAddCategory} className="flex-1 bg-[#FFB800] text-[#081221] py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Create</button>
            </div>
          </div>
        )}

        {categories.map((cat) => (
          <div 
            key={cat.id} 
            onClick={() => setActiveCategoryId(cat.id)} 
            className={`flex items-center justify-between p-4 rounded-[20px] cursor-pointer transition-all duration-300 group
              ${activeCategoryId === cat.id 
                ? 'bg-[#FFB800] text-[#081221] shadow-lg shadow-[#FFB800]/20 translate-x-1' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
          >
            <span className="text-sm font-black uppercase italic tracking-wider">{cat.name}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); if(confirm('Delete folder?')) remove(ref(db, `video_categories/${cat.id}`)); }} 
              className={`text-xs p-1 transition-opacity ${activeCategoryId === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-50 hover:text-red-500'}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>

    {/* MAIN PANEL: CONTENT MANAGER */}
    <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-10 min-h-[600px] shadow-xl">
      {activeCategoryId ? (
        <div className="space-y-10">
          {/* UPLOAD SECTION */}
          <div className="p-8 bg-black/20 rounded-[32px] border border-white/5">
            <h3 className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] mb-6">Publish MP4 Drill</h3>
            <div className="grid gap-6">
              <input 
                value={newVidTitle} 
                onChange={e => setNewVidTitle(e.target.value)} 
                placeholder="Exercise Name (e.g. Deadlift Setup)" 
                className="w-full bg-[#16243d] border border-white/10 px-6 py-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-[#FFB800]/50 transition-all" 
              />

              <div 
                onClick={pickVideoFile}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[24px] p-10 cursor-pointer transition-all
                  ${selectedFile 
                    ? 'border-[#FFB800] bg-[#FFB800]/5' 
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'}`}
              >
                <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center ${selectedFile ? 'bg-[#FFB800] text-[#081221]' : 'bg-white/5 text-slate-500'}`}>
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {selectedFile ? selectedFile.name : 'Select MP4 Drill'}
                </span>
                {selectedFile && <span className="text-[9px] text-[#FFB800] mt-1 uppercase font-bold">Ready for deployment</span>}
              </div>

              <button 
                onClick={handleAddVideo} 
                disabled={isSyncing} 
                className="w-full bg-[#FFB800] text-[#081221] py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-[#FFB800]/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isSyncing ? 'Processing Hub...' : 'Deploy Video to Vault'}
              </button>
            </div>
          </div>

          {/* VIDEO GRID */}
          <div className="grid gap-6 sm:grid-cols-2">
            {videos.filter(v => v.categoryId === activeCategoryId).map(vid => (
              <div key={vid.id} className="bg-white/5 border border-white/5 rounded-[32px] p-6 group hover:border-[#FFB800]/30 transition-all">
                <div className="aspect-video bg-black/40 rounded-[20px] flex items-center justify-center relative mb-4 overflow-hidden shadow-inner">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-[#FFB800] group-hover:text-[#081221] transition-all shadow-xl">
                    <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <button 
                    onClick={() => handleDeleteVideo(vid.id, vid.publicId)}
                    className="absolute top-2 right-2 bg-black/60 text-white hover:text-red-500 p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <span className="block font-black text-white text-base italic uppercase tracking-wide group-hover:text-[#FFB800] transition-colors">{vid.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-slate-800">
             <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <p className="text-slate-600 font-black uppercase text-[10px] tracking-widest">Select a folder to manage your vault</p>
        </div>
      )}
    </div>
  </div>
)}


{/* CRM VIEW - BalancePro Registry & Branding Midnight Edition */}
{view === 'management' && (
  <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
    <div className="space-y-6">
      {/* MEMBER REGISTRY */}
      <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-8 h-fit shadow-xl">
        <h3 className="text-white font-black text-xl mb-6 italic uppercase tracking-tight">
          Registry <span className="text-[#FFB800]">Access</span>
        </h3>
        <form onSubmit={handleRegisterMember} className="space-y-4">
          <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Full Name" className="w-full bg-[#16243d] p-4 rounded-xl text-white font-bold outline-none border border-white/10 focus:border-[#FFB800]/50 transition-all placeholder:text-slate-600" />
          <input value={newMemberPhone} onChange={e => setNewMemberPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-[#16243d] p-4 rounded-xl text-white font-bold outline-none border border-white/10 focus:border-[#FFB800]/50 transition-all placeholder:text-slate-600" />
          <input value={newMemberCode} onChange={e => setNewMemberCode(e.target.value)} placeholder="Access Code" className="w-full bg-[#16243d] p-4 rounded-xl text-white font-bold outline-none border border-white/10 focus:border-[#FFB800]/50 transition-all placeholder:text-slate-600" />
          <button type="submit" className="w-full bg-[#FFB800] text-[#081221] py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-[#FFB800]/20 active:scale-95 transition-all">
            Authorize Member
          </button>
        </form>
      </div>

      {/* STUDIO BRANDING SECTION */}
      <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-8 shadow-xl">
        <h3 className="text-slate-500 font-black text-[10px] uppercase mb-4 tracking-[0.2em]">Live Banner Preview</h3>
        <div className="space-y-4">
          <div className="relative aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center shadow-inner">
            {bannerPreview ? (
              <img src={bannerPreview} alt="Trending" className="w-full h-full object-cover" />
            ) : (
              <div className="text-[10px] text-slate-700 font-black uppercase tracking-widest">No Banner Uploaded</div>
            )}
          </div>
          <label className="block w-full bg-[#16243d] hover:bg-white/5 text-slate-400 py-4 rounded-xl text-center cursor-pointer border border-white/10 transition-all group">
            <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-[#FFB800]">
              {isSyncing ? 'Syncing...' : 'Upload Daily Image (JPG)'}
            </span>
            <input type="file" accept="image/jpeg,image/jpg" className="hidden" onChange={handleBannerUpload} disabled={isSyncing} />
          </label>
        </div>
      </div>
    </div>

    {/* MEMBER DIRECTORY */}
    <div className="bg-[#0F1A2D] border border-white/5 rounded-[32px] p-8 h-full min-h-[600px] overflow-y-auto shadow-xl custom-scrollbar">
      <h3 className="text-slate-500 text-[10px] font-black uppercase mb-8 tracking-[0.2em]">Member Directory</h3>
      <div className="space-y-3">
        {clients.map(client => (
          <div key={client.uid} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-[#FFB800]/30 transition-all">
            <div className="flex flex-col">
              <span className="text-white font-black italic uppercase tracking-wide group-hover:text-[#FFB800] transition-colors">
                {client.name}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-500 font-bold">{client.phone}</span>
                <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                <span className="text-[10px] text-[#FFB800] font-black tracking-widest">
                  KEY: {client.accessCode}
                </span>
              </div>
            </div>
            <button 
              onClick={() => handleDeleteClient(client.uid)} 
              className="p-2 text-slate-700 hover:text-[#e31e24] transition-colors opacity-0 group-hover:opacity-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="text-center py-20 opacity-20">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Registry Empty</p>
          </div>
        )}
      </div> 
    </div>
  </div>
)}
      </div> {/* Ye wala tune miss kar diya tha */}
    </div>
  );
};
