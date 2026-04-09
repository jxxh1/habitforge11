
import { collection, addDoc } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import { useForgeScore } from './lib/useForgeScore';

import HabitGrid from './pages/HabitGrid';
import Goals from './pages/Goals';
import SleepLog from './pages/SleepLog';
import Journal from './pages/Journal';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Leaderboard from './pages/Leaderboard';

import { ToastProvider } from './components/Toast';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

function AnimatedRoutes() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { score } = useForgeScore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data());
      }
      setLoading(false);
    });

    return unsubProfile;
  }, [user]);

  useEffect(() => {
    if (user && score !== undefined) {
      updateDoc(doc(db, 'users', user.uid), { forge_score: score });
    }
  }, [user, score]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-gold font-bebas text-4xl animate-pulse">INITIALIZING FORGE...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex min-h-screen bg-bg-main">
      <Sidebar user={user} profile={profile} forgeScore={score} />
      <main className="flex-1 md:ml-[240px] pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 0.2,
              exit: { duration: 0.1 }
            }}
          >
            <Routes location={location}>
              <Route path="/" element={<HabitGrid />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/sleep" element={<SleepLog />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
    </ToastProvider>
  );
}

