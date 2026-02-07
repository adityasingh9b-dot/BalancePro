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

  // LOADING STATE: Lime green hatakar Brand Orange aur Navy Blue kiya
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
      {/* HEADER: Lime green span ko Orange kiya aur background ko Navy */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-brand-grey/20 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          {/* Logo Icon matching the circular logo feel */}
          <div className="w-8 h-8 bg-brand-navy rounded-full flex items-center justify-center text-white font-bold">B</div>
          <h1 className="text-xl font-bold tracking-tight text-brand-navy">
            Balance<span className="text-brand-orange">Pro</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brand-navy/60 hidden sm:inline uppercase font-bold tracking-widest text-[10px]">
            Session: {auth.user.name}
          </span>
          <button 
            onClick={handleLogout}
            className="text-[10px] uppercase font-bold tracking-widest text-brand-red hover:bg-brand-red hover:text-white transition-all border border-brand-red/30 px-3 py-1 rounded-lg"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {auth.user.role === UserRole.TRAINER ? (
          <TrainerHome user={auth.user} onStartMeeting={startMeeting} />
        ) : (
          <ClientHome user={auth.user} onJoinMeeting={startMeeting} />
        )}
      </main>

      <footer className="p-4 text-center text-brand-navy/40 text-[10px] uppercase tracking-widest font-bold">
        &copy; 2026 BalancePro &bull; Wellness Studio
      </footer>
    </div>
  );
};

export default App;
