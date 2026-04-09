import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  orderBy,
  limit,
  setDoc
} from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Bold, 
  Italic, 
  List as ListIcon, 
  Quote, 
  X, 
  Check,
  Menu,
  Edit3,
  BookOpen
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../components/Toast';

interface JournalEntry {
  id: string;
  entry_date: string;
  priority: string;
  energy_word: string;
  mood: string;
  did_today: string[];
  what_happened: string;
  went_well: string;
  would_change: string;
  grateful: string;
  day_score: number;
  is_win: boolean;
  user_id: string;
}

const MOOD_OPTIONS = [
  { emoji: '😤', label: 'WRECKED' },
  { emoji: '😑', label: 'TIRED' },
  { emoji: '😐', label: 'NEUTRAL' },
  { emoji: '💪', label: 'READY' },
  { emoji: '🔥', label: 'LOCKED IN' }
];

export default function Journal() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'week' | 'month' | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'write'>('write');
  const [expandedSections, setExpandedSections] = useState<string[]>(['morning', 'score']);

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const [formData, setFormData] = useState<Omit<JournalEntry, 'id' | 'user_id'>>({
    entry_date: todayStr,
    priority: '',
    energy_word: '',
    mood: 'NEUTRAL',
    did_today: [''],
    what_happened: '',
    went_well: '',
    would_change: '',
    grateful: '',
    day_score: 5,
    is_win: true
  });

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'journal_entries'),
      where('user_id', '==', auth.currentUser.uid),
      orderBy('entry_date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      setEntries(data);
      
      // If today's entry exists, load it by default
      const todayEntry = data.find(e => e.entry_date === todayStr);
      if (todayEntry && !selectedId) {
        setSelectedId(todayEntry.id);
        setFormData(todayEntry);
      }
      
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'journal_entries'));

    return unsubscribe;
  }, [todayStr]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.priority.toLowerCase().includes(q) || 
        e.what_happened.toLowerCase().includes(q) ||
        e.energy_word.toLowerCase().includes(q)
      );
    }

    const now = new Date();
    if (filterTab === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(e => new Date(e.entry_date) >= weekAgo);
    } else if (filterTab === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      result = result.filter(e => new Date(e.entry_date) >= monthAgo);
    }

    return result;
  }, [entries, searchQuery, filterTab]);

  const handleSave = async () => {
    if (!auth.currentUser) return;

    try {
      const dataToSave = {
        ...formData,
        user_id: auth.currentUser.uid,
        updated_at: serverTimestamp()
      };

      if (selectedId) {
        await updateDoc(doc(db, 'journal_entries', selectedId), dataToSave);
      } else {
        // Check if entry for this date already exists (to prevent duplicates if user manually changed date)
        const existing = entries.find(e => e.entry_date === formData.entry_date);
        if (existing) {
          await updateDoc(doc(db, 'journal_entries', existing.id), dataToSave);
          setSelectedId(existing.id);
        } else {
          const docRef = await addDoc(collection(db, 'journal_entries'), {
            ...dataToSave,
            created_at: serverTimestamp()
          });
          setSelectedId(docRef.id);
        }
      }

      showToast('ENTRY SAVED ✓', 'success');
    } catch (err) {
      showToast('SYNC FAILED', 'error');
      handleFirestoreError(err, OperationType.WRITE, 'journal_entries');
    }
  };

  const startNewEntry = () => {
    setSelectedId(null);
    setFormData({
      entry_date: todayStr,
      priority: '',
      energy_word: '',
      mood: 'NEUTRAL',
      did_today: [''],
      what_happened: '',
      went_well: '',
      would_change: '',
      grateful: '',
      day_score: 5,
      is_win: true
    });
    setView('write');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handleBulletKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newList = [...formData.did_today];
      newList.splice(index + 1, 0, '');
      setFormData({ ...formData, did_today: newList });
      // Focus next input after render
      setTimeout(() => {
        const inputs = document.querySelectorAll('.bullet-input');
        (inputs[index + 1] as HTMLInputElement)?.focus();
      }, 0);
    } else if (e.key === 'Backspace' && formData.did_today[index] === '' && formData.did_today.length > 1) {
      e.preventDefault();
      const newList = formData.did_today.filter((_, i) => i !== index);
      setFormData({ ...formData, did_today: newList });
      setTimeout(() => {
        const inputs = document.querySelectorAll('.bullet-input');
        (inputs[Math.max(0, index - 1)] as HTMLInputElement)?.focus();
      }, 0);
    }
  };

  const insertText = (before: string, after: string = '') => {
    if (!editorRef.current) return;
    const start = editorRef.current.selectionStart;
    const end = editorRef.current.selectionEnd;
    const text = formData.what_happened;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    setFormData({ ...formData, what_happened: newText });
    
    setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const getScoreLabel = (score: number) => {
    if (score <= 3) return "ROUGH DAY. TOMORROW IS A NEW BATTLE.";
    if (score <= 6) return "AVERAGE. YOU CAN DO MORE.";
    if (score <= 8) return "SOLID DAY. KEEP BUILDING.";
    return "ELITE EXECUTION. YOU FORGED TODAY.";
  };

  const wordCount = formData.what_happened.trim() ? formData.what_happened.trim().split(/\s+/).length : 0;

  if (loading) return <div className="p-20 text-center font-bebas text-4xl text-gold animate-pulse tracking-widest">RETRIEVING ARCHIVES...</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-bg-main overflow-hidden">
      {/* Mobile Toggle */}
      <div className="md:hidden flex border-b border-border bg-bg-sidebar p-2">
        <button 
          onClick={() => setView('list')}
          className={`flex-1 py-2 font-bebas tracking-widest ${view === 'list' ? 'text-gold' : 'text-text-muted'}`}
        >
          <Menu className="inline-block mr-2" size={18} /> LIST
        </button>
        <button 
          onClick={() => setView('write')}
          className={`flex-1 py-2 font-bebas tracking-widest ${view === 'write' ? 'text-gold' : 'text-text-muted'}`}
        >
          <Edit3 className="inline-block mr-2" size={18} /> WRITE
        </button>
      </div>

      {/* Left Panel: History List */}
      <div className={`${view === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[260px] border-r border-border bg-bg-sidebar shrink-0`}>
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
            <input 
              type="text"
              placeholder="SEARCH ARCHIVES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-main border border-border pl-9 pr-3 py-2 text-[10px] font-mono focus:border-gold outline-none"
            />
          </div>
          
          <div className="flex border-b border-border">
            {(['week', 'month', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 pb-2 text-[10px] font-bebas tracking-widest transition-all relative ${
                  filterTab === tab ? 'text-gold' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab.toUpperCase()}
                {filterTab === tab && <motion.div layoutId="filter-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-2">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center space-y-4 opacity-50">
              <BookOpen size={32} className="mx-auto text-gold" />
              <p className="font-bebas text-lg tracking-widest">YOUR RECORD STARTS TODAY.</p>
            </div>
          ) : (
            filteredEntries.map((entry, index) => {
              const date = new Date(entry.entry_date);
              const isActive = selectedId === entry.id;
              return (
                <motion.button
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setSelectedId(entry.id);
                    setFormData(entry);
                    setView('write');
                  }}
                  className={`w-full text-left p-3 border border-border transition-all relative group tap-target ${
                    isActive ? 'bg-bg-card border-gold/30' : 'hover:bg-white/5'
                  }`}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bebas text-lg tracking-wider">
                      {date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
                    </span>
                    <div className={`px-1.5 py-0.5 text-[9px] font-bold text-white ${
                      entry.day_score >= 8 ? 'bg-done' : entry.day_score >= 5 ? 'bg-gold' : 'bg-missed'
                    }`}>
                      {entry.day_score}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{MOOD_OPTIONS.find(m => m.label === entry.mood)?.emoji || '😐'}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 font-bold text-white ${
                        entry.is_win ? 'bg-done' : 'bg-missed'
                      }`}>
                        {entry.is_win ? 'WIN' : 'LOSS'}
                      </span>
                    </div>
                    <span className="text-[8px] text-text-muted font-mono uppercase">
                      {entry.what_happened.split(/\s+/).length} WORDS
                    </span>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-border">
          <button 
            onClick={startNewEntry}
            className="w-full border border-gold text-gold py-2 font-bebas tracking-widest hover:bg-gold hover:text-bg-main transition-all tap-target"
          >
            NEW ENTRY
          </button>
        </div>
      </div>

      {/* Right Panel: Editor */}
      <div className={`${view === 'write' ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-bg-main overflow-y-auto no-scrollbar relative`}>
        <div className="p-6 md:p-12 max-w-4xl mx-auto w-full space-y-8 pb-32">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bebas leading-none">
              {new Date(formData.entry_date).toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}
            </h1>
            <div className="h-[1px] bg-gold w-full opacity-50" />
          </div>

          {/* Accordion Sections */}
          <div className="space-y-6">
            {/* Morning Intention */}
            <div className="space-y-4">
              <button 
                onClick={() => toggleSection('morning')}
                className={`w-full text-left py-3 px-4 flex items-center justify-between border-b border-border group relative ${
                  expandedSections.includes('morning') ? 'bg-white/5' : ''
                }`}
              >
                {expandedSections.includes('morning') && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                <span className="font-bebas text-2xl tracking-widest flex items-center gap-3">
                  🌅 MORNING INTENTION
                </span>
                {expandedSections.includes('morning') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <AnimatePresence>
                {expandedSections.includes('morning') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-6 px-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] text-text-muted uppercase tracking-widest">Today's #1 Priority</label>
                      <input 
                        type="text"
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                        placeholder="WHAT IS THE CRITICAL MISSION?"
                        className="w-full bg-transparent border-b border-border py-2 text-xl font-mono focus:border-gold outline-none"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] text-text-muted uppercase tracking-widest">Morning Mood</label>
                      <div className="flex flex-wrap gap-3">
                        {MOOD_OPTIONS.map(m => (
                          <button
                            key={m.label}
                            onClick={() => setFormData({...formData, mood: m.label})}
                            className={`flex flex-col items-center gap-1 p-3 border transition-all ${
                              formData.mood === m.label ? 'border-gold bg-gold/5 scale-105' : 'border-border grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                            }`}
                          >
                            <span className="text-2xl">{m.emoji}</span>
                            <span className="text-[8px] font-mono">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-text-muted uppercase tracking-widest">One Word for Today</label>
                      <input 
                        type="text"
                        value={formData.energy_word}
                        onChange={(e) => setFormData({...formData, energy_word: e.target.value.toUpperCase()})}
                        placeholder="E.G. RELENTLESS"
                        className="w-full bg-transparent border-b border-border py-2 text-xl font-mono focus:border-gold outline-none tracking-[0.2em]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* What I Did Today */}
            <div className="space-y-4">
              <button 
                onClick={() => toggleSection('did')}
                className={`w-full text-left py-3 px-4 flex items-center justify-between border-b border-border group relative ${
                  expandedSections.includes('did') ? 'bg-white/5' : ''
                }`}
              >
                {expandedSections.includes('did') && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                <span className="font-bebas text-2xl tracking-widest flex items-center gap-3">
                  ✅ WHAT I DID TODAY
                </span>
                {expandedSections.includes('did') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <AnimatePresence>
                {expandedSections.includes('did') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2 px-4"
                  >
                    {formData.did_today.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 group">
                        <div className="w-5 h-5 border border-border flex items-center justify-center shrink-0">
                          {item && <Check size={12} className="text-gold" />}
                        </div>
                        <input 
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newList = [...formData.did_today];
                            newList[idx] = e.target.value;
                            setFormData({ ...formData, did_today: newList });
                          }}
                          onKeyDown={(e) => handleBulletKeyDown(e, idx)}
                          className="bullet-input flex-1 bg-transparent border-none py-1 text-sm font-mono focus:ring-0 outline-none"
                          placeholder="MISSION ACCOMPLISHED..."
                        />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* What Happened */}
            <div className="space-y-4">
              <button 
                onClick={() => toggleSection('happened')}
                className={`w-full text-left py-3 px-4 flex items-center justify-between border-b border-border group relative ${
                  expandedSections.includes('happened') ? 'bg-white/5' : ''
                }`}
              >
                {expandedSections.includes('happened') && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                <span className="font-bebas text-2xl tracking-widest flex items-center gap-3">
                  🧠 WHAT HAPPENED
                </span>
                {expandedSections.includes('happened') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <AnimatePresence>
                {expandedSections.includes('happened') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 px-4"
                  >
                    <div className="flex gap-2 border-b border-border pb-2">
                      <button onClick={() => insertText('**', '**')} className="p-2 hover:bg-white/10 text-text-muted hover:text-gold"><Bold size={16} /></button>
                      <button onClick={() => insertText('_', '_')} className="p-2 hover:bg-white/10 text-text-muted hover:text-gold"><Italic size={16} /></button>
                      <button onClick={() => insertText('\n- ')} className="p-2 hover:bg-white/10 text-text-muted hover:text-gold"><ListIcon size={16} /></button>
                      <button onClick={() => insertText('\n> ')} className="p-2 hover:bg-white/10 text-text-muted hover:text-gold"><Quote size={16} /></button>
                    </div>
                    <div className="relative">
                      <textarea 
                        ref={editorRef}
                        value={formData.what_happened}
                        onChange={(e) => setFormData({...formData, what_happened: e.target.value})}
                        placeholder="WRITE EVERYTHING. THIS IS YOUR RECORD."
                        className="w-full bg-transparent border-none p-0 text-sm font-mono leading-relaxed min-h-[200px] focus:ring-0 outline-none resize-none"
                      />
                      <div className="absolute bottom-0 right-0 text-[10px] text-text-muted font-mono">
                        {formData.what_happened.length} CHARS | {wordCount} WORDS
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Lessons & Reflections */}
            <div className="space-y-4">
              <button 
                onClick={() => toggleSection('lessons')}
                className={`w-full text-left py-3 px-4 flex items-center justify-between border-b border-border group relative ${
                  expandedSections.includes('lessons') ? 'bg-white/5' : ''
                }`}
              >
                {expandedSections.includes('lessons') && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                <span className="font-bebas text-2xl tracking-widest flex items-center gap-3">
                  💡 LESSONS & REFLECTIONS
                </span>
                {expandedSections.includes('lessons') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <AnimatePresence>
                {expandedSections.includes('lessons') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-6 px-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] text-done uppercase tracking-widest">What went well:</label>
                      <textarea 
                        rows={3}
                        value={formData.went_well}
                        onChange={(e) => setFormData({...formData, went_well: e.target.value})}
                        className="w-full bg-bg-sidebar border border-border p-3 text-xs font-mono focus:border-gold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-missed uppercase tracking-widest">What I'd do differently:</label>
                      <textarea 
                        rows={3}
                        value={formData.would_change}
                        onChange={(e) => setFormData({...formData, would_change: e.target.value})}
                        className="w-full bg-bg-sidebar border border-border p-3 text-xs font-mono focus:border-gold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gold uppercase tracking-widest">I am grateful for:</label>
                      <textarea 
                        rows={3}
                        value={formData.grateful}
                        onChange={(e) => setFormData({...formData, grateful: e.target.value})}
                        className="w-full bg-bg-sidebar border border-border p-3 text-xs font-mono focus:border-gold outline-none"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* End of Day Score */}
            <div className="space-y-4">
              <button 
                onClick={() => toggleSection('score')}
                className={`w-full text-left py-3 px-4 flex items-center justify-between border-b border-border group relative ${
                  expandedSections.includes('score') ? 'bg-white/5' : ''
                }`}
              >
                {expandedSections.includes('score') && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />}
                <span className="font-bebas text-2xl tracking-widest flex items-center gap-3">
                  🌙 END OF DAY SCORE
                </span>
                {expandedSections.includes('score') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <AnimatePresence>
                {expandedSections.includes('score') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-8 px-4"
                  >
                    <div className="flex items-center gap-8">
                      <div className="flex-1 space-y-4">
                        <input 
                          type="range"
                          min="1"
                          max="10"
                          value={formData.day_score}
                          onChange={(e) => setFormData({...formData, day_score: Number(e.target.value)})}
                          className="w-full h-2 bg-border rounded-none appearance-none cursor-pointer accent-gold"
                        />
                        <p className="text-xs font-mono text-gold tracking-widest">
                          {getScoreLabel(formData.day_score)}
                        </p>
                      </div>
                      <div className="font-oswald text-7xl font-bold text-gold shrink-0">
                        {formData.day_score}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setFormData({...formData, is_win: false})}
                        className={`flex-1 py-4 border-2 font-bebas text-2xl tracking-widest transition-all flex items-center justify-center gap-3 ${
                          !formData.is_win ? 'bg-missed border-missed text-white' : 'border-missed text-missed hover:bg-missed/10'
                        }`}
                      >
                        <X size={24} /> LOSS
                      </button>
                      <button
                        onClick={() => setFormData({...formData, is_win: true})}
                        className={`flex-1 py-4 border-2 font-bebas text-2xl tracking-widest transition-all flex items-center justify-center gap-3 ${
                          formData.is_win ? 'bg-done border-done text-white' : 'border-done text-done hover:bg-done/10'
                        }`}
                      >
                        <Check size={24} /> WIN
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Sticky Save Button */}
        <div className="sticky bottom-0 right-0 left-0 p-4 bg-bg-main/80 backdrop-blur-sm border-t border-border z-10">
          <button 
            onClick={handleSave}
            className="w-full bg-gold text-bg-main py-4 font-bebas text-2xl tracking-widest hover:bg-opacity-90 transition-all shadow-lg tap-target"
          >
            {selectedId ? 'UPDATE ENTRY' : 'SAVE ENTRY'}
          </button>
        </div>
      </div>
    </div>
  );
}
