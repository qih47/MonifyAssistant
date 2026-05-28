import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Layers,
  Receipt,
  CalendarClock,
  TrendingUp,
  UserCheck,
  Sun,
  Moon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ===== Types =====
interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  isCollapsed: boolean;
}

interface MenuItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

// ===== Constants =====
const MENU_ITEMS: MenuItem[] = [
  { to: '/', icon: <LayoutDashboard size={20} strokeWidth={2} />, label: 'Overview' },
  { to: '/assets', icon: <Wallet size={20} strokeWidth={2} />, label: 'Harta & Aset' },
  { to: '/pockets', icon: <Layers size={20} strokeWidth={2} />, label: 'Kantong Dana' },
  { to: '/transactions', icon: <Receipt size={20} strokeWidth={2} />, label: 'Riwayat Transaksi' },
  { to: '/bills', icon: <CalendarClock size={20} strokeWidth={2} />, label: 'Tagihan & Pengingat' },
];

// ===== Custom Hooks =====
const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    localStorage.setItem(key, JSON.stringify(valueToStore));
  };

  return [storedValue, setValue];
};

const useDarkMode = (): [boolean, () => void] => {
  const [isDark, setIsDark] = useLocalStorage<boolean>(
    'theme',
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return [isDark, () => setIsDark((prev: boolean) => !prev)];
};

const useSidebarCollapse = (): [boolean, () => void] => {
  const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>('sidebar-collapsed', false);
  return [isCollapsed, () => setIsCollapsed((prev: boolean) => !prev)];
};

// ===== Subcomponents =====
const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, isCollapsed }) => {
  return (
    <Link
      to={to}
      title={isCollapsed ? label : undefined}
      className={`
        group relative flex items-center rounded-xl font-semibold transition-all duration-300
        ${
          isCollapsed
            ? 'justify-center p-3 mx-auto aspect-square'
            : 'gap-3 px-4 py-3'
        }
        ${
          active
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-white dark:text-slate-900 dark:shadow-slate-100/10'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white'
        }
      `}
    >
      <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </span>

      <span
        className={`
          text-sm font-semibold whitespace-nowrap transition-all duration-300
          ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}
        `}
      >
        {label}
      </span>

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div
          className="
            absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold
            rounded-lg opacity-0 translate-x-2 pointer-events-none
            transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0
            dark:bg-white dark:text-slate-900 z-50 shadow-lg whitespace-nowrap
          "
        >
          {label}
        </div>
      )}
    </Link>
  );
};

const UserCard: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => (
  <div
    className={`
      flex items-center bg-slate-50 border border-slate-200/60 rounded-xl p-3 transition-all duration-300
      dark:bg-slate-800/40 dark:border-slate-700/60
      ${isCollapsed ? 'justify-center' : 'gap-3'}
    `}
  >
    <div className="flex-shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 text-white p-2 rounded-lg shadow-md shadow-emerald-500/10">
      <UserCheck size={16} strokeWidth={2.5} />
    </div>
    <div
      className={`
        overflow-hidden transition-all duration-300
        ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
      `}
    >
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">Family Active</p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Qisthi & Gita</p>
    </div>
  </div>
);

// ===== Main Component =====
export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, toggleCollapse] = useSidebarCollapse();
  const [isDark, toggleDarkMode] = useDarkMode();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Tutup mobile drawer saat navigasi
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const currentLabel = MENU_ITEMS.find((item) => item.to === location.pathname)?.label || 'Dashboard';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 font-sans antialiased">
      {/* ===== Mobile Backdrop ===== */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/80 p-5 transition-all duration-300
          dark:bg-slate-900 dark:border-slate-800/80
          md:sticky md:top-0 md:h-screen
          ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-[5rem]' : 'md:w-64'}
        `}
      >
        {/* Header */}
        <div>
          <div
            className={`
              flex items-center py-3 mb-8 relative
              ${isCollapsed ? 'md:justify-center px-0' : 'justify-between px-2'}
            `}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex-shrink-0 bg-slate-900 text-white p-2.5 rounded-xl shadow-md dark:bg-white dark:text-slate-900">
                <TrendingUp size={20} strokeWidth={2.5} />
              </div>
              <div
                className={`
                  transition-all duration-300
                  ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}
                `}
              >
                <h1 className="font-extrabold text-lg leading-none tracking-tight dark:text-white">Monify</h1>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em]">
                  Family Hub
                </span>
              </div>
            </div>

            {/* Tombol Collapse Desktop - Dipindah ke pojok kanan atas sidebar */}
            <button
              onClick={toggleCollapse}
              className={`
                hidden md:flex items-center justify-center p-2 rounded-lg
                text-slate-400 hover:text-slate-700 hover:bg-slate-100
                dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800/60
                transition-all shadow-sm
                ${isCollapsed ? 'absolute -right-14 top-1/2 -translate-y-1/2 bg-white border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800/80 rounded-xl p-2.5 shadow-md hover:shadow-lg z-50' : ''}
              `}
              aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight size={16} strokeWidth={2.5} />
              ) : (
                <ChevronLeft size={16} strokeWidth={2.5} />
              )}
            </button>

            {/* Close button mobile */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 md:hidden dark:hover:bg-slate-800/60 dark:hover:text-white transition-colors"
              aria-label="Tutup menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1.5">
            {MENU_ITEMS.map((item) => (
              <SidebarItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.to}
                isCollapsed={isCollapsed}
              />
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="mt-auto">
          <UserCard isCollapsed={isCollapsed} />
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 dark:bg-slate-950/80 dark:border-slate-800/60 flex items-center justify-between px-4 md:px-6 transition-colors">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 md:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-sm"
              aria-label="Buka menu"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight">
              {currentLabel}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all shadow-sm"
              aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              {isDark ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* Status badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Database
            </span>
          </div>
        </header>

        {/* Page Container */}
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-4 md:p-6 transition-all duration-300">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};