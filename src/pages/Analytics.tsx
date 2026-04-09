import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Shield,
  Zap,
  BarChart3,
  Calendar as CalendarIcon
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface Habit {
  id: string;
  name: string;
  user_id: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  status: 'done' | 'missed' | 'protected' | 'none';
}

interface Goal {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  target_date: string;
}

interface SleepLog {
  id: string;
  log_date: string;
  hours_slept: number;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  day_score: number;
}

interface StreakProtection {
  habit_id: string;
  month: string;
}

export default function Analytics() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [streakProtection, setStreakProtection] = useState<StreakProtection[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    const habitsQ = query(collection(db, 'habits'), where('user_id', '==', userId));
    const logsQ = query(collection(db, 'habit_logs'), where('user_id', '==', userId));
    const goalsQ = query(collection(db, 'goals'), where('user_id', '==', userId));
    const sleepQ = query(collection(db, 'sleep_logs'), where('user_id', '==', userId));
    const journalQ = query(collection(db, 'journal_entries'), where('user_id', '==', userId));
    const protectionQ = query(collection(db, 'streak_protection'), where('user_id', '==', userId));

    const unsubHabits = onSnapshot(habitsQ, (s) => setHabits(s.docs.map(d => ({ id: d.id, ...d.data() } as Habit))));
    const unsubLogs = onSnapshot(logsQ, (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as HabitLog))));
    const unsubGoals = onSnapshot(goalsQ, (s) => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() } as Goal))));
    const unsubSleep = onSnapshot(sleepQ, (s) => setSleepLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as SleepLog))));
    const unsubJournal = onSnapshot(journalQ, (s) => setJournalEntries(s.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry))));
    const unsubProtection = onSnapshot(protectionQ, (s) => {
      setStreakProtection(s.docs.map(d => d.data() as StreakProtection));
      setLoading(false);
    });

    return () => {
      unsubHabits(); unsubLogs(); unsubGoals(); unsubSleep(); unsubJournal(); unsubProtection();
    };
  }, []);

  const monthYearStr = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  const changeMonth = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  // --- CALCULATIONS ---

  const monthLogs = useMemo(() => {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return logs.filter(l => {
      const d = new Date(l.log_date);
      return d >= startOfMonth && d <= endOfMonth;
    });
  }, [logs, selectedDate]);

  const completionRate = useMemo(() => {
    if (monthLogs.length === 0) return 0;
    const doneCount = monthLogs.filter(l => l.status === 'done' || l.status === 'protected').length;
    return Math.round((doneCount / monthLogs.length) * 100);
  }, [monthLogs]);

  const habitBreakdown = useMemo(() => {
    return habits.map(habit => {
      const hLogs = monthLogs.filter(l => l.habit_id === habit.id);
      const done = hLogs.filter(l => l.status === 'done' || l.status === 'protected').length;
      const total = hLogs.length || 1;
      const rate = Math.round((done / total) * 100);
      return { name: habit.name, rate, done, total };
    }).sort((a, b) => b.rate - a.rate);
  }, [habits, monthLogs]);

  const bestHabit = habitBreakdown[0];
  const needsWorkHabit = habitBreakdown[habitBreakdown.length - 1];

  const longestStreak = useMemo(() => {
    let maxStreak = 0;
    habits.forEach(habit => {
      const hLogs = logs.filter(l => l.habit_id === habit.id).sort((a, b) => b.log_date.localeCompare(a.log_date));
      let current = 0;
      let best = 0;
      // Simple streak calc for analytics
      const sortedDates = hLogs.map(l => l.log_date);
      const today = new Date().toLocaleDateString('en-CA');
      
      let streak = 0;
      let checkDate = new Date();
      
      while (true) {
        const dStr = checkDate.toLocaleDateString('en-CA');
        const log = hLogs.find(l => l.log_date === dStr);
        if (log && (log.status === 'done' || log.status === 'protected')) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      if (streak > maxStreak) maxStreak = streak;
    });
    return maxStreak;
  }, [habits, logs]);

  const heatmapData = useMemo(() => {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
      const dateStr = date.toLocaleDateString('en-CA');
      const dayLogs = logs.filter(l => l.log_date === dateStr);
      const done = dayLogs.filter(l => l.status === 'done' || l.status === 'protected').length;
      const total = habits.length || 1;
      const rate = Math.round((done / total) * 100);
      const isFuture = date > today;

      data.push({ date: dateStr, rate, done, total, isFuture, day: i });
    }
    return data;
  }, [selectedDate, logs, habits]);

  const trendData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      
      const mLogs = logs.filter(l => {
        const ld = new Date(l.log_date);
        return ld >= start && ld <= end;
      });
      
      const done = mLogs.filter(l => l.status === 'done' || l.status === 'protected').length;
      const rate = mLogs.length > 0 ? Math.round((done / mLogs.length) * 100) : 0;
      
      data.push({ name: monthName, rate });
    }
    return data;
  }, [logs]);

  const trendDiff = trendData.length >= 2 
    ? trendData[trendData.length - 1].rate - trendData[trendData.length - 2].rate 
    : 0;

  const streakRankings = useMemo(() => {
    return habits.map(habit => {
      const hLogs = logs.filter(l => l.habit_id === habit.id).sort((a, b) => b.log_date.localeCompare(a.log_date));
      
      // Current Streak
      let current = 0;
      let checkDate = new Date();
      while (true) {
        const dStr = checkDate.toLocaleDateString('en-CA');
        const log = hLogs.find(l => l.log_date === dStr);
        if (log && (log.status === 'done' || log.status === 'protected')) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Best Streak
      let best = 0;
      let temp = 0;
      const sortedLogs = [...hLogs].sort((a, b) => a.log_date.localeCompare(b.log_date));
      let lastDate: Date | null = null;

      sortedLogs.forEach(l => {
        if (l.status === 'done' || l.status === 'protected') {
          const currentDate = new Date(l.log_date);
          if (lastDate) {
            const diff = (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
              temp++;
            } else {
              temp = 1;
            }
          } else {
            temp = 1;
          }
          lastDate = currentDate;
          if (temp > best) best = temp;
        } else {
          temp = 0;
          lastDate = null;
        }
      });

      const usedGrace = streakProtection.some(p => p.habit_id === habit.id && p.month === selectedDate.toLocaleDateString('en-CA').substring(0, 7));

      return { name: habit.name, current, best, usedGrace };
    }).sort((a, b) => b.current - a.current);
  }, [habits, logs, streakProtection, selectedDate]);

  const forgeHistory = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toLocaleDateString('en-CA');
      
      // Calculate Forge Score for this day
      const dayLogs = logs.filter(l => l.log_date === dStr);
      const hScore = habits.length > 0 ? (dayLogs.filter(l => l.status === 'done' || l.status === 'protected').length / habits.length) * 50 : 0;
      
      const dayGoals = goals.filter(g => g.target_date === dStr && g.type === 'daily');
      const gScore = dayGoals.length > 0 ? (dayGoals.filter(g => g.completed).length / dayGoals.length) * 30 : 0;
      
      const daySleep = sleepLogs.find(l => l.log_date === dStr);
      let sScore = 0;
      if (daySleep) {
        const h = daySleep.hours_slept;
        if (h >= 8) sScore = 20;
        else if (h >= 7) sScore = 12;
        else if (h >= 6) sScore = 6;
      }
      
      const total = Math.round(hScore + gScore + sScore);
      data.push({ date: dStr, score: total });
    }
    return data;
  }, [logs, habits, goals, sleepLogs]);

  const forgeAvg = Math.round(forgeHistory.reduce((acc, curr) => acc + curr.score, 0) / (forgeHistory.length || 1));

  if (loading) return <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse tracking-widest">ANALYZING PERFORMANCE...</div>;

  return (
    <div className="p-4 md:p-8 space-y-12 pb-20">
      {/* Month Selector */}
      <div className="flex items-center justify-center gap-8">
        <button onClick={() => changeMonth(-1)} className="text-text-muted hover:text-gold transition-colors"><ChevronLeft size={32} /></button>
        <h1 className="text-4xl md:text-6xl font-bebas tracking-tighter">{monthYearStr}</h1>
        <button onClick={() => changeMonth(1)} className="text-text-muted hover:text-gold transition-colors"><ChevronRight size={32} /></button>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="sharp-card p-6">
          <p className="font-oswald text-5xl font-bold text-gold">{completionRate}%</p>
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest mt-1">habits this month</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="sharp-card p-6">
          <p className="font-oswald text-5xl font-bold text-text-main">{longestStreak} DAYS 🔥</p>
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest mt-1">current best streak</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="sharp-card p-6">
          <p className="font-bebas text-2xl text-text-main truncate">{bestHabit?.name || 'N/A'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-done/20 text-done text-[10px] font-bold px-2 py-0.5 border border-done/30">
              {bestHabit?.done}/{bestHabit?.total} — {bestHabit?.rate}%
            </span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="sharp-card p-6">
          <p className="font-bebas text-2xl text-missed truncate">{needsWorkHabit?.name || 'N/A'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-missed/20 text-missed text-[10px] font-bold px-2 py-0.5 border border-missed/30">
              {needsWorkHabit?.done}/{needsWorkHabit?.total} — {needsWorkHabit?.rate}%
            </span>
          </div>
        </motion.div>
      </div>

      {/* Section 2: Monthly Heatmap */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="sharp-card p-8">
        <h2 className="text-2xl font-bebas tracking-widest mb-8">DAILY PERFORMANCE MAP</h2>
        <div className="flex flex-wrap gap-2">
          {heatmapData.map((day, i) => (
            <div 
              key={i}
              title={`${day.date} — ${day.done}/${day.total} habits — ${day.rate}%`}
              className={`w-8 h-8 flex items-center justify-center text-[10px] font-mono transition-all border ${
                day.isFuture ? 'bg-bg-sidebar border-dashed border-border text-text-muted' : 
                day.rate === 100 ? 'bg-done border-done text-white' :
                day.rate >= 75 ? 'bg-[#4CAF50] border-[#4CAF50] text-white' :
                day.rate >= 50 ? 'bg-gold border-gold text-bg-main' :
                day.rate >= 25 ? 'bg-[#5D4037] border-[#5D4037] text-white' :
                day.rate > 0 ? 'bg-[#3E2E2E] border-[#3E2E2E] text-white' :
                'bg-bg-card border-border text-text-muted'
              }`}
            >
              {day.day}
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-4 text-[9px] font-mono text-text-muted uppercase tracking-widest">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-bg-card border border-border" />
            <div className="w-3 h-3 bg-[#3E2E2E]" />
            <div className="w-3 h-3 bg-[#5D4037]" />
            <div className="w-3 h-3 bg-gold" />
            <div className="w-3 h-3 bg-[#4CAF50]" />
            <div className="w-3 h-3 bg-done" />
          </div>
          <span>More</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 3: Habit Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="sharp-card p-8">
          <h2 className="text-2xl font-bebas tracking-widest mb-8">HABIT BREAKDOWN</h2>
          <div className="space-y-6">
            {habitBreakdown.map((habit, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
                  <span>{habit.name}</span>
                  <span className="text-gold">{habit.rate}%</span>
                </div>
                <div className="h-2 bg-bg-sidebar border border-border overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${habit.rate}%` }}
                    className={`h-full ${habit.rate > 80 ? 'bg-gold' : habit.rate > 50 ? 'bg-done' : 'bg-missed'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Section 4: 6 Month Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="sharp-card p-8">
          <div className="flex justify-between items-start mb-8">
            <h2 className="text-2xl font-bebas tracking-widest">6-MONTH PROGRESS TREND</h2>
            <div className={`flex items-center gap-1 font-mono text-[10px] font-bold ${trendDiff >= 0 ? 'text-done' : 'text-missed'}`}>
              {trendDiff >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {trendDiff >= 0 ? '+' : ''}{trendDiff}% VS LAST MONTH
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="name" stroke="#7A7A7A" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#7A7A7A" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid #2A2A2A', borderRadius: '0', fontFamily: 'IBM Plex Mono' }}
                  itemStyle={{ color: '#C8A96E' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#C8A96E" 
                  strokeWidth={3} 
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle 
                        cx={cx} cy={cy} r={4} 
                        fill={payload.rate > 80 ? '#C8A96E' : payload.rate > 50 ? '#2E7D32' : '#8B0000'} 
                        stroke="#0A0A0A" strokeWidth={2} 
                      />
                    );
                  }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Section 5: Streak Rankings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="sharp-card p-8">
        <h2 className="text-2xl font-bebas tracking-widest mb-8">STREAK RANKINGS</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[10px] font-mono text-text-muted uppercase tracking-widest">
                <th className="pb-4 font-normal">RANK</th>
                <th className="pb-4 font-normal">HABIT NAME</th>
                <th className="pb-4 font-normal">🔥 CURRENT</th>
                <th className="pb-4 font-normal">BEST EVER</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {streakRankings.map((habit, i) => (
                <tr key={i} className={`group border-b border-border/50 hover:bg-white/5 transition-all ${i === 0 ? 'relative' : ''}`}>
                  <td className="py-4">
                    {i === 0 && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gold" />}
                    <span className={i === 0 ? 'text-gold font-bold' : 'text-text-muted'}>#{i + 1}</span>
                  </td>
                  <td className="py-4 font-bebas text-lg tracking-wider flex items-center gap-2">
                    {habit.name}
                    {habit.usedGrace && <Shield size={12} className="text-gold" title="Grace day used this month" />}
                  </td>
                  <td className="py-4 text-gold font-bold">{habit.current} DAYS</td>
                  <td className="py-4 text-text-muted">{habit.best} DAYS</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Section 6: Forge Score History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="sharp-card p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bebas tracking-widest">FORGE SCORE — LAST 30 DAYS</h2>
            <p className="text-[10px] font-mono text-gold uppercase tracking-[0.2em] mt-1">30-DAY AVG: {forgeAvg}</p>
          </div>
          <Zap size={24} className="text-gold" />
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forgeHistory}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C8A96E" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#C8A96E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis stroke="#7A7A7A" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111111', border: '1px solid #2A2A2A', borderRadius: '0', fontFamily: 'IBM Plex Mono' }}
                itemStyle={{ color: '#C8A96E' }}
              />
              <Area type="monotone" dataKey="score" stroke="#C8A96E" fillOpacity={1} fill="url(#colorScore)" strokeWidth={2} />
              <Line type="monotone" dataKey={() => forgeAvg} stroke="#C8A96E" strokeDasharray="5 5" dot={false} strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
