import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check, Bell, Calendar, Trash2, Moon, Sun, ChevronDown, Clock, Folder, Repeat, Menu, X, Settings2 } from 'lucide-react';

type Category = 'Work' | 'Personal' | 'Others';
type RepeatFrequency = 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | '3 Months' | '6 Months' | 'Yearly';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  category: Category;
  dueDate?: string;
  dueTime?: string;
  repeat: RepeatFrequency;
  createdAt: number;
}

const getNextOccurrence = (dateStr: string, frequency: RepeatFrequency): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  if (isNaN(date.getTime())) return dateStr;

  switch (frequency) {
    case 'Daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'Weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'Biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'Monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case '3 Months':
      date.setMonth(date.getMonth() + 3);
      break;
    case '6 Months':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'Yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return dateStr;
  }
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateWithDay = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return dateStr;
  
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${dayName}, ${dateStr}`;
};

const scheduleNotification = (task: Task) => {
  if (!('serviceWorker' in navigator)) return;
  if (!task.dueDate) return;

  const [y, m, d] = task.dueDate.split('-').map(Number);
  const [hh, mm] = (task.dueTime || '09:00').split(':').map(Number);
  const targetTime = new Date(y, m - 1, d, hh, mm).getTime();
  const now = Date.now();
  const delay = targetTime - now;

  if (delay > 0) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        title: 'Task Reminder',
        body: task.text,
        delay: Math.min(delay, 2147483647), // Max delay for setTimeout
      });
    });
  }
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('lumos_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('Personal');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatFrequency>('None');
  
  const [filter, setFilter] = useState<Category | 'All' | 'Today' | 'Upcoming'>('All');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('lumos_dark_mode');
    return saved === 'true';
  });
  
  const [showOptions, setShowOptions] = useState(false);
  const [isActiveCollapsed, setIsActiveCollapsed] = useState(false);
  const [isUpcomingCollapsed, setIsUpcomingCollapsed] = useState(true);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lumos_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('lumos_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotificationPrompt(true);
    }
  }, []);

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setShowNotificationPrompt(false);
    }
  };

  const addTask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    if (editingTaskId) {
      setTasks(current => current.map(t => t.id === editingTaskId ? {
        ...t,
        text: inputText,
        category: selectedCategory,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        repeat: repeat,
      } : t));
      
      // Schedule reminder for the updated task
      const updatedTask = tasks.find(t => t.id === editingTaskId);
      if (updatedTask) scheduleNotification({ ...updatedTask, text: inputText, dueDate, dueTime });
      
      setEditingTaskId(null);
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        text: inputText,
        completed: false,
        category: selectedCategory,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        repeat: repeat,
        createdAt: Date.now(),
      };

      setTasks([newTask, ...tasks]);
      
      if ((newTask.dueDate || newTask.dueTime)) {
        scheduleNotification(newTask);
      }
    }
    
    // Reset form
    setInputText('');
    setDueDate('');
    setDueTime('');
    setRepeat('None');
    setShowOptions(false);
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setInputText(task.text);
    setSelectedCategory(task.category);
    setDueDate(task.dueDate || '');
    setDueTime(task.dueTime || '');
    setRepeat(task.repeat);
    setShowOptions(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const isNowCompleted = !task.completed;

    // Update current task state
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: isNowCompleted } : t));

    // If marking as complete and it has a repeat pattern
    if (isNowCompleted && task.repeat !== 'None') {
      const baseDate = task.dueDate || new Date().toISOString().split('T')[0];
      const nextDate = getNextOccurrence(baseDate, task.repeat);
      
      const nextTask: Task = {
        ...task,
        id: crypto.randomUUID(),
        completed: false,
        dueDate: nextDate,
        createdAt: Date.now() + 1,
      };

      // Ensure notification is scheduled for the next one
      scheduleNotification(nextTask);

      // Add the next occurrence and then handle removal
      setTimeout(() => {
        setTasks(current => {
          const filtered = current.filter(t => t.id !== id || !t.completed);
          // Check if we already created this next occurrence (to avoid duplicates if double clicked)
          const alreadyExists = filtered.some(t => t.text === nextTask.text && t.dueDate === nextTask.dueDate && !t.completed);
          return alreadyExists ? filtered : [nextTask, ...filtered];
        });
      }, 600);
    } else {
      setTimeout(() => {
        setTasks(current => current.filter(t => t.id !== id || !t.completed));
      }, 600);
    }
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'All') return true;
    if (filter === 'Today') return t.dueDate === new Date().toISOString().split('T')[0];
    if (filter === 'Upcoming') return t.dueDate && t.dueDate > new Date().toISOString().split('T')[0];
    return t.category === filter;
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-app-bg text-app-text-main transition-colors duration-300 font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto h-full w-[280px] flex flex-col border-r border-app-border bg-app-sidebar px-6 py-10 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2 text-[22px] font-bold tracking-tight">
            <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_rgba(0,113,227,0.4)]" />
            LUMOS
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 space-y-8">
          <div>
            <div className="px-3 mb-4 text-[11px] font-bold uppercase tracking-widest text-app-text-sub/50">
              Overview
            </div>
            <ul className="space-y-1">
              <li 
                onClick={() => { setFilter('All'); setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${filter === 'All' ? 'bg-[#F0F0F2] dark:bg-gray-800 text-app-text-main' : 'text-app-text-sub hover:bg-[#F9F9FB] dark:hover:bg-gray-800/50'}`}
              >
                All Tasks
                <span className="ml-auto px-2 py-0.5 rounded-full bg-app-border text-[11px] text-app-text-sub">
                  {tasks.length}
                </span>
              </li>
              <li 
                onClick={() => { setFilter('Today'); setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${filter === 'Today' ? 'bg-[#F0F0F2] dark:bg-gray-800 text-app-text-main' : 'text-app-text-sub hover:bg-[#F9F9FB] dark:hover:bg-gray-800/50'}`}
              >
                Today
                <span className="ml-auto px-2 py-0.5 rounded-full bg-app-border text-[11px] text-app-text-sub">
                  {tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0]).length}
                </span>
              </li>
              <li 
                onClick={() => { setFilter('Upcoming'); setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${filter === 'Upcoming' ? 'bg-[#F0F0F2] dark:bg-gray-800 text-app-text-main' : 'text-app-text-sub hover:bg-[#F9F9FB] dark:hover:bg-gray-800/50'}`}
              >
                Upcoming
                <span className="ml-auto px-2 py-0.5 rounded-full bg-app-border text-[11px] text-app-text-sub">
                  {tasks.filter(t => t.dueDate && t.dueDate > new Date().toISOString().split('T')[0]).length}
                </span>
              </li>
            </ul>
          </div>

          <div>
            <div className="mt-8 mb-4 px-3 text-[11px] font-bold uppercase tracking-widest text-app-text-sub/50">
              Categories
            </div>
            <ul className="space-y-1">
              {(['Personal', 'Work', 'Others'] as Category[]).map((cat) => (
                <li 
                  key={cat}
                  onClick={() => { setFilter(cat); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${filter === cat ? 'bg-[#F0F0F2] dark:bg-gray-800 text-app-text-main' : 'text-app-text-sub hover:bg-[#F9F9FB] dark:hover:bg-gray-800/50'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${cat === 'Work' ? 'bg-blue-400' : cat === 'Personal' ? 'bg-green-400' : 'bg-purple-400'}`} />
                  {cat}
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-app-border text-[11px] text-app-text-sub">
                    {tasks.filter(t => t.category === cat).length}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        
        <div className="mt-auto pt-10 space-y-2">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-app-text-sub hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-400" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="lg:hidden w-full bg-app-bg/80 backdrop-blur-md border-b border-app-border sticky top-0 z-30 px-6 py-2 flex items-center justify-start">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 flex items-center justify-center transition-transform active:scale-95"
          >
            <Menu className="w-5 h-5 text-app-text" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-24">
          {/* Header */}
          <header className="mb-8 lg:mb-12 flex flex-col items-center lg:items-start text-center lg:text-left h-auto">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold tracking-tight mb-1 text-app-text">
                {filter === 'All' ? 'All Tasks' : filter}
              </h1>
              <p className="text-app-text-sub text-[10px] lg:text-sm font-semibold uppercase tracking-wider">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}, {new Date().toISOString().split('T')[0]}
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-3 mt-4 lg:mt-0">
              {/* Desktop specific header actions */}
            </div>
          </header>

          {/* New Task Section */}
          <div className={`mb-12 bg-app-card border rounded-3xl premium-shadow overflow-hidden transition-all duration-500 ${editingTaskId ? 'border-accent shadow-[0_0_20px_rgba(0,113,227,0.15)] ring-1 ring-accent/20' : 'border-app-border'}`}>
            <form onSubmit={addTask} className="p-2">
              <div className="flex items-center gap-4 px-4 h-14">
                {editingTaskId ? <Bell className="w-5 h-5 text-accent animate-pulse" /> : <Plus className={`w-5 h-5 ${inputText ? 'text-accent' : 'text-app-text-sub/30'}`} />}
                <input 
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setShowOptions(true)}
                  placeholder={editingTaskId ? "Edit your reminder..." : "What needs to be done?"}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[16px] placeholder:text-app-text-sub/40"
                />
                {!showOptions && (
                  <button 
                    type="button" 
                    onClick={() => setShowOptions(true)}
                    className="p-2 text-app-text-sub/40 hover:text-accent transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {showOptions && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-app-border mt-2"
                  >
                    <div className="p-4 space-y-4">
                      {editingTaskId && (
                        <div className="bg-accent/5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                          Currently Editing Mode
                        </div>
                      )}
                      {/* Grid for settings */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-app-text-sub" />
                            <input 
                              type="date" 
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="bg-app-bg text-xs px-3 py-2 rounded-lg border-none focus:ring-1 focus:ring-accent"
                            />
                            <Clock className="w-4 h-4 text-app-text-sub ml-2" />
                            <input 
                              type="time" 
                              value={dueTime}
                              onChange={(e) => setDueTime(e.target.value)}
                              className="bg-app-bg text-xs px-3 py-2 rounded-lg border-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Repeat className="w-4 h-4 text-app-text-sub" />
                            <select 
                              value={repeat}
                              onChange={(e) => setRepeat(e.target.value as RepeatFrequency)}
                              className="bg-app-bg text-xs px-3 py-2 rounded-lg border-none focus:ring-1 focus:ring-accent w-full"
                            >
                              <option value="None">No Repeat</option>
                              <option value="Daily">Daily</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Biweekly">Biweekly</option>
                              <option value="Monthly">Monthly</option>
                              <option value="3 Months">Every 3 Months</option>
                              <option value="6 Months">Every 6 Months</option>
                              <option value="Yearly">Yearly</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-3 mb-2">
                            <Folder className="w-4 h-4 text-app-text-sub" />
                            <span className="text-xs font-semibold text-app-text-sub">Category</span>
                          </div>
                          <div className="flex gap-2">
                            {(['Work', 'Personal', 'Others'] as Category[]).map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${selectedCategory === cat ? 'bg-accent text-white' : 'bg-app-bg text-app-text-sub hover:text-app-text-main'}`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button 
                          type="button"
                          onClick={() => { setShowOptions(false); setEditingTaskId(null); setInputText(''); setDueDate(''); setDueTime(''); }}
                          className="px-4 py-2 text-xs font-semibold text-app-text-sub hover:text-app-text-main transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={!inputText.trim()}
                          className="px-6 py-2 bg-accent text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all uppercase tracking-widest"
                        >
                          {editingTaskId ? 'Update Reminder' : 'Save Task'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* List Section */}
          <div className="space-y-4">
            {/* Active Section */}
            {filteredTasks.some(t => {
              const today = new Date().toISOString().split('T')[0];
              return (!t.dueDate || t.dueDate <= today) && !t.completed;
            }) && (
              <div>
                <button 
                  onClick={() => setIsActiveCollapsed(!isActiveCollapsed)}
                  className="w-full flex items-center gap-4 py-3 group cursor-pointer"
                >
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-app-border" />
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-accent/20 text-[10px] font-black uppercase tracking-[0.2em] text-accent transition-colors shadow-sm">
                    Active Reminders
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-500 ${isActiveCollapsed ? '' : 'rotate-180'}`} />
                  </div>
                  <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-app-border" />
                </button>

                <AnimatePresence>
                  {!isActiveCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3 pt-4"
                    >
                      {filteredTasks.filter(t => {
                        const today = new Date().toISOString().split('T')[0];
                        return (!t.dueDate || t.dueDate <= today) && !t.completed;
                      }).map((task) => {
                        const today = new Date().toISOString().split('T')[0];
                        const isToday = task.dueDate === today;
                        const isLate = task.dueDate && task.dueDate < today;
                        const isActive = isToday || isLate || !task.dueDate;

                        return (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`group flex items-center gap-4 p-[18px_20px] rounded-[22px] border transition-all hover:-translate-y-0.5 cursor-pointer 
                              ${isLate ? 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-900/40 ring-1 ring-red-500/10 shadow-lg scale-[1.02] z-10' :
                                'bg-white dark:bg-gray-800 border-accent/30 shadow-[0_12px_40px_rgb(0,0,0,0.06)] scale-[1.02] z-10'}
                            `}
                          >
                            <div 
                              className="relative shrink-0"
                              onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                            >
                              <div className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-all duration-300 ${task.completed ? 'bg-accent border-accent' : isLate ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20' : 'border-[#D2D2D7] dark:border-[#3A3A3C] group-hover:border-accent group-hover:bg-accent/5'}`}>
                                {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                                {isLate && !task.completed && <Bell className="w-3 h-3 text-red-500 animate-pulse" />}
                              </div>
                            </div>
                            
                            <div className="flex-grow" onClick={() => startEditing(task)}>
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${task.category === 'Work' ? 'bg-blue-400' : task.category === 'Personal' ? 'bg-green-400' : 'bg-purple-400'}`} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-sub/60">
                                  {task.category}
                                </span>
                                {isToday && <span className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-black ml-1 tracking-tighter">TODAY</span>}
                                {isLate && <span className="text-[8px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1.5 py-0.5 rounded-full font-black ml-1 tracking-tighter">OVERDUE</span>}
                              </div>
                              <div className={`text-[16px] font-semibold leading-tight ${task.completed ? 'line-through' : ''} ${isActive ? 'text-app-text-main' : 'text-app-text-sub'}`}>
                                {task.text}
                              </div>
                              {(task.dueDate || task.repeat !== 'None') && (
                                <div className="flex gap-4 mt-2 items-center">
                                  {task.dueDate && (
                                    <span className={`text-[11px] font-bold flex items-center gap-1.5 ${isLate ? 'text-red-500' : isToday ? 'text-accent' : 'text-app-text-sub/50'}`}>
                                      <Calendar className="w-3 h-3" /> {formatDateWithDay(task.dueDate)} {task.dueTime}
                                    </span>
                                  )}
                                  {task.repeat !== 'None' && (
                                    <span className="text-[11px] font-semibold text-app-text-sub/40 flex items-center gap-1.5">
                                      <Repeat className="w-3 h-3" /> {task.repeat}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); startEditing(task); }}
                                className="p-2.5 rounded-xl hover:bg-accent/5 text-app-text-sub/20 hover:text-accent transition-all"
                                title="Edit Reminder"
                              >
                                <Settings2 className="w-4.5 h-4.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                className="opacity-0 group-hover:opacity-100 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-app-text-sub/30 hover:text-red-500 transition-all"
                                title="Delete Task"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Upcoming Section */}
            {filteredTasks.some(t => t.dueDate && t.dueDate > new Date().toISOString().split('T')[0] && !t.completed) && (
              <div className="mt-8">
                <button 
                  onClick={() => setIsUpcomingCollapsed(!isUpcomingCollapsed)}
                  className="w-full flex items-center gap-4 py-3 group cursor-pointer"
                >
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-app-border" />
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F9F9FB] dark:bg-gray-800/40 border border-app-border text-[10px] font-black uppercase tracking-[0.2em] text-app-text-sub/60 group-hover:text-accent transition-colors">
                    Upcoming Reminders
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-500 ${isUpcomingCollapsed ? '' : 'rotate-180'}`} />
                  </div>
                  <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-app-border" />
                </button>

                <AnimatePresence>
                  {!isUpcomingCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3 pt-4"
                    >
                      {filteredTasks.filter(t => t.dueDate && t.dueDate > new Date().toISOString().split('T')[0] && !t.completed).map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className="group flex items-center gap-4 p-[18px_20px] rounded-[22px] border border-app-border bg-[#F9F9FB] dark:bg-gray-800/40 opacity-60 grayscale-[0.1] border-dashed transition-all hover:opacity-100 hover:grayscale-0 cursor-pointer"
                        >
                          <div 
                            className="relative shrink-0"
                            onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                          >
                            <div className="w-[26px] h-[26px] rounded-full border-2 border-[#D2D2D7] dark:border-[#3A3A3C] flex items-center justify-center transition-all duration-300 group-hover:border-accent group-hover:bg-accent/5">
                              {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </div>
                          
                          <div className="flex-grow" onClick={() => startEditing(task)}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${task.category === 'Work' ? 'bg-blue-400' : task.category === 'Personal' ? 'bg-green-400' : 'bg-purple-400'}`} />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-sub/60">
                                {task.category}
                              </span>
                              <span className="text-[8px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full font-black ml-1 tracking-tighter">UPCOMING</span>
                            </div>
                            <div className="text-[16px] font-semibold leading-tight text-app-text-sub">
                              {task.text}
                            </div>
                            <div className="flex gap-4 mt-2 items-center">
                              <span className="text-[11px] font-bold flex items-center gap-1.5 text-app-text-sub/50">
                                <Calendar className="w-3 h-3" /> {formatDateWithDay(task.dueDate!)} {task.dueTime}
                              </span>
                              {task.repeat !== 'None' && (
                                <span className="text-[11px] font-semibold text-app-text-sub/40 flex items-center gap-1.5">
                                  <Repeat className="w-3 h-3" /> {task.repeat}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); startEditing(task); }}
                              className="p-2.5 rounded-xl hover:bg-accent/5 text-app-text-sub/20 hover:text-accent transition-all"
                              title="Edit Reminder"
                            >
                              <Settings2 className="w-4.5 h-4.5" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                              className="opacity-0 group-hover:opacity-100 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-app-text-sub/30 hover:text-red-500 transition-all"
                              title="Delete Task"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Completed Section (Optional, showing for completeness if user wants but specifically asked for active) */}
            {filteredTasks.some(t => t.completed) && (
              <div className="mt-8">
                <button 
                  onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
                  className="w-full flex items-center gap-4 py-3 group cursor-pointer"
                >
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-app-border" />
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F9F9FB] dark:bg-gray-800/40 border border-app-border text-[10px] font-black uppercase tracking-[0.2em] text-app-text-sub/30 group-hover:text-accent transition-colors">
                    Completed
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-500 ${isCompletedCollapsed ? '' : 'rotate-180'}`} />
                  </div>
                  <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-app-border" />
                </button>

                <AnimatePresence>
                  {!isCompletedCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3 pt-4"
                    >
                      {filteredTasks.filter(t => t.completed).map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group flex items-center gap-4 p-[18px_20px] rounded-[22px] border border-transparent bg-[#F2F2F7] dark:bg-gray-900 opacity-40 grayscale pointer-events-none transition-all"
                        >
                          <div className="relative shrink-0">
                            <div className="w-[26px] h-[26px] rounded-full bg-accent flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                          <div className="flex-grow">
                            <div className="text-[16px] font-semibold leading-tight line-through text-app-text-sub">
                              {task.text}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <div className="py-24 text-center text-app-text-sub/30 text-sm italic">
                {/* Clean list */}
              </div>
            )}
          </div>
          {/* Add padding at bottom to prevent overlap with FAB on mobile */}
          <div className="h-32 lg:hidden" />
        </div>

        {/* FAB for Mobile */}
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className="lg:hidden absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white dark:bg-black text-black dark:text-white rounded-full flex items-center justify-center text-3xl shadow-xl border border-app-border hover:scale-105 active:scale-95 transition-all z-30"
        >
          {showOptions ? <ChevronDown className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
        </button>
      </main>
    </div>
  );
}
