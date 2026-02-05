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

  // Sync active class and clients for the invite modal
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

  // Jitsi Lifecycle
  useEffect(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
    }

    const domain = 'meet.ffmuc.net';
    
    const options = {
      roomName: `BalanceProStudio_${meetingId}`, 
      width: '100%',
      height: '100%',
      parentNode: containerRef.current,
      configOverwrite: {
        prejoinPageEnabled: false, 
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        iceTransportPolicy: 'all', 
        disableDeepLinking: true, // Mobile app prompt ko rokne ke liye
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
          'security'
        ],
      },
      userInfo: { 
        displayName: userName + (isTrainer ? ' (Coach)' : '') 
      },
    };

    try {
      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
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
    <div className="fixed inset-0 bg-zinc-950 flex flex-col z-50 font-sans">
      {/* Control Bar */}
      <div className="h-14 bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {isTrainer ? 'Studio Master Control' : 'Secure Live Session'}
          </span>
        </div>
        <div className="flex gap-2">
          {isTrainer && (
            <button onClick={() => setShowInviteModal(true)} className="text-[10px] font-black bg-lime-400 text-zinc-950 px-4 py-2 rounded-full uppercase tracking-widest hover:scale-105 transition-transform">
              Invite
            </button>
          )}
          <button onClick={onLeave} className="text-[10px] font-black text-zinc-400 hover:text-white px-4 py-2 rounded-full border border-zinc-800 uppercase tracking-widest transition-colors">
            Exit
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 bg-black relative" ref={containerRef} />

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-white font-black text-xl uppercase italic tracking-tight">Studio Invite</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-zinc-600 hover:text-white transition-colors">✕</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {clients.map(client => (
                <label key={client.uid} className="flex items-center justify-between p-4 bg-zinc-800/30 border border-zinc-800/50 hover:bg-zinc-800 rounded-2xl cursor-pointer transition-all group">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-200 uppercase italic group-hover:text-lime-400 transition-colors">{client.name}</span>
                    <span className="text-[10px] text-zinc-600 font-medium">{client.phone}</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={invitedUids.includes(client.uid)} 
                    onChange={() => toggleInvite(client.uid)} 
                    className="accent-lime-400 h-5 w-5 rounded-md"
                  />
                </label>
              ))}
            </div>
            <button onClick={() => setShowInviteModal(false)} className="w-full mt-8 bg-zinc-100 text-zinc-950 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
