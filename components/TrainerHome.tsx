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
{/* Tab Navigation */}
<div className="flex gap-2 p-1.5 bg-[#0A192F] border border-white/10 rounded-2xl w-fit mx-auto shadow-2xl">
  {[{ id: 'classes', label: 'Live' }, { id: 'clients', label: 'Diet' }, { id: 'media', label: 'Vault' }, { id: 'management', label: 'CRM' }].map(tab => (
    <button 
      key={tab.id} 
      onClick={() => setView(tab.id as any)} 
      className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        view === tab.id 
        ? 'bg-[#FF8C00] text-white shadow-lg' 
        : 'text-white/40 hover:text-white'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>

{/* LIVE VIEW */}
{view === 'classes' && (
  <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
    
    {/* LEFT PANEL: DIRECT GO LIVE */}
<div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-xl">
  <h3 className="text-[#0A192F]/40 text-[10px] font-black uppercase mb-8 tracking-[0.2em]">Studio Launch</h3>
  {isLive ? (
    <div className="space-y-4">
      <div className="p-10 bg-[#FF8C00]/5 border border-[#FF8C00]/20 rounded-[24px] text-center animate-pulse">
        <p className="text-[#FF8C00] font-black uppercase tracking-widest text-xs">Studio is Live</p>
      </div>
      <button 
        onClick={() => activeClassData && onStartMeeting(activeClassData.meetingId)} 
        className="w-full bg-[#0A192F] text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-[#0A192F]/20"
      >
        Enter Active Session
      </button>
      <button onClick={() => remove(ref(db, 'active_class'))} className="w-full border border-red-100 text-red-500 py-5 rounded-2xl font-black text-xs hover:bg-red-50 transition-colors">
        End Session & Close Studio
      </button>
    </div>
  ) : (
    <div className="space-y-6">
      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Instant Invite:</p>
      <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-2xl p-2 border border-gray-100">
        {clients.map(c => (
          <label key={c.uid} className="flex items-center gap-4 p-4 hover:bg-white rounded-xl cursor-pointer">
            <input type="checkbox" checked={selectedInvites.includes(c.uid)} onChange={() => setSelectedInvites(prev => prev.includes(c.uid) ? prev.filter(i=>i!==c.uid) : [...prev, c.uid])} className="accent-[#FF8C00] w-5 h-5 rounded-lg" />
            <span className="text-sm font-bold text-[#0A192F] uppercase italic">{c.name}</span>
          </label>
        ))}
      </div>
      <button onClick={() => startLiveClass(selectedInvites)} className="w-full bg-[#0A192F] text-white py-6 rounded-3xl font-black text-xl italic uppercase shadow-2xl shadow-[#0A192F]/20 active:scale-95 transition-all">Go Live Now</button>
    </div>
  )}
</div>

    {/* RIGHT PANEL: UPCOMING & SCHEDULE FORM */}
    <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col h-[600px] shadow-xl">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Upcoming</h3>
        {!showScheduleForm && (
          <button onClick={() => { setShowScheduleForm(true); setSelectedInvites([]); }} className="text-lime-400 text-[10px] font-black uppercase tracking-widest bg-lime-400/10 px-4 py-2 rounded-full border border-lime-400/20">+ Schedule</button>
        )}
      </div>

      {showScheduleForm ? (
        <form onSubmit={handleScheduleSubmit} className="space-y-4 overflow-y-auto pr-2">
          <input value={schedTitle} onChange={e => setSchedTitle(e.target.value)} placeholder="Session Title" className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-xl text-white outline-none font-bold" />
          <input type="datetime-local" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-xl text-white outline-none" />
          
          <div className="space-y-2">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Pre-select Members for this slot:</p>
            <div className="max-h-48 overflow-y-auto bg-zinc-950/50 rounded-2xl p-2 border border-zinc-800">
              {clients.map(c => (
                <label key={c.uid} className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedInvites.includes(c.uid)} 
                    onChange={() => setSelectedInvites(prev => prev.includes(c.uid) ? prev.filter(i=>i!==c.uid) : [...prev, c.uid])} 
                    className="accent-lime-400 w-4 h-4 rounded" 
                  />
                  <span className="text-[11px] font-bold text-zinc-300 uppercase italic">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowScheduleForm(false); setSelectedInvites([]); }} className="flex-1 text-[10px] font-black uppercase text-zinc-500">Cancel</button>
            <button type="submit" className="flex-1 bg-lime-400 text-zinc-950 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-400/10">Save Class</button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 overflow-y-auto">
          {schedules.map(item => (
            <div key={item.id} className="p-5 bg-zinc-800/40 rounded-[20px] border border-zinc-800 flex justify-between items-center group">
              <div>
                <span className="block font-black text-white italic uppercase">{item.title}</span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase">{item.time}</span>
                {item.invitedUids && item.invitedUids.length > 0 && (
                  <div className="flex gap-1 mt-1">
                     <span className="text-[8px] bg-lime-400/10 text-lime-400 px-1.5 py-0.5 rounded font-black uppercase">
                       {item.invitedUids.length} Members Pre-selected
                     </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    // YAHAN FIX: selectedInvites state nahi, item.invitedUids use kar rahe hain
                    const targetInvites = item.invitedUids || [];
                    if (targetInvites.length === 0) {
                      alert("No members were selected for this schedule!");
                      return;
                    }
                    startLiveClass(targetInvites, item.id);
                  }} 
                  className="bg-zinc-800 text-lime-400 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-lime-400/20 hover:bg-lime-400 hover:text-zinc-950 transition-all"
                >
                  Launch
                </button>
                <button 
                  onClick={() => handleDeleteSchedule(item.id)} 
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
  <div className="bg-white border border-gray-100 rounded-[40px] p-12 max-w-2xl mx-auto shadow-2xl animate-in fade-in">
    <h3 className="text-3xl font-black italic uppercase text-[#0A192F] mb-10 leading-none">Issue Prescription</h3>
    <form onSubmit={handlePrescribe} className="space-y-8">
      <select value={selectedClientForDiet} onChange={(e) => setSelectedClientForDiet(e.target.value)} className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl text-[#0A192F] font-bold outline-none focus:border-[#FF8C00]">
        <option value="">Select Member...</option>
        {clients.map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}
      </select>
      <textarea value={nutrients} onChange={(e) => setNutrients(e.target.value)} placeholder="Nutrient Goals (Protein, Carbs, Fats...)" className="w-full bg-gray-50 border border-gray-100 p-6 rounded-3xl h-32 text-[#0A192F] font-medium outline-none focus:border-[#FF8C00]" />
      <textarea value={meals} onChange={(e) => setMeals(e.target.value)} placeholder="Daily Meal Protocol..." className="w-full bg-gray-50 border border-gray-100 p-6 rounded-3xl h-32 text-[#0A192F] font-medium outline-none focus:border-[#FF8C00]" />
      <button type="submit" className="w-full bg-[#FF8C00] text-white font-black py-6 rounded-[24px] text-xs uppercase tracking-widest shadow-2xl shadow-[#FF8C00]/20">Deliver Protocol</button>
    </form>
  </div>
)}

{/* VAULT VIEW */}
{view === 'media' && (
  <div className="grid gap-6 md:grid-cols-[300px_1fr] animate-in fade-in">
    {/* LEFT PANEL: FOLDERS */}
    <div className="bg-[#0A192F] border border-white/10 rounded-[32px] p-8 h-fit shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white/40 font-black text-[10px] uppercase tracking-[0.2em]">Folders</h3>
        <button 
          onClick={() => { setIsAddingCategory(true); setTimeout(() => catInputRef.current?.focus(), 100); }} 
          className="bg-[#FF8C00] text-white w-8 h-8 rounded-full font-black text-xl hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-[#FF8C00]/20"
        >
          +
        </button>
      </div>
      
      <div className="space-y-3">
        {isAddingCategory && (
          <div className="space-y-2 mb-4 p-4 bg-white/5 rounded-2xl border border-white/10">
            <input 
              ref={catInputRef} 
              value={newCatName} 
              onChange={e => setNewCatName(e.target.value)} 
              placeholder="Name" 
              className="w-full bg-[#0A192F] border border-[#FF8C00]/50 p-3 rounded-xl text-white text-xs outline-none font-bold" 
            />
            <div className="flex gap-2">
              <button onClick={() => setIsAddingCategory(false)} className="flex-1 text-[9px] font-black uppercase text-white/40">✕</button>
              <button onClick={handleAddCategory} className="flex-1 bg-[#FF8C00] text-white py-2 rounded-xl text-[9px] font-black uppercase">Add</button>
            </div>
          </div>
        )}
        
        {categories.map((cat) => (
          <div 
            key={cat.id} 
            onClick={() => setActiveCategoryId(cat.id)} 
            className={`flex items-center justify-between p-4 rounded-[20px] cursor-pointer transition-all ${
              activeCategoryId === cat.id 
              ? 'bg-[#FF8C00] text-white shadow-lg' 
              : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            <span className="text-sm font-black uppercase italic">{cat.name}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); if(confirm('Delete folder?')) remove(ref(db, `video_categories/${cat.id}`)); }} 
              className={`text-xs p-1 transition-opacity ${activeCategoryId === cat.id ? 'text-white/60' : 'opacity-30 hover:opacity-100'}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>

    {/* RIGHT PANEL: VIDEO MANAGEMENT */}
    <div className="bg-white border border-gray-100 rounded-[32px] p-10 min-h-[600px] shadow-xl">
      {activeCategoryId ? (
        <div className="space-y-10">
          {/* UPLOAD SECTION */}
          <div className="p-8 bg-gray-50 rounded-[32px] border border-gray-100">
            <h3 className="text-[#0A192F]/40 font-black text-[10px] uppercase tracking-[0.2em] mb-6">Publish MP4 Drill</h3>
            <div className="grid gap-6">
              <input 
                value={newVidTitle} 
                onChange={e => setNewVidTitle(e.target.value)} 
                placeholder="Exercise Name" 
                className="w-full bg-white border border-gray-200 px-6 py-4 rounded-2xl text-sm font-bold text-[#0A192F] outline-none focus:border-[#FF8C00] transition-all" 
              />

              <div className="relative group">
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="video/*" 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }} 
                  className="hidden" 
                />
                
                <div 
                  onClick={pickVideoFile}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[24px] p-10 cursor-pointer transition-all ${
                    selectedFile ? 'border-[#FF8C00] bg-[#FF8C00]/5' : 'border-gray-200 bg-white hover:border-[#0A192F]/20'
                  }`}
                >
                  <span className={`text-xs font-black uppercase tracking-widest ${selectedFile ? 'text-[#FF8C00]' : 'text-gray-400'}`}>
                    {selectedFile ? selectedFile.name : 'Select MP4 Drill'}
                  </span>
                  {selectedFile && (
                    <span className="text-[9px] text-[#FF8C00]/60 mt-1 uppercase font-bold">Ready for deployment</span>
                  )}
                </div>
              </div>

              <button 
                onClick={handleAddVideo} 
                disabled={isSyncing} 
                className="w-full bg-[#0A192F] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-[#0A192F]/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isSyncing ? 'Processing...' : 'Deploy Video'}
              </button>
            </div>
          </div>

          {/* VIDEO GRID */}
          <div className="grid gap-6 sm:grid-cols-2">
            {videos.filter(v => v.categoryId === activeCategoryId).map(vid => (
              <div key={vid.id} className="bg-white border border-gray-100 rounded-[32px] p-6 group hover:border-[#FF8C00]/30 transition-all shadow-sm hover:shadow-md">
                <div className="aspect-video bg-[#0A192F] rounded-[20px] flex items-center justify-center relative mb-4 overflow-hidden">
                  <svg className="w-10 h-10 text-white/20 group-hover:text-[#FF8C00] transition-all" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <button 
                    onClick={() => handleDeleteVideo(vid.id, vid.publicId)}
                    className="absolute top-3 right-3 bg-white/10 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span className="block font-black text-[#0A192F] text-base italic uppercase tracking-tight">{vid.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-300 font-black uppercase text-[10px] tracking-widest">
          Select Folder to Manage Vault
        </div>
      )}
    </div>
  </div>
)}


     {/* CRM VIEW */}
{view === 'management' && (
  <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
    <div className="space-y-6">
      {/* REGISTRY FORM */}
      <div className="bg-[#0A192F] border border-white/10 rounded-[32px] p-8 h-fit shadow-xl">
        <h3 className="text-white font-black text-xl mb-6 italic uppercase tracking-tight">Registry</h3>
        <form onSubmit={handleRegisterMember} className="space-y-4">
          <input 
            value={newMemberName} 
            onChange={e => setNewMemberName(e.target.value)} 
            placeholder="Full Name" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-[#FF8C00] transition-all" 
          />
          <input 
            value={newMemberPhone} 
            onChange={e => setNewMemberPhone(e.target.value)} 
            placeholder="Phone Number" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-[#FF8C00] transition-all" 
          />
          <input 
            value={newMemberCode} 
            onChange={e => setNewMemberCode(e.target.value)} 
            placeholder="Access Code" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-[#FF8C00] transition-all" 
          />
          <button 
            type="submit" 
            className="w-full bg-[#FF8C00] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-[#FF8C00]/20 active:scale-95 transition-all"
          >
            Authorize Member
          </button>
        </form>
      </div>

      {/* STUDIO BRANDING SECTION */}
      <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-xl">
        <h3 className="text-[#0A192F] font-black text-lg mb-4 italic uppercase tracking-tight">Studio Branding</h3>
        <div className="space-y-4">
          <div className="relative aspect-video bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center group">
            {bannerPreview ? (
              <img src={bannerPreview} alt="Trending" className="w-full h-full object-cover" />
            ) : (
              <div className="text-[10px] text-gray-300 font-black uppercase tracking-widest">No Banner Uploaded</div>
            )}
            <div className="absolute inset-0 bg-[#0A192F]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
               <p className="text-white text-[10px] font-black uppercase">Replace Image</p>
            </div>
          </div>
          <label className="block w-full bg-[#0A192F] hover:bg-[#162a4a] text-white py-4 rounded-xl text-center cursor-pointer transition-all shadow-lg shadow-[#0A192F]/10">
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isSyncing ? 'Processing...' : 'Upload Daily Image (JPG)'}
            </span>
            <input type="file" accept="image/jpeg,image/jpg" className="hidden" onChange={handleBannerUpload} disabled={isSyncing} />
          </label>
        </div>
      </div>
    </div>

    {/* MEMBER DIRECTORY */}
    <div className="bg-white border border-gray-100 rounded-[32px] p-8 h-full min-h-[600px] overflow-y-auto shadow-xl">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-[#0A192F]/40 text-[10px] font-black uppercase tracking-[0.2em]">Member Directory</h3>
        <span className="bg-gray-50 text-[#0A192F] text-[9px] font-black px-3 py-1 rounded-full border border-gray-100 uppercase">
          {clients.length} Active
        </span>
      </div>
      
      <div className="space-y-3">
        {clients.map(client => (
          <div key={client.uid} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center group hover:border-[#FF8C00]/30 transition-all shadow-sm">
            <div className="flex flex-col">
              <span className="text-[#0A192F] font-black italic uppercase text-base">{client.name}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-400 font-bold">{client.phone}</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                <span className="text-[10px] text-[#FF8C00] font-black tracking-widest">CODE: {client.accessCode}</span>
              </div>
            </div>
            <button 
              onClick={() => handleDeleteClient(client.uid)} 
              className="p-2 bg-white text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 border border-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="text-center py-20 opacity-20">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0A192F]">Registry Empty</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}
      
      
      
    </div>
  );
};
export default TrainerHome;
