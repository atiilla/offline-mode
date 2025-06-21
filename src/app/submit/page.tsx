'use client';

import { useState, useEffect } from 'react';

interface OfflineJob {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  status: string;
  attempts: number;
  maxAttempts: number;
}

export default function SubmitPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [offlineJobs, setOfflineJobs] = useState<OfflineJob[]>([]);  const [isOnline, setIsOnline] = useState(true);
  
  // Process offline jobs when coming back online
  const processOfflineJobs = async () => {
    const storedJobs = localStorage.getItem('offlineJobs');
    if (!storedJobs) {
      return;
    }
    
    const jobs: OfflineJob[] = JSON.parse(storedJobs);
    if (jobs.length === 0) {
      return;
    }
    
    // Process jobs one by one
    for (const job of jobs) {
      if (job.status === 'processing') {
        continue;
      }
      
      // Update job status to processing
      job.status = 'processing';
      const updatedJobs = jobs.map(j => j.id === job.id ? job : j);
      localStorage.setItem('offlineJobs', JSON.stringify(updatedJobs));
      setOfflineJobs([...updatedJobs]);
      
      try {
        // Try to submit the job online
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(job.data),
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Remove successful job from localStorage
          const remainingJobs = jobs.filter(j => j.id !== job.id);
          localStorage.setItem('offlineJobs', JSON.stringify(remainingJobs));
          setOfflineJobs([...remainingJobs]);
          
          // Show success message
          if (result.job) {
            setResult({ 
              job: result.job, 
              message: `Offline job ${job.id} synced successfully! Online job ID: ${result.job.id}` 
            });
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);
        
        // Increment attempt count
        job.attempts = (job.attempts || 0) + 1;
        job.status = 'failed';
        
        // Remove job if max attempts reached
        if (job.attempts >= (job.maxAttempts || 3)) {
          const remainingJobs = jobs.filter(j => j.id !== job.id);
          localStorage.setItem('offlineJobs', JSON.stringify(remainingJobs));
          setOfflineJobs([...remainingJobs]);
          
          setResult({ 
            error: `Failed to sync offline job ${job.id} after ${job.attempts} attempts. Please try submitting again.` 
          });
        } else {
          // Mark as failed but keep for retry
          job.status = 'pending';
          const updatedJobs = jobs.map(j => j.id === job.id ? job : j);
          localStorage.setItem('offlineJobs', JSON.stringify(updatedJobs));
          setOfflineJobs([...updatedJobs]);
        }
      }
      
      // Small delay between jobs to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Initialize listeners
  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);    const handleOnline = async () => {
      setIsOnline(true);
      
      // Notify service worker that we're back online
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {          navigator.serviceWorker.controller.postMessage({
            type: 'SYNC_OFFLINE_JOBS'
          });
        } catch (error) {
          console.warn('Could not notify service worker:', error);
        }
      }
      
      // Also process offline jobs directly from localStorage
      await processOfflineJobs();
    };
      const handleOffline = () => {
      setIsOnline(false);    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Also handle visibility change (when user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.onLine) {
        processOfflineJobs();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set up periodic retry for offline jobs when online
    const retryInterval = setInterval(() => {
      if (navigator.onLine) {
        const storedJobs = localStorage.getItem('offlineJobs');
        if (storedJobs) {
          const jobs = JSON.parse(storedJobs);          if (jobs.length > 0) {
            processOfflineJobs();
          }
        }
      }
    }, 30000); // Check every 30 seconds
    
    // Load offline jobs from localStorage
    const loadOfflineJobs = () => {
      const stored = localStorage.getItem('offlineJobs');
      if (stored) {
        setOfflineJobs(JSON.parse(stored));
      }
    };
    
    loadOfflineJobs();
      // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      
      if (event.data.type === 'OFFLINE_FORM_STORED') {
        const job = event.data.job;
        
        // Update localStorage
        const existingJobs = JSON.parse(localStorage.getItem('offlineJobs') || '[]');
        const updatedJobs = [...existingJobs, job];
        localStorage.setItem('offlineJobs', JSON.stringify(updatedJobs));
        setOfflineJobs(updatedJobs);      } else if (event.data.type === 'OFFLINE_FORM_SYNCED') {
        const offlineJobId = event.data.offlineJobId;
        const onlineJob = event.data.onlineJob;
        
        // Remove offline job from localStorage
        const existingJobs = JSON.parse(localStorage.getItem('offlineJobs') || '[]');
        const updatedJobs = existingJobs.filter((job: OfflineJob) => job.id !== offlineJobId);
        localStorage.setItem('offlineJobs', JSON.stringify(updatedJobs));
        setOfflineJobs(updatedJobs);
        
        // Show success notification
        if (onlineJob) {
          setResult({ job: onlineJob, message: `Form synced successfully! Online job ID: ${onlineJob.id}` });
        }      } else if (event.data.type === 'OFFLINE_FORM_FAILED') {
        const offlineJobId = event.data.offlineJobId;
        
        // Remove failed job from localStorage
        const existingJobs = JSON.parse(localStorage.getItem('offlineJobs') || '[]');
        const updatedJobs = existingJobs.filter((job: OfflineJob) => job.id !== offlineJobId);
        localStorage.setItem('offlineJobs', JSON.stringify(updatedJobs));
        setOfflineJobs(updatedJobs);
        
        // Show error notification
        setResult({ error: `Failed to sync offline form ${offlineJobId}. Please try submitting again.` });
      }
    };
    
    navigator.serviceWorker?.addEventListener('message', handleMessage);    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      clearInterval(retryInterval);
    };
  }, []);  const handleOfflineSubmission = async (formData: any) => {
    
    // Generate a unique job ID
    const jobId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Create job object
    const job = {
      id: jobId,
      type: 'form-submission',
      data: formData,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3
    };
    
    // Store in localStorage
    const existingJobs = JSON.parse(localStorage.getItem('offlineJobs') || '[]');
    existingJobs.push(job);
    localStorage.setItem('offlineJobs', JSON.stringify(existingJobs));
    
    // Also try to notify service worker for background sync
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'STORE_OFFLINE_FORM',
          data: {
            jobId,
            formData,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.warn('Could not notify service worker:', error);
      }
    }
      // Register for background sync if available
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;        // Check if sync is available (Background Sync API)
        if ('sync' in registration) {
          await (registration as any).sync.register('background-sync-forms');
        }
      } catch (error) {
        console.warn('Background sync registration failed:', error);
      }    }
    
    return { job, offline: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);    try {
      
      // Check if we're offline first
      if (!navigator.onLine) {
        const result = await handleOfflineSubmission(formData);
        setResult(result);
        setFormData({ name: '', email: '', message: '' });
        return;
      }
      
      // Try online submission first
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });      const data = await response.json();
      setResult(data);
      
      // Reset form on successful submission
      setFormData({ name: '', email: '', message: '' });
        } catch (error) {
      console.error('Submission error:', error);
        // If fetch failed, it might be because we're actually offline
      // Try offline submission as fallback
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        try {
          const result = await handleOfflineSubmission(formData);
          setResult(result);
          setFormData({ name: '', email: '', message: '' });        } catch (offlineError) {
          console.error('Offline submission also failed:', offlineError);
          setResult({ error: 'Form submission failed. Please try again.' });
        }
      } else {
        setResult({ error: 'Form submission failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-teal-600 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          🧪 Offline Form Test
        </h1>        {/* Connection Status */}
        <div className={`rounded-lg p-4 mb-6 text-center font-bold ${
          isOnline 
            ? 'bg-green-500/20 text-green-100 border border-green-500/30' 
            : 'bg-red-500/20 text-red-100 border border-red-500/30'
        }`}>
          {isOnline ? '🌐 Online' : '📱 Offline Mode'}
        </div>

        {/* Debug Info */}
        <div className="bg-blue-500/20 backdrop-blur rounded-lg p-4 mb-6 border border-blue-500/30">
          <div className="text-blue-100 text-sm">
            <div><strong>Navigator Online:</strong> {navigator.onLine ? '✅' : '❌'}</div>
            <div><strong>Service Worker:</strong> {'serviceWorker' in navigator ? '✅' : '❌'}</div>
            <div><strong>SW Controller:</strong> {navigator.serviceWorker?.controller ? '✅' : '❌'}</div>
            <div><strong>Jobs in localStorage:</strong> {offlineJobs.length}</div>
          </div>
        </div>{/* Offline Jobs Display */}
        {offlineJobs.length > 0 && (
          <div className="bg-orange-500/20 backdrop-blur rounded-lg p-6 mb-6 border border-orange-500/30">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-orange-100">
                📱 Offline Jobs ({offlineJobs.length})
              </h3>
              {isOnline && (
                <button
                  onClick={processOfflineJobs}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold transition-colors"
                >
                  🔄 Sync Now
                </button>
              )}
            </div>
            <div className="space-y-3">
              {offlineJobs.map((job) => (
                <div key={job.id} className="bg-black/20 rounded p-3">
                  <div className="text-orange-100 text-sm">
                    <div><strong>ID:</strong> {job.id}</div>
                    <div><strong>Name:</strong> {job.data.name}</div>
                    <div><strong>Email:</strong> {job.data.email}</div>
                    <div><strong>Status:</strong> <span className={`font-bold ${
                      job.status === 'pending' ? 'text-yellow-300' :
                      job.status === 'processing' ? 'text-blue-300' :
                      job.status === 'failed' ? 'text-red-300' : 'text-green-300'
                    }`}>
                      {job.status === 'processing' ? '⏳ Processing...' : 
                       job.status === 'failed' ? '❌ Failed' :
                       job.status === 'pending' ? '⏸️ Pending' : job.status}
                    </span></div>
                    <div><strong>Attempts:</strong> {job.attempts || 0}/{job.maxAttempts || 3}</div>
                    <div><strong>Created:</strong> {new Date(job.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-orange-100 text-sm mt-3">
              These will be automatically submitted when you're back online.
            </p>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 rounded bg-white/20 text-white placeholder-white/60 border border-white/30"
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div>
              <label className="block text-white mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-3 rounded bg-white/20 text-white placeholder-white/60 border border-white/30"
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label className="block text-white mb-2">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="w-full p-3 rounded bg-white/20 text-white placeholder-white/60 border border-white/30"
                rows={4}
                placeholder="Enter your message"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-purple-600 font-bold py-3 px-6 rounded hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading ? '⏳ Submitting...' : '📤 Test Submit'}
            </button>
          </form>
        </div>

        {/* Result Display */}
        {result && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              {result.offline ? '📱 Offline Result' : '🌐 Online Result'}
            </h3>
            <pre className="text-white text-sm bg-black/20 p-4 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}        {/* Instructions */}
        <div className="bg-yellow-500/20 backdrop-blur rounded-lg p-6 border border-yellow-500/30 mt-6">
          <h3 className="text-xl font-bold text-yellow-100 mb-4">🧪 Test Steps</h3>
          <div className="text-yellow-100 space-y-2">
            <p><strong>Online Test:</strong> Submit form normally (should show green status)</p>
            <p><strong>Offline Test:</strong></p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Open DevTools → Network → Set to "Offline"</li>
              <li>Fill and submit the form</li>
              <li>Form should stay on this page and show offline job in orange box</li>
              <li>Set network back to "Online" in DevTools</li>
              <li>Jobs should auto-process within seconds (watch console logs)</li>
              <li>Or click "🔄 Sync Now" button to process immediately</li>
              <li>Orange jobs should disappear when successfully synced</li>
            </ol>
            <p><strong>Auto-Retry:</strong> Jobs are automatically retried every 30 seconds when online</p>
          </div>
        </div>
      </div>
    </div>
  );
}
