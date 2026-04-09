import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  where
} from 'firebase/firestore';
import { Trophy, Medal, User, RefreshCw, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';

interface LeaderboardUser {
  id: string;
  name: string;
  forge_score: number;
}

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [currentUserScore, setCurrentUserScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = () => {
    setRefreshing(true);
    const userId = auth.currentUser?.uid;

    // Fetch top 50 users to determine rank for most users
    const q = query(
      collection(db, 'users'),
      orderBy('forge_score', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LeaderboardUser));

      setTopUsers(users);

      if (userId) {
        const index = users.findIndex(u => u.id === userId);
        if (index !== -1) {
          setCurrentUserRank(index + 1);
          setCurrentUserScore(users[index].forge_score);
        } else {
          // If not in top 50, we'd need a separate count query or just say "50+"
          // For simplicity in this app, we'll just show they are not in top 50
          setCurrentUserRank(null);
          // Fetch current user score separately if not in top 50
          const userDoc = users.find(u => u.id === userId);
          if (!userDoc) {
             // We'll get it from the topUsers if they were there, but they aren't.
             // The App.tsx already has the score, but we'll fetch it here for the component's independence
          }
        }
      }
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = fetchLeaderboard();
    return () => unsubscribe();
  }, []);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: return 'text-gold border-gold bg-gold/10';
      case 2: return 'text-slate-300 border-slate-300 bg-slate-300/10';
      case 3: return 'text-amber-600 border-amber-600 bg-amber-600/10';
      default: return 'text-text-muted border-border bg-bg-sidebar';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown size={20} className="text-gold" />;
      case 2: return <Medal size={20} className="text-slate-300" />;
      case 3: return <Medal size={20} className="text-amber-600" />;
      default: return <span className="font-mono text-xs">#{rank}</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse tracking-widest">
        GATHERING ELITE OPERATIVES...
      </div>
    );
  }

  const top10 = topUsers.slice(0, 10);
  const currentUser = topUsers.find(u => u.id === auth.currentUser?.uid);

  return (
    <div className="p-4 md:p-8 space-y-12 pb-32 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-bebas text-gold tracking-tighter">LEADERBOARD</h1>
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-[0.2em] mt-2">
            THE HIGHEST CALIBER DISCIPLINE IN THE FORGE
          </p>
        </div>
        <button 
          onClick={() => fetchLeaderboard()}
          disabled={refreshing}
          className="flex items-center gap-2 bg-bg-sidebar border border-border px-6 py-3 font-bebas text-xl tracking-widest hover:border-gold transition-all group"
        >
          <RefreshCw size={18} className={`text-gold ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          REFRESH
        </button>
      </div>

      <div className="h-[1px] bg-gold/30 w-full" />

      {/* Top 3 Podium (Mobile/Simple List for now, but styled) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {topUsers.slice(0, 3).map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`sharp-card p-6 flex flex-col items-center text-center space-y-4 border-2 ${
              i === 0 ? 'border-gold scale-105 z-10' : i === 1 ? 'border-slate-300' : 'border-amber-600'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${getRankStyle(i + 1)}`}>
              {i === 0 ? <Crown size={24} /> : <Trophy size={24} />}
            </div>
            <div>
              <p className="font-bebas text-2xl tracking-wider truncate max-w-full">{user.name.toUpperCase()}</p>
              <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">RANK #{i + 1}</p>
            </div>
            <div className="w-full h-[1px] bg-border" />
            <div>
              <p className="font-oswald text-4xl font-bold text-gold">{user.forge_score}</p>
              <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">FORGE SCORE</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main List */}
      <div className="sharp-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg-sidebar border-b border-border text-[10px] font-mono text-text-muted uppercase tracking-widest">
              <th className="p-6 font-normal">RANK</th>
              <th className="p-6 font-normal">OPERATIVE</th>
              <th className="p-6 font-normal text-right">FORGE SCORE</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <AnimatePresence mode="popLayout">
              {top10.map((user, i) => (
                <motion.tr 
                  key={user.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className={`group border-b border-border/50 hover:bg-white/5 transition-all ${user.id === auth.currentUser?.uid ? 'bg-gold/5' : ''}`}
                >
                  <td className="p-6">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getRankStyle(i + 1)}`}>
                      {getRankIcon(i + 1)}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <User size={16} className={user.id === auth.currentUser?.uid ? 'text-gold' : 'text-text-muted'} />
                      <span className={`font-bebas text-xl tracking-wider ${user.id === auth.currentUser?.uid ? 'text-gold' : ''}`}>
                        {user.name.toUpperCase()}
                        {user.id === auth.currentUser?.uid && <span className="ml-2 font-mono text-[10px] text-gold/50">(YOU)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <span className="font-oswald text-2xl font-bold text-gold">{user.forge_score}</span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Current User Rank (if not in top 10) */}
      {currentUserRank && currentUserRank > 10 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sharp-card p-6 border-gold/50 bg-gold/5 flex items-center justify-between"
        >
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center border border-gold text-gold font-oswald text-xl font-bold">
              #{currentUserRank}
            </div>
            <div>
              <p className="font-bebas text-2xl text-gold tracking-widest">YOUR CURRENT STANDING</p>
              <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">KEEP FORGING TO CLIMB THE RANKS</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-oswald text-4xl font-bold text-gold">{currentUserScore}</p>
            <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">YOUR SCORE</p>
          </div>
        </motion.div>
      )}

      {!currentUserRank && !loading && (
        <div className="sharp-card p-6 border-missed/50 bg-missed/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center border border-missed text-missed font-oswald text-xl font-bold">
              50+
            </div>
            <div>
              <p className="font-bebas text-2xl text-missed tracking-widest">OUTSIDE TOP 50</p>
              <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">THE COMPETITION IS FIERCE. STEP UP.</p>
            </div>
          </div>
          <div className="text-right">
             {/* We don't have the score here if they are not in top 50, but we could fetch it */}
             <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">SCORE NOT IN TOP 50</p>
          </div>
        </div>
      )}
    </div>
  );
}
