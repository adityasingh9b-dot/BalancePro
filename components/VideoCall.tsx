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

  // Firebase listener
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

  // JITSI INIT (IMPORTANT PART)
  useEffect(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

    const domain = "meet.jit.si";
    const roomName = `BalanceProStudio_${meetingId}`;

    const options = {
      roomName,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: userName + (isTrainer ? ' (Coach)' : '')
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,   // IMPORTANT → no extra screen
        disableDeepLinking: true
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
          'microphone',
          'camera',
          'chat',
          'hangup',
          'tileview',
          'fullscreen',
          'raisehand'
        ]
      }
    };

    apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

    apiRef.current.addEventListener('videoConferenceLeft', () => {
      onLeave();
    });

    return () => {
      apiRef.current?.dispose();
    };
  }, [meetingId, userName, isTrainer, onLeave]);

  // Invite system (unchanged)
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

      {/* Top Bar */}
      <div className="h-14 bg-zinc-900 flex items-center justify-between px-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-lime-500"></div>
          <span className="text-[10px] font-bold uppercase text-zinc-400">
            BalancePro • Jitsi Call
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

      {/* Video Area */}
      <div className="flex-1 bg-black" ref={containerRef} />

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
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
