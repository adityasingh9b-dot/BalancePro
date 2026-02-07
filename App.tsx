import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole, AuthState } from './types';
import Login from './components/Login';
import TrainerHome from './components/TrainerHome';
import ClientHome from './components/ClientHome';
import VideoCall from './components/VideoCall';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    loading: true,
  });
  const [meetingMode, setMeetingMode] = useState<{ id: string; active: boolean }>({
    id: '',
    active: false,
  });

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('bp_auth_user');
      if (savedUser && savedUser !== "undefined") {
        setAuth({ user: JSON.parse(savedUser), loading: false });
      } else {
        setAuth({ user: null, loading: false });
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
      setAuth({ user: null, loading: false });
    }
  }, []);

  const handleLogin = (user: UserProfile) => {
    localStorage.setItem('bp_auth_user', JSON.stringify(user));
    setAuth({ user, loading: false });
  };

  const handleLogout = () => {
    localStorage.removeItem('bp_auth_user');
    setAuth({ user: null, loading: false });
    setMeetingMode({ id: '', active: false });
  };

  const startMeeting = useCallback((meetingId: string) => {
    setMeetingMode({ id: meetingId, active: true });
  }, []);

  const endMeeting = useCallback(() => {
    setMeetingMode({ id: '', active: false });
  }, []);

  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-light">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-orange"></div>
          <p className="text-[10px] text-brand-navy font-bold uppercase tracking-widest animate-pulse">Initializing BalancePro...</p>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <Login onLogin={handleLogin} />;
  }

  if (meetingMode.active) {
    return (
      <VideoCall 
        meetingId={meetingMode.id} 
        userName={auth.user.name} 
        onLeave={endMeeting} 
        isTrainer={auth.user.role === UserRole.TRAINER}
      />
    );
  }

  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
      {/* HEADER: Compact & Maroon */}
      <header className="px-6 py-3 flex justify-between items-center border-b border-black/20 bg-[#800000] shadow-md z-10">
        <div className="flex items-center">
          <div className="h-9 md:h-11 flex items-center">
            <img 
              src="/assets/logo1.jpeg" 
              alt="BalancePro" 
              className="h-full w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 bg-white rounded-full flex items-center justify-center text-[#800000] font-bold text-[10px]">B</div>
                      <h1 class="text-lg font-bold tracking-tight text-white">Balance<span class="text-[#FFB800]">Pro</span></h1>
                    </div>
                  `;
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[10px] text-white/80 hidden sm:inline uppercase font-black tracking-widest">
            NAME: {auth.user.name}
          </span>
          <button 
            onClick={handleLogout}
            className="text-[9px] uppercase font-bold tracking-widest text-white hover:bg-white hover:text-[#800000] transition-all border border-white/30 px-2 py-1 rounded-md"
          >
            Logout
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA: Naturally flows */}
      <main className="flex-1">
        {auth.user.role === UserRole.TRAINER ? (
          <TrainerHome user={auth.user} onStartMeeting={startMeeting} />
        ) : (
          <ClientHome user={auth.user} onJoinMeeting={startMeeting} />
        )}
      </main>

      {/* FOOTER: Slim & Clean */}
      <footer className="py-2 text-center bg-[#800000] border-t border-black/20">
        <p className="text-white/50 text-[9px] uppercase tracking-[0.2em] font-bold">
          &copy; 2026 <span className="text-[#FFB800]">BalancePro</span> &bull; Wellness Studio
        </p>
      </footer>
    </div>
  );
};

export default App;
