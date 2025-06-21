'use client';

import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function PWAStatus() {
  const { install, canInstall } = usePWAInstall();
  const isOnline = useOnlineStatus();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {/* Online/Offline Status */}
      <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
        isOnline 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`} />
        {isOnline ? 'Online' : 'Offline'}
      </div>

      {/* Install Button */}
      {canInstall && (
        <button
          onClick={install}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-full font-medium transition-colors"
        >
          📱 Install App
        </button>
      )}
    </div>
  );
}
