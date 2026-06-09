import React, { useEffect, useRef, useState } from 'react';
import { UserProfile, UserRole, ActiveClass } from '../types';
import { db } from '../services/firebaseService';
import { ref, onValue, set, get } from 'firebase/database';

interface VideoCallProps {
  meetingId: string;
  userName: string;
  onLeave: () => void;
  isTrainer: boolean;
}

const VideoCall: React.FC<VideoCallProps> = ({
  meetingId,
  userName,
  onLeave,
  isTrainer
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [invitedUids, setInvitedUids] = useState<string[]>([]);
  const [currentClassData, setCurrentClassData] = useState<ActiveClass | null>(null);

  // Firebase Realtime DB listeners
  useEffect(() => {
    const unsub = onValue(ref(db, 'active_class'), (snap) => {
      const data = snap.val();
      if (data) {
        setCurrentClassData(data);
        if (data.invitedUids) setInvitedUids(data.invitedUids);
      }
    });

    if (isTrainer) {
      get(ref(db, 'users')).then((snap) => {
        const data = snap.val();
        if (data) {
          const allUsers = Object.values(data) as UserProfile[];
          setClients(allUsers.filter(u => u.role === UserRole.CLIENT));
        }
      });
    }

    return () => unsub();
  }, [isTrainer]);

  // 🟢 BULLETPROOF JITSI ENGINE (Fixes Black Screen & Auth Errors)
  useEffect(() => {
    let isMounted = true;
    
    // ⚡ UNRESTRICTED GLOBAL SERVER: Zero Moderator Locks
    const domain = 'meet.ffmuc.net';

    const initializeJitsi = async () => {
      try {
        // 🔥 CRITICAL FIX 1: Nuke all cached/old script instances to prevent origin clash
        const oldScripts = document.querySelectorAll('script[src*="external_api.js"]');
        oldScripts.forEach(script => script.remove());

        // 🔥 CRITICAL FIX 2: Wipe the window object reference explicitly
        (window as any).JitsiMeetExternalAPI = undefined;

        // 3. Inject fresh script dynamically
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://${domain}/external_api.js`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Jitsi Engine"));
          document.body.appendChild(script);
        });

        // Abort if component unmounted while downloading script
        if (!isMounted || !containerRef.current || !(window as any).JitsiMeetExternalAPI) return;

        // Clean out any ghost iframes
        containerRef.current.innerHTML = '';
        
        // Secure formatting for room id
        const safeRoomId = `BalanceProStudio_${meetingId.replace(/[^a-zA-Z0-9]/g, '')}`;

        const options = {
          roomName: safeRoomId,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: userName ? `${userName}${isTrainer ? ' (Coach)' : ''}` : 'Participant'
          },
          configOverwrite: {
            prejoinPageEnabled: false,       // Bypass all initial screens
            disableDeepLinking: true,        // Force stay in web app context
            startWithAudioMuted: false,       
            startWithVideoMuted: false,       
            enableWelcomePage: false,
            enableLobby: false,              // Hard kill waiting room logic
            lobby: { enabled: false },
            requireDisplayName: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            MOBILE_APP_PROMO: false,         
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'chat', 'hangup', 'tileview', 'fullscreen'
            ]
          }
        };

        apiRef.current = new (window as any).JitsiMeetExternalAPI(domain, options);

        // Hardware hardware permission pass-through injection
        const iframe = containerRef.current.querySelector('iframe');
        if (iframe) {
          iframe.setAttribute('allow', 'camera *; microphone *; display-capture *; autoplay *; fullscreen *');
        }

        apiRef.current.addEventListener('videoConferenceLeft', () => {
          if (isMounted) onLeave();
        });
        
        apiRef.current.addEventListener('readyToClose', () => {
          if (isMounted) onLeave();
        });

      } catch (err) {
        console.error("Jitsi Setup Lifecycle Crash:", err);
      }
    };

    initializeJitsi();

    return () => {
      isMounted = false;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [meetingId, userName, isTrainer, onLeave]);

  // Invite handler
  const toggleInvite = async (uid: string) => {
    if (!currentClassData) return;

    const newInvited = invitedUids.includes(uid)
      ? invitedUids.filter(id => id !== uid)
      : [...invitedUids, uid];

    setInvitedUids(newInvited);

    await set(ref(db, 'active_class'), {
      ...currentClassData,
      invitedUids: newInvited
    });
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col z-50">
      {/* Top Controller Header */}
      <div className="h-14 bg-zinc-900 flex items-center justify-between px-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-lime-500 shadow-[0_0_8px_#84cc16]" />
          <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
            BalancePro • Live Studio
          </span>
        </div>

        <div className="flex gap-2">
          {isTrainer && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="text-[10px] font-bold bg-lime-400 text-black px-4 py-2 rounded-full uppercase transition-colors hover:bg-lime-300"
            >
              Invite
            </button>
          )}

          <button
            onClick={onLeave}
            className="text-[10px] font-bold text-zinc-400 px-4 py-2 rounded-full border border-zinc-800 uppercase transition-colors hover:bg-zinc-800"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Main Core Framework Target Element */}
      <div className="flex-1 bg-black relative" ref={containerRef}>
         {/* The API target handles its own internal loading state natively now */}
      </div>

      {/* Invite System Modal Wrapper */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-zinc-900 w-full max-w-xs rounded-3xl p-6 border border-zinc-800 shadow-2xl">
            <h3 className="text-white font-bold mb-4 uppercase text-sm">
              Select Clients
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {clients.map(client => (
                <label
                  key={client.uid}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-xs text-zinc-200">{client.name}</span>
                  <input
                    type="checkbox"
                    checked={invitedUids.includes(client.uid)}
                    onChange={() => toggleInvite(client.uid)}
                    className="accent-lime-400 w-4 h-4"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full mt-6 bg-white text-black py-3 rounded-xl font-bold text-xs uppercase hover:bg-zinc-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
