import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Menu, X as CloseIcon } from 'lucide-react';

interface HeaderProps {
  title?: string;
  titleLink?: string;
  showBackButton?: boolean;
  onMenuClick?: () => void;
  isMenuOpen?: boolean;
  onSyncData?: () => void | Promise<void>;
  isSyncing?: boolean;
}

export const Header = ({ title, titleLink = '/', showBackButton, onMenuClick, isMenuOpen, onSyncData, isSyncing }: HeaderProps) => (
  <header className="sticky top-0 z-[60] bg-white/80 backdrop-blur-md border-b border-black/5 px-4 md:px-6 py-4">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex flex-col">
        <Link to={titleLink} className="flex items-baseline gap-2 group">
          <span className="font-bold text-xl md:text-2xl tracking-tighter text-black uppercase line-clamp-1 md:line-clamp-none">
            {title || "DESIGN COURSE PORTFOLIO"}
          </span>
        </Link>
        <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] font-semibold text-black/40 mt-1">
          Future Things Lab • Design Department • NTUST
        </p>
      </div>

      <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-2 md:gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden flex items-center justify-center p-2 bg-black text-white rounded-lg transition-all"
          >
            {isMenuOpen ? <CloseIcon size={14} /> : <Menu size={14} />}
          </button>
        )}

        <div className="flex items-center gap-2 md:gap-4">
          {showBackButton && (
            <Link
              to="/"
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border border-black/10 text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:bg-black/5 transition-all whitespace-nowrap"
            >
              to other courses
            </Link>
          )}
          <button
            onClick={onSyncData}
            disabled={Boolean(isSyncing)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border border-black/10 text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            <RefreshCw size={12} className="md:w-[14px] md:h-[14px]" />
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>
    </div>
  </header>
);
