import React from 'react';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface AuthButtonProps {
  user: { id: string; nickname?: string; email?: string } | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  user,
  isLoggedIn,
  isLoading,
  onLogin,
  onLogout,
}) => {
  if (isLoading) {
    return (
      <div className="h-8 w-20 bg-slate-100 rounded-lg animate-pulse" />
    );
  }

  if (!isLoggedIn) {
    return (
      <button
        id="login-btn"
        onClick={onLogin}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer shadow-sm"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>登录</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
        {user?.nickname?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || <UserIcon className="h-3 w-3" />}
      </div>
      <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate">
        {user?.nickname || user?.email || '用户'}
      </span>
      <button
        id="logout-btn"
        onClick={onLogout}
        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
        title="退出登录"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};