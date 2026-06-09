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

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const VideoCall: React.FC<VideoCallProps> = ({
  meetingId,
  userName,
  onLeave,
  isTrainer
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const initializedRef = useRef(false);

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

  // 🟢 COMPLETELY UNRESTRICTED CORE JITSI DEPLOYMENT ENGINE
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // ⚡ UNRESTRICTED DEVELOPER HOST ROUTE
    const domain = 'meet.gwdg.de';

    const injectJitsiScript = () =>
      new Promise<void>((resolve) => {
        if (window.JitsiMeetExternalAPI) return resolve();

        const script = document.createElement('script');
        // Instantiating script source mapping specifically to the hostless backend domain
        script.src = `https://${domain}/external_api.js`;
        script.async = true;
        script.onload = () => resolve();
        document.body.appendChild(script);
      });

    injectJitsiScript().then(() => {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }

      containerRef.current.innerHTML = '';
      
      // Sanitized unique lowercase alphanumeric room string setup
      const cleanRoomName = `balanceprostudio-${meetingId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const options = {
        roomName: cleanRoomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: userName + (isTrainer ? ' (Coach)' : '')
        },
        configOverwrite: {
          prejoinPageEnabled: false,       // Direct injection bypassing prompt views
          disableDeepLinking: true,        
          startWithAudioMuted: false,       
          startWithVideoMuted: false,       
          enableWelcomePage: false,
          enableLobby: false,              // Hard disabled locker loops
          lobby: { enabled: false },
          requireDisplayName: false,
          enableClosePage: false
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          MOBILE_APP_PROMO: false,         
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'chat',
            'hangup',
            'tileview',
            'fullscreen'
          ]
        }
      };

      try {
        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

        const iframe = containerRef.current.querySelector('iframe');
        if (iframe) {
          iframe.setAttribute('allow', 'camera *; microphone *; display-capture *; autoplay *; fullscreen *');
        }

        apiRef.current.addEventListener('videoConferenceLeft', () => {
          onLeave();
        });
        
        apiRef.current.addEventListener('readyToClose', () => {
          onLeave();
        });

      } catch (err) {
        console.error("Jitsi Boot Fail Lifecycle:", err);
      }
    });

    return () => {
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
              className="text-[10px] font-bold bg-lime-400 text-black px-4 py-2 rounded-full uppercase"
            >
              Invite
            </button>
          )}

          <button
            onClick={onLeave}
            className="text-[10px] font-bold text-zinc-400 px-4 py-2 rounded-full border border-zinc-800 uppercase"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Main Core Framework Target Element */}
      <div className="flex-1 bg-black" ref={containerRef} />

      {/* Invite System Modal Wrapper */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-zinc-900 w-full max-w-xs rounded-3xl p-6 border border-zinc-800">
            <h3 className="text-white font-bold mb-4 uppercase text-sm">
              Select Clients
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clients.map(client => (
                <label
                  key={client.uid}
                  className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl"
                >
                  <span className="text-xs text-zinc-200">{client.name}</span>
                  <input
                    type="checkbox"
                    checked={invitedUids.includes(client.uid)}
                    onChange={() => toggleInvite(client.uid)}
                    className="accent-lime-400"
                    // Add standard key strings during map execution loops
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full mt-6 bg-white text-black py-3 rounded-xl font-bold text-xs uppercase"
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
