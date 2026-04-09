import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  Grid3X3, 
  Target, 
  Moon, 
  BookOpen, 
  BarChart3, 
  Settings, 
  LogOut,
  Calendar,
  Trophy
} from 'lucide-react';

import { motion, useSpring, useTransform, animate } from 'motion/react';

interface SidebarProps {
  user: any;
  profile: any;
  forgeScore: number;
}

const getScoreInfo = (score: number) => {
  if (score >= 80) return { label: 'ELITE', color: '#C8A96E' };
  if (score >= 60) return { label: 'SOLID', color: '#2E7D32' };
  if (score >= 40) return { label: 'AVERAGE', color: '#7A7A7A' };
  return { label: 'WEAK', color: '#8B0000' };
};

export default function Sidebar({ user, profile, forgeScore }: SidebarProps) {
  const navigate = useNavigate();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }).toUpperCase();

  const [displayScore, setDisplayScore] = React.useState(0);
  const { label, color } = getScoreInfo(forgeScore);

  React.useEffect(() => {
    const controls = animate(0, forgeScore, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (value) => setDisplayScore(Math.round(value))
    });
    return () => controls.stop();
  }, [forgeScore]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { icon: <Grid3X3 size={18} />, label: 'HABIT GRID', path: '/' },
    { icon: <Target size={18} />, label: 'GOALS', path: '/goals' },
    { icon: <Moon size={18} />, label: 'SLEEP LOG', path: '/sleep' },
    { icon: <BookOpen size={18} />, label: 'JOURNAL', path: '/journal' },
    { icon: <BarChart3 size={18} />, label: 'ANALYTICS', path: '/analytics' },
    { icon: <Trophy size={18} />, label: 'LEADERBOARD', path: '/leaderboard' },
    { icon: <Settings size={18} />, label: 'SETTINGS', path: '/settings' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] h-screen fixed left-0 top-0 bg-bg-sidebar border-r border-border">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-bebas text-[30px] text-gold leading-none">HABIT</span>
            <span className="font-bebas text-[30px] text-text-main leading-none">FORGE</span>
          </div>
          <div className="h-[1px] bg-gold w-full opacity-30" />
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 font-mono text-[12px] tracking-wider transition-all
                ${isActive 
                  ? 'text-gold border-l-4 border-gold bg-gold/5' 
                  : 'text-text-muted hover:text-text-main hover:bg-white/5 border-l-4 border-transparent'}
              `}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-6 space-y-4 border-t border-border">
          <div>
            <p className="font-mono text-[10px] text-text-muted uppercase">WELCOME, {profile?.name || user?.displayName || 'OPERATIVE'}</p>
            <p className="font-bebas text-[18px] text-gold tracking-wider">{dateStr}</p>
          </div>
          
          <div>
            <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">FORGE SCORE</p>
            <div className="flex flex-col">
              <span className="font-oswald text-[28px] font-bold leading-none" style={{ color }}>{displayScore}</span>
              <span className="font-mono text-[10px] tracking-[0.2em] font-bold" style={{ color }}>{label}</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 font-mono text-[12px] text-text-muted hover:text-missed transition-colors uppercase"
          >
            <LogOut size={16} />
            LOGOUT
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-sidebar border-t border-border flex items-center justify-around px-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1 transition-colors
              ${isActive ? 'text-gold' : 'text-text-muted'}
            `}
          >
            {item.icon}
            <span className="text-[8px] font-mono tracking-tighter">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
