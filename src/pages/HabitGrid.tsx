import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { Plus, Check, X, Shield, Trash2, ChevronLeft, ChevronRight, Flame, AlertTriangle, PlusCircle } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DISCIPLINE_QUOTES, CATEGORIES, COLORS } from '../constants';
import { useToast } from '../components/Toast';

interface Habit {
  id: string;
  name: string;
  category: string;
  color: string;
  frequency: 'Every Day' | 'Weekdays Only' | 'Custom Days';
  is_active: boolean;
  sort_order: number;
  grace_days_used?: number;
}

interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  status: 'done' | 'missed' | 'protected';
}

interface StreakProtection {
  id: string;
  habit_id: string;
  used_date: string;
  month: string; // YYYY-MM
}

export default function HabitGrid() {
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [protections, setProtections] = useState<StreakProtection[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProtectionModalOpen, setIsProtectionModalOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [protectionDate, setProtectionDate] = useState<string | null>(null);
  const [showProtectionSuccess, setShowProtectionSuccess] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: '',
    category: 'Discipline',
    color: COLORS[0],
    frequency: 'Every Day' as const
  });

  // Month stats
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long' }).toUpperCase();
  const year = currentDate.getFullYear();

  // Quote rotation or profile quote
  const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / 86400000);
  const quoteIndex = profile?.current_quote_index ?? (dayOfYear % DISCIPLINE_QUOTES.length);
  const dailyQuote = DISCIPLINE_QUOTES[quoteIndex];

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    const habitsQuery = query(
      collection(db, 'habits'),
      where('user_id', '==', userId),
      orderBy('sort_order', 'asc')
    );

    const logsQuery = query(
      collection(db, 'habit_logs'),
      where('user_id', '==', userId)
    );

    const protectionQuery = query(
      collection(db, 'streak_protection'),
      where('user_id', '==', userId)
    );

    const unsubProfile = onSnapshot(doc(db, 'users', userId), (doc) => {
      if (doc.exists()) setProfile(doc.data());
    });

    const unsubscribeHabits = onSnapshot(habitsQuery, (snapshot) => {
      setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'habits'));

    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitLog)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'habit_logs'));

    const unsubscribeProtection = onSnapshot(protectionQuery, (snapshot) => {
      setProtections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreakProtection)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'streak_protection'));

    return () => {
      unsubProfile();
      unsubscribeHabits();
      unsubscribeLogs();
      unsubscribeProtection();
    };
  }, []);

  const calculateStreak = (habitId: string) => {
    const habitLogs = logs
      .filter(l => l.habit_id === habitId)
      .sort((a, b) => b.log_date.localeCompare(a.log_date));
    
    let currentStreak = 0;
    let bestStreak = 0;
    
    // Use local date strings to match grid logic
    const now = new Date();
    const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA');
    
    // 1. Calculate current streak
    // A streak is active if today is done OR yesterday was done (meaning it's still "today" and you haven't done it yet)
    const todayLog = habitLogs.find(l => l.log_date === today);
    const yesterdayLog = habitLogs.find(l => l.log_date === yesterday);
    
    const isTodayDone = todayLog && (todayLog.status === 'done' || todayLog.status === 'protected');
    const isYesterdayDone = yesterdayLog && (yesterdayLog.status === 'done' || yesterdayLog.status === 'protected');

    if (isTodayDone || isYesterdayDone) {
      // Start counting backwards from the most recent 'done' day (today or yesterday)
      let checkDate = new Date((isTodayDone ? today : yesterday) + 'T12:00:00');
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const log = habitLogs.find(l => l.log_date === dateStr);
        if (log && (log.status === 'done' || log.status === 'protected')) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // 2. Calculate best streak
    const sortedLogs = [...habitLogs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    let tempStreak = 0;
    let lastDate: Date | null = null;

    for (const log of sortedLogs) {
      if (log.status === 'done' || log.status === 'protected') {
        const currDate = new Date(log.log_date + 'T12:00:00');
        if (lastDate) {
          const diff = Math.round((currDate.getTime() - lastDate.getTime()) / 86400000);
          if (diff === 1) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        } else {
          tempStreak = 1;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
        lastDate = currDate;
      } else {
        tempStreak = 0;
        lastDate = null;
      }
    }

    return { currentStreak, bestStreak };
  };

  const canUseGraceDay = (habitId: string) => {
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const protection = protections.find(p => p.habit_id === habitId && p.month === currentMonthStr);
    
    if (!protection) return { available: true, usedOnDate: null };
    return { available: false, usedOnDate: protection.used_date };
  };

  const toggleMonth = (dir: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
  };

  const handleCellClick = async (habitId: string, day: number) => {
    if (!auth.currentUser) return;
    
    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (dateStr > todayStr) return; // Future date

    const logId = `${auth.currentUser.uid}_${habitId}_${dateStr}`;
    const existingLog = logs.find(l => l.habit_id === habitId && l.log_date === dateStr);

    try {
      if (!existingLog) {
        await setDoc(doc(db, 'habit_logs', logId), {
          habit_id: habitId,
          user_id: auth.currentUser.uid,
          log_date: dateStr,
          status: 'done',
          created_at: serverTimestamp()
        });
      } else if (existingLog.status === 'done') {
        await deleteDoc(doc(db, 'habit_logs', logId));
      }
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.WRITE, 'habit_logs');
    }
  };

  const handleCellRightClick = async (e: React.MouseEvent, habitId: string, day: number) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr > todayStr) return;

    const logId = `${auth.currentUser.uid}_${habitId}_${dateStr}`;
    const existingLog = logs.find(l => l.habit_id === habitId && l.log_date === dateStr);

    try {
      if (!existingLog || existingLog.status !== 'missed') {
        await setDoc(doc(db, 'habit_logs', logId), {
          habit_id: habitId,
          user_id: auth.currentUser.uid,
          log_date: dateStr,
          status: 'missed',
          created_at: serverTimestamp()
        });
      } else {
        await deleteDoc(doc(db, 'habit_logs', logId));
      }
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.WRITE, 'habit_logs');
    }
  };

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.name.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'habits'), {
        ...newHabit,
        user_id: auth.currentUser.uid,
        is_active: true,
        sort_order: habits.length,
        created_at: serverTimestamp()
      });
      showToast('HABIT ADDED ✓', 'success');
      setNewHabit({ name: '', category: 'Discipline', color: COLORS[0], frequency: 'Every Day' });
      setIsAddModalOpen(false);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.CREATE, 'habits');
    }
  };

  const activateShield = async () => {
    if (!selectedHabit || !protectionDate || !auth.currentUser) return;

    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const logId = `${auth.currentUser.uid}_${selectedHabit.id}_${protectionDate}`;

    try {
      // Update log
      await setDoc(doc(db, 'habit_logs', logId), {
        habit_id: selectedHabit.id,
        user_id: auth.currentUser.uid,
        log_date: protectionDate,
        status: 'protected',
        created_at: serverTimestamp()
      }, { merge: true });

      // Record protection usage
      await addDoc(collection(db, 'streak_protection'), {
        habit_id: selectedHabit.id,
        user_id: auth.currentUser.uid,
        used_date: protectionDate,
        month: currentMonthStr,
        created_at: serverTimestamp()
      });

      showToast('🛡 STREAK PROTECTED', 'shield');
      setShowProtectionSuccess(true);
      setTimeout(() => {
        setShowProtectionSuccess(false);
        setIsProtectionModalOpen(false);
        setSelectedHabit(null);
        setProtectionDate(null);
      }, 1500);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.WRITE, 'streak_protection');
    }
  };

  const deleteHabit = async (id: string) => {
    if (!confirm('TERMINATE THIS HABIT? ALL LOGS WILL BE PURGED.')) return;
    try {
      await deleteDoc(doc(db, 'habits', id));
      showToast('HABIT DELETED', 'delete');
      setSelectedHabit(null);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.DELETE, `habits/${id}`);
    }
  };

  if (loading) return <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse">SYNCHRONIZING WAR ROOM...</div>;

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-4 md:p-8">
      {/* Top Bar */}
      <div className="mb-12 relative">
        <div className="flex items-center justify-center gap-8 mb-2">
          <button onClick={() => toggleMonth(-1)} className="text-gold hover:scale-110 transition-transform"><ChevronLeft size={32} /></button>
          <h1 className="text-4xl md:text-5xl text-gold tracking-widest font-bebas">{monthName} {year}</h1>
          <button onClick={() => toggleMonth(1)} className="text-gold hover:scale-110 transition-transform"><ChevronRight size={32} /></button>
        </div>
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="italic font-mono text-xs text-text-muted">
            "{dailyQuote.text}" — {dailyQuote.author.toUpperCase()}
          </p>
          {profile?.why && (
            <p className="font-bebas text-lg text-gold tracking-widest opacity-80 uppercase">
              {profile.why}
            </p>
          )}
        </div>
        <div className="absolute right-0 top-0 hidden lg:flex items-center gap-2 bg-bg-sidebar border px-4 py-2 transition-colors duration-500" style={{ borderColor: habits.filter(h => canUseGraceDay(h.id).available).length > 0 ? '#C8A96E' : '#8B0000' }}>
          <Shield size={16} className={habits.filter(h => canUseGraceDay(h.id).available).length > 0 ? 'text-gold' : 'text-missed'} />
          <span className={`font-bebas text-lg tracking-widest ${habits.filter(h => canUseGraceDay(h.id).available).length > 0 ? 'text-gold' : 'text-missed'}`}>
            {habits.filter(h => canUseGraceDay(h.id).available).length > 0 
              ? `🛡 ${habits.filter(h => canUseGraceDay(h.id).available).length} SHIELDS LEFT THIS MONTH` 
              : '🛡 ALL SHIELDS USED'}
          </span>
        </div>
      </div>

      {/* Habit Grid Table */}
      {habits.length === 0 ? (
        <div className="sharp-card p-20 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 border-2 border-dashed border-gold flex items-center justify-center text-gold opacity-50">
            <Plus size={48} />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl text-text-muted font-bebas tracking-[0.2em]">NO HABITS FORGED YET</h2>
            <p className="font-mono text-xs text-text-muted uppercase tracking-widest mt-2">Click + to add your first habit</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-gold text-bg-main px-8 py-4 font-bebas text-2xl tracking-widest hover:scale-105 transition-all"
          >
            <PlusCircle size={24} />
            INITIALIZE FORGE
          </button>
        </div>
      ) : (
        <div className="sharp-card overflow-hidden flex flex-col">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-sidebar">
                  <th className="sticky left-0 z-20 bg-bg-sidebar border-r border-border p-4 text-left min-w-[180px] font-bebas text-xl tracking-widest text-text-muted">HABIT</th>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && year === new Date().getFullYear();
                    return (
                      <th key={day} className={`p-2 border-r border-border min-w-[40px] ${isToday ? 'border-t-2 border-t-gold' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-oswald text-xs ${isToday ? 'text-gold' : 'text-text-muted'}`}>{day}</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-border" />
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-20 bg-bg-sidebar border-l border-border p-4 font-bebas text-xl tracking-widest text-text-muted">STATS</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((habit, index) => {
                  const habitLogs = logs.filter(l => l.habit_id === habit.id && l.log_date.startsWith(`${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`));
                  const doneCount = habitLogs.filter(l => l.status === 'done' || l.status === 'protected').length;
                  const completionRate = Math.round((doneCount / daysInMonth) * 100);
                  const { currentStreak } = calculateStreak(habit.id);
                  const grace = canUseGraceDay(habit.id);

                  return (
                    <motion.tr 
                      key={habit.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group hover:bg-white/5 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-bg-sidebar border-r border-b border-border p-4 cursor-pointer" onClick={() => setSelectedHabit(habit)}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: habit.color }} />
                          <span className="font-mono text-[12px] tracking-tight truncate max-w-[120px]">{habit.name.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="flex items-center">
                              {currentStreak >= 14 ? (
                                <div className="flex">
                                  <Flame size={12} className="text-gold animate-pulse-gold" />
                                  <Flame size={12} className="text-gold animate-pulse-gold -ml-1" />
                                </div>
                              ) : (
                                <Flame size={12} className={currentStreak >= 7 ? 'text-gold animate-pulse-gold' : currentStreak > 0 ? 'text-white' : 'text-text-muted opacity-50'} />
                              )}
                            </div>
                            <span className={`font-oswald text-xs font-bold ${currentStreak >= 7 ? 'text-gold' : currentStreak > 0 ? 'text-white' : 'text-text-muted'}`}>{currentStreak}</span>
                          </div>
                          <Shield size={10} className={grace.available ? 'text-text-muted opacity-30' : 'text-gold'} />
                          {profile?.warn_streak && currentStreak >= 5 && (
                            <AlertTriangle size={12} className="text-missed animate-pulse" />
                          )}
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isFuture = dateStr > new Date().toISOString().split('T')[0];
                        const log = logs.find(l => l.habit_id === habit.id && l.log_date === dateStr);

                        return (
                          <td 
                            key={day} 
                            className={`border-r border-b border-border p-0 ${isFuture ? 'opacity-30' : ''}`}
                            onClick={() => handleCellClick(habit.id, day)}
                            onContextMenu={(e) => handleCellRightClick(e, habit.id, day)}
                          >
                            <div className={`grid-cell w-full h-full cursor-pointer ${
                              log?.status === 'done' ? 'grid-cell-done glow-done' : 
                              log?.status === 'missed' ? 'grid-cell-missed glow-missed' : 
                              log?.status === 'protected' ? 'grid-cell-protected animate-shield-pulse' : ''
                            }`}>
                              {log?.status === 'done' && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg animate-stamp">✕</motion.span>}
                              {log?.status === 'missed' && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg animate-stamp">✕</motion.span>}
                              {log?.status === 'protected' && <Shield size={16} className="text-gold animate-shield" />}
                            </div>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 bg-bg-sidebar border-l border-b border-border p-4 text-center">
                        <div className="flex flex-col">
                          <span className="font-oswald text-gold font-bold">{doneCount}/{daysInMonth}</span>
                          <span className="font-mono text-[10px] text-text-muted">{completionRate}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Habit Button */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gold text-bg-main flex items-center justify-center shadow-2xl hover:scale-110 transition-all z-40"
      >
        <Plus size={32} />
      </button>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-sidebar border border-border gold-top-border w-full max-w-md p-8 modal-full md:h-auto"
            >
              <h2 className="text-3xl text-gold mb-8 font-bebas">FORGE A NEW HABIT</h2>
              <form onSubmit={addHabit} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-widest">Habit Name</label>
                  <input 
                    autoFocus
                    required
                    type="text"
                    value={newHabit.name}
                    onChange={(e) => setNewHabit({...newHabit, name: e.target.value})}
                    className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none"
                    placeholder="ENTER OBJECTIVE"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase tracking-widest">Category</label>
                    <select 
                      value={newHabit.category}
                      onChange={(e) => setNewHabit({...newHabit, category: e.target.value})}
                      className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase tracking-widest">Frequency</label>
                    <select 
                      value={newHabit.frequency}
                      onChange={(e) => setNewHabit({...newHabit, frequency: e.target.value as any})}
                      className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none"
                    >
                      <option value="Every Day">EVERY DAY</option>
                      <option value="Weekdays Only">WEEKDAYS ONLY</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-widest">Color Code</label>
                  <div className="flex flex-wrap gap-3 p-3 border border-border bg-bg-main">
                    {COLORS.map(c => (
                      <button 
                        key={c}
                        type="button"
                        onClick={() => setNewHabit({...newHabit, color: c})}
                        className={`w-6 h-6 rounded-full transition-transform ${newHabit.color === c ? 'scale-125 border-2 border-white' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-gold text-bg-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90 transition-all">ADD HABIT</button>
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 border border-border py-3 font-bebas text-xl tracking-widest hover:bg-white/5 transition-all">CANCEL</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Habit Detail Modal */}
      <AnimatePresence>
        {selectedHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-sidebar border border-border gold-top-border w-full max-w-lg p-8 modal-full md:h-auto"
            >
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-4xl tracking-widest font-bebas" style={{ color: selectedHabit.color }}>{selectedHabit.name.toUpperCase()}</h2>
                <button onClick={() => setSelectedHabit(null)} className="text-text-muted hover:text-text-main"><X size={24} /></button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-bg-main p-4 border border-border text-center">
                  <p className="text-[10px] text-text-muted uppercase mb-1">CURRENT STREAK</p>
                  <p className="font-oswald text-3xl text-gold font-bold">{calculateStreak(selectedHabit.id).currentStreak}</p>
                </div>
                <div className="bg-bg-main p-4 border border-border text-center">
                  <p className="text-[10px] text-text-muted uppercase mb-1">BEST STREAK</p>
                  <p className="font-oswald text-3xl text-gold font-bold">{calculateStreak(selectedHabit.id).bestStreak}</p>
                </div>
                <div className="bg-bg-main p-4 border border-border text-center">
                  <p className="text-[10px] text-text-muted uppercase mb-1">MONTH %</p>
                  <p className="font-oswald text-3xl text-gold font-bold">
                    {Math.round((logs.filter(l => l.habit_id === selectedHabit.id && l.log_date.startsWith(`${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`) && (l.status === 'done' || l.status === 'protected')).length / daysInMonth) * 100)}%
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <div className="flex justify-between text-[10px] text-text-muted uppercase">
                  <span>MONTH PROGRESS</span>
                  <span>{logs.filter(l => l.habit_id === selectedHabit.id && l.log_date.startsWith(`${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`) && (l.status === 'done' || l.status === 'protected')).length} / {daysInMonth} DAYS</span>
                </div>
                <div className="h-2 bg-bg-main border border-border">
                  <div 
                    className="h-full bg-gold transition-all duration-1000" 
                    style={{ width: `${(logs.filter(l => l.habit_id === selectedHabit.id && l.log_date.startsWith(`${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`) && (l.status === 'done' || l.status === 'protected')).length / daysInMonth) * 100}%` }} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsProtectionModalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-gold text-bg-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90 transition-all"
                >
                  <Shield size={18} />
                  USE GRACE DAY
                </button>
                <button 
                  onClick={() => deleteHabit(selectedHabit.id)}
                  className="flex items-center justify-center gap-2 border border-missed text-missed py-3 font-bebas text-xl tracking-widest hover:bg-missed hover:text-text-main transition-all"
                >
                  <Trash2 size={18} />
                  DELETE HABIT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Streak Protection Modal */}
      <AnimatePresence>
        {isProtectionModalOpen && selectedHabit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-bg-sidebar border border-border gold-top-border w-full max-w-lg p-8 relative overflow-hidden modal-full md:h-auto"
            >
              {showProtectionSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute inset-0 z-10 bg-bg-sidebar flex flex-col items-center justify-center"
                >
                  <Shield size={64} className="text-gold mb-4 animate-shield" />
                  <h3 className="text-4xl text-gold font-bebas tracking-widest animate-fade-up-out">⚔ STREAK PROTECTED</h3>
                </motion.div>
              )}

              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-4xl text-gold font-bebas tracking-widest">⚔ STREAK PROTECTION</h2>
                  <p className="font-mono text-[11px] text-text-muted uppercase">Activate your grace day</p>
                </div>
                <button onClick={() => setIsProtectionModalOpen(false)} className="text-text-muted hover:text-text-main"><X size={24} /></button>
              </div>

              <div className="my-8 text-center">
                <p className="font-oswald text-6xl text-gold font-bold">🔥 {calculateStreak(selectedHabit.id).currentStreak} DAY STREAK</p>
                <p className="font-mono text-xs text-missed uppercase tracking-widest">at risk of breaking</p>
              </div>

              <div className="bg-bg-main border-l-[3px] border-gold p-4 mb-8">
                <p className="font-mono text-xs leading-relaxed">
                  You earn 1 GRACE DAY per habit per month. It shields a missed day from breaking your streak. Cannot be undone.
                </p>
              </div>

              {canUseGraceDay(selectedHabit.id).available ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] text-text-muted uppercase tracking-widest block">Select the day to protect</label>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const todayStr = new Date().toISOString().split('T')[0];
                        if (dateStr >= todayStr) return null;

                        const log = logs.find(l => l.habit_id === selectedHabit.id && l.log_date === dateStr);
                        if (log && log.status === 'done') return null;

                        return (
                          <button
                            key={day}
                            onClick={() => setProtectionDate(dateStr)}
                            className={`w-10 h-10 font-oswald text-sm border transition-all ${
                              protectionDate === dateStr 
                                ? 'bg-gold text-bg-main border-gold' 
                                : 'border-border hover:border-gold text-text-muted'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-missed/20 border border-missed p-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-missed animate-pulse" />
                    <span className="font-mono text-[10px] text-white font-bold uppercase">⚠ 1 GRACE DAY REMAINING THIS MONTH</span>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={activateShield}
                      disabled={!protectionDate}
                      className={`flex-1 py-4 font-bebas text-xl tracking-widest transition-all ${
                        protectionDate 
                          ? 'bg-gold text-bg-main hover:bg-opacity-90' 
                          : 'bg-border text-text-muted cursor-not-allowed'
                      }`}
                    >
                      🛡 ACTIVATE SHIELD
                    </button>
                    <button 
                      onClick={() => setIsProtectionModalOpen(false)}
                      className="flex-1 border border-border py-4 font-bebas text-xl tracking-widest hover:bg-white/5"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6 py-8">
                  <div className="space-y-1">
                    <p className="font-oswald text-4xl text-text-muted uppercase">🛡 GRACE DAY USED</p>
                    <p className="font-mono text-xs text-text-muted">Used on {canUseGraceDay(selectedHabit.id).usedOnDate}</p>
                  </div>
                  <p className="font-mono text-[10px] text-gold uppercase">Resets on 1st {new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).toLocaleString('default', { month: 'long' })}</p>
                  <button 
                    onClick={() => setIsProtectionModalOpen(false)}
                    className="w-full border border-border py-4 font-bebas text-xl tracking-widest hover:bg-white/5"
                  >
                    CLOSE
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
