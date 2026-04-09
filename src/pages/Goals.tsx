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
  updateDoc,
  deleteDoc,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { Plus, X, ChevronDown, ChevronUp, ArrowRight, Target } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../components/Toast';

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  target_date: string;
  sub_tasks?: SubTask[];
  last_reset_date?: string;
}

interface GoalCardProps {
  key?: string;
  goal: Goal;
  activeTab: 'daily' | 'weekly' | 'monthly';
  expandedGoal: string | null;
  setExpandedGoal: (id: string | null) => void;
  toggleGoal: (id: string, completed: boolean) => void;
  deleteGoal: (id: string) => void;
  toggleSubTask: (goalId: string, subTaskId: string) => void;
  carryToNextWeek: (goal: Goal) => void;
}

const GoalCard = ({ 
  goal, 
  activeTab, 
  expandedGoal, 
  setExpandedGoal, 
  toggleGoal, 
  deleteGoal, 
  toggleSubTask, 
  carryToNextWeek 
}: GoalCardProps) => {
  const [isFlashing, setIsFlashing] = useState(false);

  const handleToggle = () => {
    if (!goal.completed) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 500);
    }
    toggleGoal(goal.id, goal.completed);
  };

  const progress = goal.sub_tasks?.length 
    ? (goal.sub_tasks.filter(st => st.completed).length / goal.sub_tasks.length) * 100 
    : 0;

  return (
    <div className={`sharp-card p-4 relative transition-all duration-300 group ${goal.completed ? 'opacity-50' : ''} ${isFlashing ? 'animate-gold-flash' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
          goal.priority === 'high' ? 'bg-missed' : 
          goal.priority === 'medium' ? 'bg-gold' : 
          'bg-text-muted'
        }`} />
        
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-mono tracking-tight transition-all relative inline-block ${goal.completed ? 'text-text-muted' : ''}`}>
            {goal.title.toUpperCase()}
            {goal.completed && <span className="strikethrough-line" />}
          </h3>
          <p className="text-[11px] text-text-muted mt-1 line-clamp-2">{goal.description}</p>
          
          {activeTab === 'monthly' && (
            <div className="mt-4 flex items-center gap-4">
              <div className="relative w-12 h-12">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-border" />
                  <circle 
                    cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * progress) / 100}
                    className={`transition-all duration-1000 ${
                      progress > 80 ? 'text-gold' : progress > 50 ? 'text-done' : 'text-missed'
                    }`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-oswald">{Math.round(progress)}%</span>
              </div>
              <button 
                onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                className="text-[10px] text-gold uppercase flex items-center gap-1"
              >
                {expandedGoal === goal.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Sub-tasks
              </button>
            </div>
          )}

          {activeTab === 'weekly' && new Date().getDay() === 0 && !goal.completed && (
            <button 
              onClick={() => carryToNextWeek(goal)}
              className="mt-3 flex items-center gap-2 text-[10px] text-gold border border-gold/30 px-2 py-1 hover:bg-gold/10 transition-all"
            >
              <ArrowRight size={12} />
              CARRY TO NEXT WEEK?
            </button>
          )}

          <AnimatePresence>
            {expandedGoal === goal.id && goal.sub_tasks && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-4 space-y-2"
              >
                {goal.sub_tasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleSubTask(goal.id, st.id)}
                      className={`w-4 h-4 border flex items-center justify-center transition-all ${st.completed ? 'bg-gold border-gold text-bg-main' : 'border-border'}`}
                    >
                      {st.completed && <Plus size={10} className="rotate-45" />}
                    </button>
                    <span className={`text-[10px] ${st.completed ? 'line-through text-text-muted' : ''}`}>{st.title}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={handleToggle}
            className={`w-6 h-6 border flex items-center justify-center transition-all tap-target ${goal.completed ? 'bg-gold border-gold text-bg-main scale-110' : 'border-border hover:border-gold'}`}
          >
            {goal.completed && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Plus size={16} className="rotate-45" /></motion.div>}
          </button>
          <button onClick={() => deleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-missed transition-all tap-target">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Goals() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    notes: ''
  });

  const todayStr = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'goals'),
      where('user_id', '==', auth.currentUser.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
      
      // Auto-reset daily goals if date changed
      const dailyGoals = data.filter(g => g.type === 'daily');
      const needsReset = dailyGoals.some(g => g.last_reset_date !== todayStr);
      
      if (needsReset) {
        const batch = writeBatch(db);
        dailyGoals.forEach(g => {
          if (g.last_reset_date !== todayStr) {
            batch.update(doc(db, 'goals', g.id), {
              completed: false,
              last_reset_date: todayStr
            });
          }
        });
        batch.commit().catch(err => handleFirestoreError(err, OperationType.UPDATE, 'goals_reset'));
      }

      setGoals(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'goals'));

    return unsubscribe;
  }, [todayStr]);

  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title.trim() || !auth.currentUser) return;

    const currentTabGoals = goals.filter(g => g.type === activeTab);
    if (activeTab === 'daily' && currentTabGoals.length >= 5) {
      setError("MAXIMUM 5 MISSIONS. COMPLETE ONE FIRST.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await addDoc(collection(db, 'goals'), {
        ...newGoal,
        type: activeTab,
        user_id: auth.currentUser.uid,
        completed: false,
        last_reset_date: activeTab === 'daily' ? todayStr : null,
        created_at: serverTimestamp(),
        target_date: todayStr,
        sub_tasks: activeTab !== 'daily' ? [] : null
      });
      showToast('GOAL ADDED ✓', 'success');
      setNewGoal({ title: '', description: '', priority: 'medium', notes: '' });
      setIsAddModalOpen(false);
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.CREATE, 'goals');
    }
  };

  const toggleGoal = async (id: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'goals', id), { completed: !completed });
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.UPDATE, `goals/${id}`);
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'goals', id));
      showToast('GOAL DELETED', 'delete');
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.DELETE, `goals/${id}`);
    }
  };

  const toggleSubTask = async (goalId: string, subTaskId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal || !goal.sub_tasks) return;

    const updatedSubTasks = goal.sub_tasks.map(st => 
      st.id === subTaskId ? { ...st, completed: !st.completed } : st
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), { sub_tasks: updatedSubTasks });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `goals/${goalId}/subtasks`);
    }
  };

  const carryToNextWeek = async (goal: Goal) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'goals'), {
        ...goal,
        id: undefined,
        completed: false,
        created_at: serverTimestamp()
      });
      await deleteDoc(doc(db, 'goals', goal.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'goals_carry');
    }
  };

  const filteredGoals = goals.filter(g => g.type === activeTab);
  const completedCount = filteredGoals.filter(g => g.completed).length;

  if (loading) return <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse tracking-widest">LOADING STRATEGIC OBJECTIVES...</div>;

  return (
    <div className="min-h-screen bg-bg-main p-4 md:p-8">
      {/* Tabs */}
      <div className="flex gap-8 mb-12 border-b border-border">
        {(['daily', 'weekly', 'monthly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 font-bebas text-2xl tracking-widest transition-all relative ${
              activeTab === tab ? 'text-gold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {tab.toUpperCase()}
            {activeTab === tab && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl text-gold mb-2">
          {activeTab === 'daily' ? `TODAY'S MISSION — ${new Date().toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}` : 
           activeTab === 'weekly' ? `WEEKLY OPERATIONS` : `MONTHLY STRATEGY`}
        </h1>
        <p className="text-text-muted text-xs tracking-widest font-mono">
          {activeTab === 'daily' ? 'MAX 5 DAILY MISSIONS. FOCUS.' : 
           activeTab === 'weekly' ? 'LONG-TERM EXECUTION. NO SLACK.' : 'HIGH-LEVEL OBJECTIVES.'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-12 space-y-2">
        <div className="flex justify-between text-[10px] text-text-muted uppercase tracking-widest">
          <span>{completedCount} / {activeTab === 'daily' ? 5 : filteredGoals.length} MISSIONS COMPLETE</span>
          <span>{Math.round((completedCount / (activeTab === 'daily' ? 5 : filteredGoals.length || 1)) * 100)}%</span>
        </div>
        <div className="h-2 bg-bg-sidebar border border-border">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / (activeTab === 'daily' ? 5 : filteredGoals.length || 1)) * 100}%` }}
            className="h-full bg-gold"
          />
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-missed text-white p-4 mb-8 font-bebas text-xl tracking-widest text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="sharp-card p-20 flex flex-col items-center justify-center text-center space-y-6">
          <Target size={48} className="text-gold opacity-50" />
          <h2 className="text-2xl md:text-3xl text-text-muted font-bebas tracking-widest uppercase">NO MISSIONS SET.</h2>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gold text-bg-main px-8 py-3 font-bebas text-xl tracking-widest hover:scale-105 transition-all"
          >
            SET FIRST TARGET
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGoals.map((goal, index) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GoalCard 
                goal={goal} 
                activeTab={activeTab}
                expandedGoal={expandedGoal}
                setExpandedGoal={setExpandedGoal}
                toggleGoal={toggleGoal}
                deleteGoal={deleteGoal}
                toggleSubTask={toggleSubTask}
                carryToNextWeek={carryToNextWeek}
              />
            </motion.div>
          ))}
          
          {filteredGoals.length < (activeTab === 'daily' ? 5 : 99) && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="sharp-card p-8 flex flex-col items-center justify-center gap-4 border-dashed border-2 hover:bg-white/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center group-hover:border-gold group-hover:text-gold transition-all">
                <Plus size={24} />
              </div>
              <span className="font-bebas text-xl tracking-widest text-text-muted group-hover:text-gold">ADD NEW TARGET</span>
            </button>
          )}
        </div>
      )}

      {/* Add Goal Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-sidebar border border-border gold-top-border w-full max-w-md p-8 modal-full md:h-auto"
            >
              <h2 className="text-3xl text-gold mb-8 font-bebas tracking-widest">SET YOUR TARGET</h2>
              <form onSubmit={addGoal} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-widest">Title</label>
                  <input 
                    autoFocus
                    required
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                    className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none font-mono text-sm"
                    placeholder="ENTER OBJECTIVE"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-widest">Description</label>
                  <textarea 
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                    className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none font-mono text-sm h-20"
                    placeholder="BRIEF MISSION OVERVIEW"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase tracking-widest">Priority</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewGoal({...newGoal, priority: p})}
                        className={`flex-1 py-2 font-bebas text-lg tracking-widest border transition-all ${
                          newGoal.priority === p ? 'bg-gold text-bg-main border-gold' : 'border-border text-text-muted hover:border-text-muted'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-widest">Notes</label>
                  <textarea 
                    value={newGoal.notes}
                    onChange={(e) => setNewGoal({...newGoal, notes: e.target.value})}
                    className="w-full bg-bg-main border border-border p-3 text-text-main focus:border-gold outline-none font-mono text-sm h-20"
                    placeholder="ADDITIONAL INTEL..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-gold text-bg-main py-3 font-bebas text-xl tracking-widest hover:bg-opacity-90 transition-all">ADD TARGET</button>
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 border border-border py-3 font-bebas text-xl tracking-widest hover:bg-white/5 transition-all">CANCEL</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
