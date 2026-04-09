import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { signOut, deleteUser } from 'firebase/auth';
import { 
  LogOut, 
  User, 
  Shield, 
  Bell, 
  Database, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Plus, 
  Minus, 
  Download, 
  RefreshCcw, 
  AlertTriangle,
  Quote
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DISCIPLINE_QUOTES, COLORS, CATEGORIES } from '../constants';
import { useToast } from '../components/Toast';

interface UserProfile {
  name: string;
  why: string;
  timezone: string;
  sleep_target: number;
  warn_streak: boolean;
  bedtime_reminder: boolean;
  current_quote_index: number;
}

interface Habit {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface StreakProtection {
  habit_id: string;
  used_date: string;
  month: string;
}

export default function Settings() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [protections, setProtections] = useState<StreakProtection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [habitForm, setHabitForm] = useState<Partial<Habit>>({});
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isClearingMonth, setIsClearingMonth] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);

    const unsubProfile = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setProfile({
          name: data.name || '',
          why: data.why || '',
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          sleep_target: data.sleep_target || 8,
          warn_streak: data.warn_streak ?? false,
          bedtime_reminder: data.bedtime_reminder ?? false,
          current_quote_index: data.current_quote_index || 0
        });
      }
    });

    const habitsQ = query(collection(db, 'habits'), where('user_id', '==', userId));
    const unsubHabits = onSnapshot(habitsQ, (s) => {
      setHabits(s.docs.map(d => ({ id: d.id, ...d.data() } as Habit)));
    });

    const currentMonth = new Date().toISOString().substring(0, 7);
    const protectionQ = query(
      collection(db, 'streak_protection'), 
      where('user_id', '==', userId),
      where('month', '==', currentMonth)
    );
    const unsubProtection = onSnapshot(protectionQ, (s) => {
      setProtections(s.docs.map(d => d.data() as StreakProtection));
      setLoading(false);
    });

    return () => {
      unsubProfile(); unsubHabits(); unsubProtection();
    };
  }, []);

  const updateProfileField = async (field: keyof UserProfile, value: any) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { [field]: value });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleHabitEdit = (habit: Habit) => {
    setEditingHabit(habit.id);
    setHabitForm(habit);
  };

  const saveHabit = async () => {
    if (!editingHabit || !habitForm.name) return;
    try {
      await updateDoc(doc(db, 'habits', editingHabit), habitForm);
      showToast('HABIT UPDATED ✓', 'success');
      setEditingHabit(null);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.UPDATE, `habits/${editingHabit}`);
    }
  };

  const confirmDeleteHabit = async () => {
    if (!deleteHabitId) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'habits', deleteHabitId));
      
      // Also delete logs for this habit
      const logsQ = query(collection(db, 'habit_logs'), where('habit_id', '==', deleteHabitId));
      const logsS = await getDocs(logsQ);
      logsS.forEach(d => batch.delete(d.ref));

      await batch.commit();
      showToast('HABIT DELETED', 'delete');
      setDeleteHabitId(null);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.DELETE, `habits/${deleteHabitId}`);
    }
  };

  const exportData = async () => {
    if (!auth.currentUser) return;
    try {
      const userId = auth.currentUser.uid;
      const collections = ['habits', 'habit_logs', 'goals', 'sleep_logs', 'journal_entries', 'streak_protection'];
      const data: any = { profile };

      for (const col of collections) {
        const q = query(collection(db, col), where('user_id', '==', userId));
        const s = await getDocs(q);
        data[col] = s.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habit-forge-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showToast('DATA EXPORTED ✓', 'success');
    } catch (err) {
      showToast('EXPORT FAILED', 'error');
      console.error('Export failed:', err);
    }
  };

  const clearMonth = async () => {
    if (!auth.currentUser) return;
    try {
      const userId = auth.currentUser.uid;
      const currentMonth = new Date().toISOString().substring(0, 7);
      const batch = writeBatch(db);

      // Clear logs for this month
      const logsQ = query(collection(db, 'habit_logs'), where('user_id', '==', userId));
      const logsS = await getDocs(logsQ);
      logsS.forEach(d => {
        if (d.data().log_date.startsWith(currentMonth)) batch.delete(d.ref);
      });

      // Clear protections for this month
      const protQ = query(collection(db, 'streak_protection'), where('user_id', '==', userId), where('month', '==', currentMonth));
      const protS = await getDocs(protQ);
      protS.forEach(d => batch.delete(d.ref));

      await batch.commit();
      showToast('MONTH PURGED', 'delete');
      setIsClearingMonth(false);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      console.error('Clear month failed:', err);
    }
  };

  const resetEverything = async () => {
    if (!auth.currentUser || resetConfirmText !== 'RESET') return;
    try {
      const userId = auth.currentUser.uid;
      const collections = ['habits', 'habit_logs', 'goals', 'sleep_logs', 'journal_entries', 'streak_protection'];
      const batch = writeBatch(db);

      for (const col of collections) {
        const q = query(collection(db, col), where('user_id', '==', userId));
        const s = await getDocs(q);
        s.forEach(d => batch.delete(d.ref));
      }

      batch.delete(doc(db, 'users', userId));
      await batch.commit();
      await signOut(auth);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const nextQuote = () => {
    if (!profile) return;
    const nextIndex = (profile.current_quote_index + 1) % DISCIPLINE_QUOTES.length;
    updateProfileField('current_quote_index', nextIndex);
  };

  if (loading || !profile) return <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse tracking-widest">LOADING SYSTEM CONFIG...</div>;

  const currentQuote = DISCIPLINE_QUOTES[profile.current_quote_index];
  const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <div className="p-4 md:p-8 space-y-12 pb-32">
      <div>
        <h1 className="text-4xl md:text-6xl font-bebas text-gold tracking-tighter">SETTINGS</h1>
        <div className="h-[1px] bg-gold/30 w-full mt-4" />
      </div>

      {/* SECTION 1: PROFILE */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-8"
      >
        <h2 className="text-2xl font-bebas tracking-widest text-text-muted">SECTION 1 — PROFILE</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">YOUR NAME</label>
              <input 
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({...profile, name: e.target.value})}
                onBlur={(e) => updateProfileField('name', e.target.value)}
                className="w-full bg-bg-card border border-border p-4 text-text-main focus:border-gold outline-none font-mono text-sm"
                placeholder="OPERATIVE NAME"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">YOUR WHY</label>
              <textarea 
                value={profile.why}
                onChange={(e) => setProfile({...profile, why: e.target.value})}
                onBlur={(e) => updateProfileField('why', e.target.value)}
                className="w-full bg-bg-card border border-border p-4 text-text-main focus:border-gold outline-none font-mono text-sm h-32 resize-none"
                placeholder="WHY ARE YOU BUILDING DISCIPLINE?"
              />
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">TIMEZONE</label>
              <select 
                value={profile.timezone}
                onChange={(e) => updateProfileField('timezone', e.target.value)}
                className="w-full bg-bg-card border border-border p-4 text-text-main focus:border-gold outline-none font-mono text-sm"
              >
                {Intl.supportedValuesOf('timeZone').map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="h-[1px] bg-gold/30 w-full" />

      {/* SECTION 2: MY HABITS */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-8"
      >
        <h2 className="text-2xl font-bebas tracking-widest text-text-muted">SECTION 2 — MY HABITS</h2>
        <div className="space-y-4">
          {habits.map(habit => (
            <div key={habit.id} className="sharp-card p-4 flex items-center justify-between group">
              {editingHabit === habit.id ? (
                <div className="flex-1 flex flex-wrap gap-4 items-center">
                  <input 
                    type="text"
                    value={habitForm.name}
                    onChange={(e) => setHabitForm({...habitForm, name: e.target.value})}
                    className="bg-bg-main border border-border p-2 text-xs font-mono outline-none focus:border-gold"
                  />
                  <select 
                    value={habitForm.category}
                    onChange={(e) => setHabitForm({...habitForm, category: e.target.value})}
                    className="bg-bg-main border border-border p-2 text-xs font-mono outline-none focus:border-gold"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button 
                        key={c}
                        onClick={() => setHabitForm({...habitForm, color: c})}
                        className={`w-4 h-4 rounded-full border ${habitForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={saveHabit} className="text-done hover:scale-110 transition-transform"><Check size={20} /></button>
                    <button onClick={() => setEditingHabit(null)} className="text-text-muted hover:scale-110 transition-transform"><X size={20} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }} />
                    <div>
                      <p className="font-bebas text-xl tracking-wider">{habit.name.toUpperCase()}</p>
                      <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">{habit.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleHabitEdit(habit)} className="text-text-muted hover:text-gold transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setDeleteHabitId(habit.id)} className="text-text-muted hover:text-missed transition-colors"><Trash2 size={18} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      <div className="h-[1px] bg-gold/30 w-full" />

      {/* SECTION 3: STREAK PROTECTION */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-8"
      >
        <h2 className="text-2xl font-bebas tracking-widest text-text-muted uppercase">SECTION 3 — GRACE DAYS — {monthName}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits.map(habit => {
            const protection = protections.find(p => p.habit_id === habit.id);
            return (
              <div key={habit.id} className="sharp-card p-4 flex items-center justify-between">
                <span className="font-mono text-xs uppercase truncate max-w-[150px]">{habit.name}</span>
                {protection ? (
                  <div className="flex items-center gap-2 bg-text-muted/10 px-3 py-1 border border-text-muted/20">
                    <Shield size={12} className="text-text-muted" />
                    <span className="font-mono text-[10px] text-text-muted font-bold">USED — {new Date(protection.used_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-gold/10 px-3 py-1 border border-gold/20">
                    <Shield size={12} className="text-gold" />
                    <span className="font-mono text-[10px] text-gold font-bold uppercase tracking-widest">AVAILABLE</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="bg-bg-sidebar border-l-2 border-gold p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="font-mono text-[10px] text-text-muted leading-relaxed uppercase tracking-widest">
            1 grace day per habit. Resets on the 1st of each month.
          </p>
          <label className="flex items-center gap-3 cursor-pointer group">
            <span className="font-mono text-[10px] text-text-muted group-hover:text-text-main transition-colors uppercase tracking-widest">WARN ME WHEN STREAK EXCEEDS 5 DAYS</span>
            <div 
              onClick={() => updateProfileField('warn_streak', !profile.warn_streak)}
              className={`w-10 h-5 rounded-full relative transition-colors ${profile.warn_streak ? 'bg-gold' : 'bg-border'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${profile.warn_streak ? 'left-6' : 'left-1'}`} />
            </div>
          </label>
        </div>
      </motion.section>

      <div className="h-[1px] bg-gold/30 w-full" />

      {/* SECTION 4: SLEEP SETTINGS */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-8"
      >
        <h2 className="text-2xl font-bebas tracking-widest text-text-muted">SECTION 4 — SLEEP SETTINGS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="sharp-card p-6 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest">SLEEP TARGET</span>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => updateProfileField('sleep_target', Math.max(1, profile.sleep_target - 1))}
                className="w-8 h-8 border border-border flex items-center justify-center hover:border-gold transition-colors"
              ><Minus size={16} /></button>
              <span className="font-oswald text-2xl font-bold text-gold w-8 text-center">{profile.sleep_target}</span>
              <button 
                onClick={() => updateProfileField('sleep_target', Math.min(12, profile.sleep_target + 1))}
                className="w-8 h-8 border border-border flex items-center justify-center hover:border-gold transition-colors"
              ><Plus size={16} /></button>
              <span className="font-mono text-[10px] text-text-muted uppercase">HRS</span>
            </div>
          </div>
          <div className="sharp-card p-6 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest">BEDTIME REMINDER</span>
            <div 
              onClick={() => updateProfileField('bedtime_reminder', !profile.bedtime_reminder)}
              className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${profile.bedtime_reminder ? 'bg-gold' : 'bg-border'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${profile.bedtime_reminder ? 'left-7' : 'left-1'}`} />
            </div>
          </div>
        </div>
      </motion.section>

      <div className="h-[1px] bg-gold/30 w-full" />

      {/* SECTION 5: DATA */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-8"
      >
        <h2 className="text-2xl font-bebas tracking-widest text-text-muted">SECTION 5 — DATA</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={exportData}
            className="sharp-card p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-colors group"
          >
            <Download size={24} className="text-gold group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[10px] uppercase tracking-widest">EXPORT ALL DATA</span>
          </button>
          <button 
            onClick={() => setIsClearingMonth(true)}
            className="sharp-card p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-colors group"
          >
            <RefreshCcw size={24} className="text-gold group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest">CLEAR THIS MONTH</span>
          </button>
          <button 
            onClick={() => setResetStep(1)}
            className="sharp-card p-6 border-missed/30 flex flex-col items-center gap-3 hover:bg-missed/10 transition-colors group"
          >
            <AlertTriangle size={24} className="text-missed group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[10px] text-missed uppercase tracking-widest">RESET EVERYTHING</span>
          </button>
        </div>
      </motion.section>

      <div className="h-[1px] bg-gold/30 w-full" />

      {/* SECTION 6: ACCOUNTABILITY QUOTES */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-8"
      >
        <h2 className="text-2xl font-bebas tracking-widest text-text-muted">SECTION 6 — ACCOUNTABILITY QUOTES</h2>
        <div className="sharp-card p-8 border-l-4 border-gold relative overflow-hidden">
          <Quote size={80} className="absolute -right-4 -bottom-4 text-white/5 -rotate-12" />
          <p className="font-mono italic text-lg md:text-xl text-text-main mb-6 relative z-10">"{currentQuote.text}"</p>
          <div className="flex items-center justify-between relative z-10">
            <span className="font-bebas text-xl text-gold tracking-widest">— {currentQuote.author.toUpperCase()}</span>
            <button 
              onClick={nextQuote}
              className="bg-gold text-bg-main px-6 py-2 font-bebas text-lg tracking-widest hover:bg-opacity-90 transition-all"
            >
              NEXT QUOTE
            </button>
          </div>
        </div>
      </motion.section>

      {/* MODALS */}
      <AnimatePresence>
        {/* Delete Habit Modal */}
        {deleteHabitId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-sidebar border border-missed p-8 w-full max-w-md text-center modal-full md:h-auto"
            >
              <AlertTriangle size={48} className="text-missed mx-auto mb-6" />
              <h3 className="text-3xl font-bebas text-missed mb-4 tracking-widest">DELETE {habits.find(h => h.id === deleteHabitId)?.name.toUpperCase()}?</h3>
              <p className="font-mono text-xs text-text-muted mb-8 leading-relaxed uppercase">
                ALL LOGS WILL BE REMOVED. THIS CANNOT BE UNDONE.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteHabitId(null)}
                  className="flex-1 border border-border py-3 font-bebas text-xl tracking-widest hover:bg-white/5"
                >CANCEL</button>
                <button 
                  onClick={confirmDeleteHabit}
                  className="flex-1 bg-missed text-text-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90"
                >DELETE FOREVER</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clear Month Modal */}
        {isClearingMonth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-sidebar border border-gold p-8 w-full max-w-md text-center modal-full md:h-auto"
            >
              <RefreshCcw size={48} className="text-gold mx-auto mb-6" />
              <h3 className="text-3xl font-bebas text-gold mb-4 tracking-widest">CLEAR {monthName}?</h3>
              <p className="font-mono text-xs text-text-muted mb-8 leading-relaxed uppercase">
                ALL HABIT LOGS AND PROTECTIONS FOR THIS MONTH WILL BE PURGED.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsClearingMonth(false)}
                  className="flex-1 border border-border py-3 font-bebas text-xl tracking-widest hover:bg-white/5"
                >CANCEL</button>
                <button 
                  onClick={clearMonth}
                  className="flex-1 bg-gold text-bg-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90"
                >CONFIRM PURGE</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Reset Everything Modal */}
        {resetStep > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-sidebar border border-missed p-8 w-full max-w-md text-center modal-full md:h-auto"
            >
              <AlertTriangle size={48} className="text-missed mx-auto mb-6" />
              <h3 className="text-3xl font-bebas text-missed mb-4 tracking-widest">SYSTEM RESET</h3>
              
              {resetStep === 1 ? (
                <>
                  <p className="font-mono text-xs text-text-muted mb-8 leading-relaxed uppercase">
                    ARE YOU SURE? ALL DATA (HABITS, LOGS, GOALS, JOURNAL) WILL BE PERMANENTLY DELETED.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setResetStep(0)}
                      className="flex-1 border border-border py-3 font-bebas text-xl tracking-widest hover:bg-white/5"
                    >CANCEL</button>
                    <button 
                      onClick={() => setResetStep(2)}
                      className="flex-1 bg-missed text-text-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90"
                    >CONTINUE</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-mono text-xs text-text-muted mb-4 leading-relaxed uppercase">
                    TYPE "RESET" TO CONFIRM PERMANENT DELETION.
                  </p>
                  <input 
                    type="text"
                    autoFocus
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                    className="w-full bg-bg-main border border-missed p-4 text-missed text-center font-mono text-xl mb-8 outline-none"
                    placeholder="RESET"
                  />
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {setResetStep(0); setResetConfirmText('');}}
                      className="flex-1 border border-border py-3 font-bebas text-xl tracking-widest hover:bg-white/5"
                    >CANCEL</button>
                    <button 
                      disabled={resetConfirmText !== 'RESET'}
                      onClick={resetEverything}
                      className="flex-1 bg-missed text-text-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90 disabled:opacity-30"
                    >RESET EVERYTHING</button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
