import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { db } from '../services/firebaseService'; 
import { ref, get } from 'firebase/database';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsConnecting(true);
    
    try {
      const trainerPhone = '7355519301';
      const uid = `user_${phone}`;
      
      if (phone === trainerPhone) {
        const trainerUser: UserProfile = {
          uid,
          name: 'Nitesh Tyagi',
          phone,
          role: UserRole.TRAINER,
          registeredOn: Date.now(),
        };
        onLogin(trainerUser);
        return;
      }

      const userRef = ref(db, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.accessCode === password) {
          onLogin(userData as UserProfile);
        } else {
          setError('Incorrect Access Code. Please verify with Coach Nitesh.');
        }
      } else {
        setError('Access Denied. You are not registered in the BalancePro system.');
      }
    } catch (err) {
      console.error("Firebase Login Error:", err);
      setError('Login failed. Check your internet or Firebase config.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 font-sans bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/assets/icon.png')` }}
    >
      <div className="absolute inset-0 bg-[#081229]/90 backdrop-blur-sm"></div>

      <div className="w-full max-w-md bg-[#0F172A]/90 border border-white/10 rounded-3xl p-10 shadow-2xl relative z-10 backdrop-blur-md">
        <div className="text-center mb-10">
          <div className="h-16 md:h-20 flex items-center justify-center mb-6">
            <img 
              src="/assets/logo1.jpeg" 
              alt="BalancePro" 
              className="w-auto h-20 md:h-24 object-contain rounded-2xl shadow-lg" 
            />
          </div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.4em] opacity-80"> Contact Nitesh for Registration </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center italic">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#FFB800] font-bold ml-1"> Phone Number: </label>
            <input 
              type="tel" 
              required 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="Enter your registered mobile number" 
              disabled={isConnecting}
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/20 outline-none transition-all disabled:opacity-50" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#FFB800] font-bold ml-1">Passkey</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Contact your Trainer if forgotten!" 
              disabled={isConnecting}
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/20 outline-none transition-all disabled:opacity-50" 
            />
          </div>

          <button 
            type="submit" 
            disabled={isConnecting}
            className="w-full bg-[#FF0000] hover:bg-[#CC0000] disabled:bg-slate-900 text-white font-black py-5 rounded-2xl transition-all active:scale-95 shadow-xl shadow-[#FF0000]/20 mt-6 uppercase tracking-widest text-sm"
          >
            {isConnecting ? 'Authorizing...' : 'Enter Studio'}
          </button>
        </form>

        <div className="mt-8 text-center text-slate-500 text-[9px] font-bold uppercase tracking-[0.4em]">
          WhatsApp & bull; 7355519301
        </div>
      </div>
    </div>
  );
};

export default Login;
