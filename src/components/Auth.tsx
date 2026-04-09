import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          name: user.displayName || 'OPERATIVE',
          email: user.email,
          role: 'user',
          created_at: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setError('GOOGLE AUTHENTICATION FAILED.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return 0;
    if (pwd.length < 6) return 1;
    if (pwd.length < 10) return 2;
    return 3;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error('PASSWORDS DO NOT MATCH.');
        }
        if (password.length < 8) {
          throw new Error('MIN 8 CHARACTERS REQUIRED.');
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: name });
        
        await setDoc(doc(db, 'users', user.uid), {
          name,
          email,
          role: 'user',
          created_at: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      let msg = 'AN ERROR OCCURRED.';
      
      if (err.code) {
        const commonErrors: Record<string, string> = {
          'auth/wrong-password': 'INVALID CREDENTIALS.',
          'auth/user-not-found': 'INVALID CREDENTIALS.',
          'auth/invalid-credential': 'INVALID CREDENTIALS.',
          'auth/email-already-in-use': 'EMAIL ALREADY REGISTERED.',
          'auth/weak-password': 'PASSWORD IS TOO WEAK.',
          'auth/invalid-email': 'INVALID EMAIL FORMAT.',
          'auth/operation-not-allowed': 'EMAIL/PASSWORD AUTH IS DISABLED. PLEASE ENABLE IT IN FIREBASE CONSOLE OR USE GOOGLE LOGIN.',
          'auth/network-request-failed': 'NETWORK ERROR. CHECK CONNECTION.'
        };

        if (commonErrors[err.code]) {
          msg = commonErrors[err.code];
        } else {
          msg = `ERROR: ${err.code.split('/')[1]?.replace(/-/g, ' ').toUpperCase() || err.code.toUpperCase()}`;
        }
      } else if (err.message) {
        msg = err.message.toUpperCase();
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main p-4">
      <div className="w-full max-w-[420px] bg-bg-sidebar border border-border gold-top-border p-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="font-bebas text-[48px] text-gold leading-none">HABIT</span>
            <span className="font-bebas text-[48px] text-text-main leading-none">FORGE</span>
          </div>
          <p className="font-mono text-[11px] text-text-muted tracking-[0.2em]">
            DISCIPLINE. CONSISTENCY. RESULTS.
          </p>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border border-border p-3 mb-6 flex items-center justify-center gap-3 hover:bg-white/5 transition-all font-mono text-xs tracking-widest text-text-main"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          CONTINUE WITH GOOGLE
        </button>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-bg-sidebar px-2 text-text-muted font-mono tracking-widest">OR USE EMAIL</span></div>
        </div>

        <div className="flex border-b border-border mb-8">
          <button 
            className={`flex-1 py-3 font-bebas text-lg tracking-widest transition-colors ${isLogin ? 'text-gold border-b-2 border-gold' : 'text-text-muted hover:text-text-main'}`}
            onClick={() => setIsLogin(true)}
          >
            LOG IN
          </button>
          <button 
            className={`flex-1 py-3 font-bebas text-lg tracking-widest transition-colors ${!isLogin ? 'text-gold border-b-2 border-gold' : 'text-text-muted hover:text-text-main'}`}
            onClick={() => setIsLogin(false)}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="space-y-1">
              <label className="block text-[10px] text-text-muted uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none transition-colors"
                placeholder="OPERATIVE NAME"
              />
            </div>
          )}
          
          <div className="space-y-1">
            <label className="block text-[10px] text-text-muted uppercase tracking-wider">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none transition-colors"
              placeholder="EMAIL ADDRESS"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-text-muted uppercase tracking-wider">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-main border border-border p-3 pr-10 text-text-main focus:border-gold outline-none transition-colors"
                placeholder="PASSWORD"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-gold"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!isLogin && password.length > 0 && (
              <div className="h-1 w-full bg-border mt-2 flex">
                <div className={`h-full transition-all duration-500 ${
                  strength === 1 ? 'w-1/3 bg-missed' : 
                  strength === 2 ? 'w-2/3 bg-gold' : 
                  strength === 3 ? 'w-full bg-done' : 'w-0'
                }`} />
              </div>
            )}
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="block text-[10px] text-text-muted uppercase tracking-wider">Confirm Password</label>
              <input 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none transition-colors"
                placeholder="CONFIRM PASSWORD"
              />
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-bg-main font-bebas text-xl py-3 tracking-widest hover:bg-opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? (isLogin ? 'ENTERING...' : 'FORGING...') : (isLogin ? 'ENTER THE FORGE' : 'FORGE YOUR ACCOUNT')}
          </button>

          {error && (
            <div className="bg-[#2E1A1A] border-l-4 border-missed p-4 mt-4">
              <p className="text-missed font-mono text-[10px] font-bold tracking-wider leading-relaxed">{error}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
