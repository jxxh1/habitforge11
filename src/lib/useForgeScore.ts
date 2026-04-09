import { useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';

export interface ForgeScoreData {
  score: number;
  label: 'ELITE' | 'SOLID' | 'AVERAGE' | 'WEAK';
  color: string;
}

export function useForgeScore() {
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [dailyGoals, setDailyGoals] = useState<any[]>([]);
  const [sleepLog, setSleepLog] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    const habitsQ = query(collection(db, 'habits'), where('user_id', '==', userId));
    const habitLogsQ = query(
      collection(db, 'habit_logs'), 
      where('user_id', '==', userId),
      where('log_date', '==', todayStr)
    );
    const goalsQ = query(
      collection(db, 'goals'), 
      where('user_id', '==', userId),
      where('type', '==', 'daily')
    );
    const sleepQ = query(
      collection(db, 'sleep_logs'), 
      where('user_id', '==', userId),
      where('log_date', '==', todayStr)
    );

    const unsubHabits = onSnapshot(habitsQ, (s) => setHabits(s.docs.map(d => d.data())));
    const unsubLogs = onSnapshot(habitLogsQ, (s) => setHabitLogs(s.docs.map(d => d.data())));
    const unsubGoals = onSnapshot(goalsQ, (s) => setDailyGoals(s.docs.map(d => d.data())));
    const unsubSleep = onSnapshot(sleepQ, (s) => {
      setSleepLog(s.docs[0]?.data() || null);
      setLoading(false);
    });

    return () => {
      unsubHabits();
      unsubLogs();
      unsubGoals();
      unsubSleep();
    };
  }, [todayStr]);

  const forgeScoreData = useMemo((): ForgeScoreData => {
    // Habits Score (max 50)
    const totalHabits = habits.length;
    const completedHabits = habitLogs.filter(l => l.status === 'done' || l.status === 'protected').length;
    const habitsScore = totalHabits > 0 ? (completedHabits / totalHabits) * 50 : 0;

    // Goals Score (max 30)
    const totalGoals = dailyGoals.length;
    const completedGoals = dailyGoals.filter(g => g.completed).length;
    const goalsScore = totalGoals > 0 ? (completedGoals / totalGoals) * 30 : 0;

    // Sleep Score (max 20)
    const sleepGoal = 8;
    let sleepScore = 0;
    if (sleepLog) {
      const hours = sleepLog.hours_slept;
      if (hours >= sleepGoal) sleepScore = 20;
      else if (hours >= sleepGoal - 1) sleepScore = 12;
      else if (hours >= sleepGoal - 2) sleepScore = 6;
    }

    const total = Math.round(habitsScore + goalsScore + sleepScore);
    const score = Math.min(total, 100);

    let label: 'ELITE' | 'SOLID' | 'AVERAGE' | 'WEAK' = 'WEAK';
    let color = '#8B0000'; // red

    if (score >= 80) {
      label = 'ELITE';
      color = '#C8A96E'; // gold
    } else if (score >= 60) {
      label = 'SOLID';
      color = '#2E7D32'; // green
    } else if (score >= 40) {
      label = 'AVERAGE';
      color = '#7A7A7A'; // muted
    }

    return { score, label, color };
  }, [habits, habitLogs, dailyGoals, sleepLog]);

  return { ...forgeScoreData, loading };
}
