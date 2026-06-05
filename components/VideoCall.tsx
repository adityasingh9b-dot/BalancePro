import React, { useEffect, useRef, useState } from 'react';
import { UserProfile, UserRole, ActiveClass } from '../types';
import { db } from '../services/firebaseService'; 
import { ref, onValue, set } from 'firebase/database';

interface VideoCallProps {
  meetingId: string;
  userName: string;
  onLeave: () => void;
  isTrainer: boolean;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const VideoCall: React.FC<VideoCallProps> = ({ meetingId, userName, onLeave, isTrainer }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [invitedUids, setInvitedUids] = useState<string[]>([]);
  const [currentClassData, setCurrentClassData] = useState<ActiveClass | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, 'active_class'), (snap) => {
      const data = snap.val();
      if (data) {
        setCurrentClassData(data);
        if (data.invitedUids) setInvitedUids(data.invitedUids);
      }
    });

    if (isTrainer) {
      import('firebase/database').then(({ get }) => {
        get(ref(db, 'users')).then((snap) => {
          const data = snap.val();
          if (data) {
            const allUsers = Object.values(data) as UserProfile[];
            setClients(allUsers.filter(u => u.role === UserRole.CLIENT));
          }
        });
      });
    }
    return () => unsub();
  }, [isTrainer]);

  useEffect(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
    }

    // 🟢 CHANGED DOMAIN: frame-ancestors bypass karne ke liye standard open-source instance
    const domain = 'meet.jit.si';
    
    const options = {
      // 🟢 HYPER UNIQUE ROOM NAME: Isse koi pehle se join karke automatic moderator nahi ban payega
      roomName: `BalanceProStudio_FreeForAll_Session_${meetingId}_${Math.floor(100000 + Math.random() * 900000)}`, 
      width: '100%',
      height: '100%',
      parentNode: containerRef.current,
      configOverwrite: {
        // --- 🟢 ULTRA OPEN BYPASS MODE ---
        lobby: { enabled: false },
        enableLobby: false,
        autoKnock: false,
        prejoinPageEnabled: false,             // Seedhe video conference andar gusaega
        requireDisplayName: false,
        
        // --- BYPASS HOST / MODERATOR LOCKS ---
        disableModeratorIndicator: true,
        securityUi: {
          disableSelectablePassword: true,     // Password ka scene hi khatam
        },
        
        // --- CROP & RESOLUTION FIXES ---
        disableVideoFill: true,             
        disableSelfViewSettings: false, 
        doNotFlipLocalVideo: false,        
        resolution: 720,                   
        constraints: {
            video: {
                aspectRatio: 16 / 9,       
            },
        },
        
        apiAllowClickToJoin: true,
        p2p: { enabled: true },
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        VIDEO_LAYOUT_FIT: 'both',          
        MOBILE_APP_PROMO: false,
        TILE_VIEW_MAX_COLUMNS: 2,          
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'fodeviceselection', 'hangup', 'chat', 'settings', 'tileview'
        ],
      },
      userInfo: { 
        displayName: userName + (isTrainer ? ' (Coach)' : '') 
      },
    };

    try {
      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
      const iframe = containerRef.current.querySelector('iframe');
      if (iframe) {
        // Console log me jo 'speaker-selection' ka error tha use remove karne ke liye custom allow policies set ki hain
        iframe.setAttribute('allow', 'camera; microphone; display-capture; autoplay; clipboard-write');
      }

      jitsiApiRef.current.addEventListeners({
        videoConferenceLeft: onLeave,
        readyToClose: onLeave
      });

    } catch (e) {
      console.error("Jitsi Load Error:", e);
    }

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [meetingId, userName, isTrainer, onLeave]);

  // Firebase toggle function as is...
  const toggleInvite = async (uid: string) => {
    if (!currentClassData) return;
    const newInvited = invitedUids.includes(uid) 
      ? invitedUids.filter(id => id !== uid) 
      : [...invitedUids, uid];
    
    setInvitedUids(newInvited);
    try {
      await set(ref(db, 'active_class'), { ...currentClassData, invitedUids: newInvited });
    } catch (error) {
      console.error("Firebase Sync Error:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col z-50">
      <div className="h-14 bg-zinc-900 flex items-center justify-between px-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-lime-500 shadow-[0_0_8px_#84cc16]"></div>
          <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
            {isTrainer ? 'Welcome Nitesh' : 'Welcome to'} • BalancePro Studio
          </span>
        </div>
        <div className="flex gap-2">
          {isTrainer && (
            <button onClick={() => setShowInviteModal(true)} className="text-[10px] font-bold bg-lime-400 text-black px-4 py-2 rounded-full uppercase">
              Invite
            </button>
          )}
          <button onClick={onLeave} className="text-[10px] font-bold text-zinc-400 px-4 py-2 rounded-full border border-zinc-800 uppercase">
            Exit
          </button>
        </div>
      </div>

      <div className="flex-1 bg-black" ref={containerRef} />

      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-xs rounded-3xl p-6 border border-zinc-800">
            <h3 className="text-white font-bold mb-4 uppercase text-sm">Select Clients</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clients.map(client => (
                <label key={client.uid} className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                  <span className="text-xs text-zinc-200">{client.name}</span>
                  <input 
                    type="checkbox" 
                    checked={invitedUids.includes(client.uid)} 
                    onChange={() => toggleInvite(client.uid)} 
                    className="accent-lime-400"
                  />
                </label>
              ))}
            </div>
            <button onClick={() => setShowInviteModal(false)} className="w-full mt-6 bg-white text-black py-3 rounded-xl font-bold text-xs uppercase">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
