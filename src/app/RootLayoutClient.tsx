"use client";

import React from "react";
import PWAStatus from "@/components/PWAStatus";

import type { PropsWithChildren } from "react";

export default function RootLayoutClient({ children }: PropsWithChildren) {  React.useEffect(() => {
    // Initialize offline form handler
    // Import is handled by the file itself
    
    if ("serviceWorker" in navigator) {      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // You can show a toast or notification here instead of confirm
                  if (confirm('New version available. Do you want to update?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'CACHE_UPDATED') {
        } else if (event.data?.type === 'OFFLINE_FORM_STORED') {
          // Dispatch custom event for form page to listen
          window.dispatchEvent(new CustomEvent('offlineFormStored', {
            detail: event.data.job          }));        } else if (event.data?.type === 'OFFLINE_FORM_SUBMITTED') {
          // Dispatch custom event for form page to listen
          window.dispatchEvent(new CustomEvent('offlineFormSubmitted', {
            detail: {
              offlineJob: event.data.offlineJob,
              onlineJob: event.data.onlineJob
            }          }));
        } else if (event.data?.type === 'OFFLINE_FORM_FAILED') {
          // Dispatch custom event for form page to listen
          window.dispatchEvent(new CustomEvent('offlineFormFailed', {
            detail: {
              offlineJob: event.data.offlineJob
            }
          }));
        }
      });
    }
  }, []);
  return (
    <div className="text-white flex flex-col">
      <PWAStatus />
      <div className="container mx-auto px-4 max-w-[1024px]">
        {children}
      </div>
    </div>
  );
}