import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
// 1. Mock hatao, asali Firebase lao
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
      
      // 2. Trainer Direct Login Logic
      if (phone === trainerPhone) {
        const trainerUser: UserProfile = {
          uid,
          name: 'Nitesh Tyagi',
          phone,
          role: UserRole.TRAINER,
          registeredOn: Date.now(),
        };
        // Trainer ko hamesha allow karein
        onLogin(trainerUser);
        return;
      }

      // 3. Client Firebase Fetch Logic
      const userRef = ref(db, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        // Match accessCode (Database mein 'asd' hai, password field se match karo)
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

  // ... (Baki ka UI same rahega)
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-10 shadow-2xl">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-lime-400 rounded-3xl flex items-center justify-center text-zinc-950 font-black text-4xl mx-auto mb-6 shadow-xl shadow-lime-400/20 rotate-3 transition-transform">
            BP
          </div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight italic uppercase">Balance<span className="text-lime-400">Pro</span></h2>
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Studio Member Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold ml-1">Member Phone</label>
            <input 
              type="tel" 
              required 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="7355519301" 
              disabled={isConnecting}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:border-lime-400 outline-none transition-all disabled:opacity-50" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold ml-1">Access Code</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter Code" 
              disabled={isConnecting}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:border-lime-400 outline-none transition-all disabled:opacity-50" 
            />
          </div>

          <button 
            type="submit" 
            disabled={isConnecting}
            className="w-full bg-lime-400 hover:bg-lime-300 disabled:bg-zinc-800 text-zinc-950 font-black py-5 rounded-2xl transition-all active:scale-95 shadow-xl shadow-lime-400/10 mt-6 uppercase tracking-widest text-sm"
          >
            {isConnecting ? 'Authorizing...' : 'Enter Studio'}
          </button>
        </form>

        <div className="mt-8 text-center text-zinc-700 text-[10px] font-bold uppercase tracking-widest">
          Offline Memory Storage Mode
        </div>
      </div>
    </div>
  );
};

export default Login;
