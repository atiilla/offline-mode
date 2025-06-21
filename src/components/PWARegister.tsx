'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // Handle install prompt
    let deferredPrompt: any;    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);    // Handle online/offline status
    const handleOnlineStatus = () => {
      // You can dispatch a custom event or update global state here
    };

    const handleOfflineStatus = () => {
      // You can dispatch a custom event or update global state here
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, []);

  return null;
}
