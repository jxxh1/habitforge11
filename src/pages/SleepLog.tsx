import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit,
  doc
} from 'firebase/firestore';
import { Moon, Sun, Clock, Flame, Plus, ChevronDown, ChevronUp, Bed } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useToast } from '../components/Toast';

interface SleepLog {
  id: string;
  log_date: string;
  bedtime: string;
  wake_time: string;
  hours_slept: number;
  quality: number;
  mood: string;
  tags: string[];
  notes: string;
}

const MOODS = [
  { icon: '😵', label: 'WRECKED' },
  { icon: '😤', label: 'TIRED' },
  { icon: '😐', label: 'OKAY' },
  { icon: '😊', label: 'GOOD' },
  { icon: '⚡', label: 'SHARP' }
];

const TAGS = ['DEEP SLEEP', 'RESTLESS', 'WOKE UP', 'NIGHTMARE', 'REFRESHED', 'VIVID DREAMS'];

export default function SleepLog() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  
  const sleepGoal = profile?.sleep_target || 8;

  const [newLog, setNewLog] = useState({
    log_date: new Date().toLocaleDateString('en-CA'),
    bedtime: '22:00',
    wake_time: '06:00',
    quality: 3,
    mood: 'OKAY',
    tags: [] as string[],
    notes: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    const q = query(
      collection(db, 'sleep_logs'),
      where('user_id', '==', userId),
      orderBy('log_date', 'desc'),
      limit(30)
    );

    const unsubProfile = onSnapshot(doc(db, 'users', userId), (doc) => {
      if (doc.exists()) setProfile(doc.data());
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SleepLog));
      setLogs(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sleep_logs'));

    return () => {
      unsubProfile();
      unsubscribe();
    };
  }, []);

  const calculateHours = (bed: string, wake: string) => {
    const [bH, bM] = bed.split(':').map(Number);
    const [wH, wM] = wake.split(':').map(Number);
    
    let hours = wH - bH;
    let mins = wM - bM;
    
    if (hours < 0) hours += 24;
    if (mins < 0) {
      mins += 60;
      hours -= 1;
    }
    
    return {
      total: hours + mins / 60,
      formatted: `${hours} HRS ${mins} MIN`
    };
  };

  const currentDuration = useMemo(() => calculateHours(newLog.bedtime, newLog.wake_time), [newLog.bedtime, newLog.wake_time]);

  const stats = useMemo(() => {
    if (logs.length === 0) return { avg: 0, best: 0, worst: 0, debt: 0 };
    
    const weekLogs = logs.slice(0, 7);
    const hours = weekLogs.map(l => l.hours_slept);
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
    const best = Math.max(...hours);
    const worst = Math.min(...hours);
    const totalThisWeek = hours.reduce((a, b) => a + b, 0);
    const debt = (sleepGoal * 7) - totalThisWeek;

    return { avg, best, worst, debt };
  }, [logs, sleepGoal]);

  const chartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA');
      const log = logs.find(l => l.log_date === dateStr);
      
      data.push({
        name: days[d.getDay() === 0 ? 6 : d.getDay() - 1],
        hours: log ? log.hours_slept : 0,
        date: dateStr
      });
    }
    return data;
  }, [logs]);

  const addLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'sleep_logs'), {
        ...newLog,
        hours_slept: Number(currentDuration.total.toFixed(1)),
        user_id: auth.currentUser.uid,
        created_at: serverTimestamp()
      });
      showToast('SLEEP LOGGED ✓', 'success');
      setNewLog({
        log_date: new Date().toLocaleDateString('en-CA'),
        bedtime: '22:00',
        wake_time: '06:00',
        quality: 3,
        mood: 'OKAY',
        tags: [],
        notes: ''
      });
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.CREATE, 'sleep_logs');
    }
  };

  const toggleTag = (tag: string) => {
    setNewLog(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  if (loading) return <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse tracking-widest">SYNCHRONIZING RECOVERY DATA...</div>;

  return (
    <div className="min-h-screen bg-bg-main p-4 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-6xl text-gold mb-2">RECOVERY LOG</h1>
        <p className="text-text-muted text-xs tracking-widest font-mono uppercase">Regeneration status: Monitoring</p>
      </div>

      {/* Chart */}
      <div className="sharp-card p-6 bg-bg-sidebar">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="name" stroke="#7A7A7A" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#7A7A7A" fontSize={10} tickLine={false} axisLine={false} domain={[0, 12]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111111', border: '1px solid #2A2A2A', borderRadius: '0' }}
                itemStyle={{ color: '#C8A96E' }}
              />
              <Bar dataKey="hours" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.hours === 0 ? '#2A2A2A' : entry.hours >= sleepGoal ? '#2E7D32' : entry.hours >= sleepGoal - 1 ? '#C8A96E' : '#8B0000'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'AVG THIS WEEK', value: `${stats.avg.toFixed(1)}H` },
          { label: 'BEST NIGHT', value: `${stats.best.toFixed(1)}H` },
          { label: 'WORST NIGHT', value: `${stats.worst.toFixed(1)}H` },
          { label: 'SLEEP DEBT', value: `${stats.debt.toFixed(1)}H`, color: stats.debt > 0 ? 'text-missed' : 'text-done' }
        ].map((stat, i) => (
          <div key={i} className="sharp-card p-4 text-center">
            <p className="font-oswald text-3xl text-gold font-bold mb-1" style={{ color: stat.color }}>{stat.value}</p>
            <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Entry Card */}
        <div className="sharp-card p-8 space-y-8">
          <h2 className="text-2xl text-gold font-bebas tracking-widest">LOG YOUR SLEEP</h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Moon size={12} /> LIGHTS OUT
              </label>
              <input 
                type="time" 
                value={newLog.bedtime}
                onChange={(e) => setNewLog({...newLog, bedtime: e.target.value})}
                className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Sun size={12} /> RISE TIME
              </label>
              <input 
                type="time" 
                value={newLog.wake_time}
                onChange={(e) => setNewLog({...newLog, wake_time: e.target.value})}
                className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none font-mono"
              />
            </div>
          </div>

          <div className="text-center py-4 border-y border-border">
            <p className="font-oswald text-5xl text-gold font-bold">{currentDuration.formatted}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mt-2">TARGET: {sleepGoal} HRS</p>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] text-text-muted uppercase tracking-widest">Sleep Quality</label>
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map(num => (
                <button 
                  key={num}
                  onClick={() => setNewLog({...newLog, quality: num})}
                  className="transition-transform hover:scale-125"
                >
                  <Flame size={32} className={num <= newLog.quality ? 'text-gold fill-gold' : 'text-border'} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] text-text-muted uppercase tracking-widest">Wake Mood</label>
            <div className="flex flex-wrap gap-4">
              {MOODS.map(m => (
                <button
                  key={m.label}
                  onClick={() => setNewLog({...newLog, mood: m.label})}
                  className={`flex flex-col items-center gap-2 p-3 border transition-all ${
                    newLog.mood === m.label ? 'border-gold bg-gold/5' : 'border-border hover:border-text-muted'
                  }`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-[9px] font-mono text-text-muted">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] text-text-muted uppercase tracking-widest">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 border text-[10px] font-mono transition-all ${
                    newLog.tags.includes(tag) ? 'border-gold text-gold bg-gold/5' : 'border-border text-text-muted hover:border-text-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-text-muted uppercase tracking-widest">Notes</label>
            <textarea 
              value={newLog.notes}
              onChange={(e) => setNewLog({...newLog, notes: e.target.value})}
              className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none font-mono text-sm h-24"
              placeholder="ANY OBSERVATIONS?"
            />
          </div>

          <button 
            onClick={addLog}
            className="w-full bg-gold text-bg-main py-4 font-bebas text-2xl tracking-widest hover:bg-opacity-90 transition-all"
          >
            SAVE SLEEP LOG
          </button>
        </div>

        {/* Past Logs */}
        <div className="space-y-4">
          <h2 className="text-2xl text-gold font-bebas tracking-widest">PAST RECOVERY DATA</h2>
          <div className="space-y-4 max-h-[800px] overflow-y-auto no-scrollbar">
            {logs.length === 0 ? (
              <div className="sharp-card p-12 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <Bed size={48} className="text-gold" />
                <p className="font-bebas text-2xl tracking-widest">LOG YOUR RECOVERY.</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="sharp-card p-4 space-y-4"
                >
                  <div 
                    className="flex items-center justify-between cursor-pointer tap-target"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[50px]">
                      <p className="font-bebas text-2xl text-gold leading-none">{new Date(log.log_date).getDate()}</p>
                      <p className="font-mono text-[9px] text-text-muted">{new Date(log.log_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</p>
                    </div>
                    <div className="h-8 w-[1px] bg-border" />
                    <div>
                      <p className="font-oswald text-xl font-bold">{log.hours_slept} HRS</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(num => (
                          <Flame key={num} size={10} className={num <= log.quality ? 'text-gold fill-gold' : 'text-border'} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl">{MOODS.find(m => m.label === log.mood)?.icon}</span>
                    {expandedLog === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedLog === log.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border pt-4 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                        <div className="flex items-center gap-2 text-text-muted">
                          <Moon size={12} /> {log.bedtime}
                        </div>
                        <div className="flex items-center gap-2 text-text-muted">
                          <Sun size={12} /> {log.wake_time}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {log.tags?.map(tag => (
                          <span key={tag} className="px-2 py-0.5 border border-border text-[9px] text-text-muted">{tag}</span>
                        ))}
                      </div>
                      {log.notes && (
                        <p className="font-mono text-xs text-text-muted italic bg-bg-main p-3 border border-border">
                          "{log.notes}"
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
}
