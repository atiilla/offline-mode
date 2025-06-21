// OFFLINE FORM HANDLER - Direct JavaScript approach
// Bu service worker'a alternatif olarak çalışacak

interface FormData {
  name: string;
  email: string;
  message: string;
}

interface OfflineJob {
  id: string;
  type: string;
  data: FormData;
  timestamp: string;
  status: string;
  attempts: number;
  maxAttempts: number;
}

class OfflineFormHandler {
  private storageKey: string;

  constructor() {
    this.storageKey = 'offlineJobs';
    this.setupOnlineOfflineListeners();
  }
  setupOnlineOfflineListeners() {
    window.addEventListener('online', () => {
      this.processOfflineJobs();
    });

    window.addEventListener('offline', () => {
      // Offline mode is now active
    });
  }

  isOnline() {
    return navigator.onLine;
  }
  async handleFormSubmission(formData: FormData) {
    if (this.isOnline()) {
      // Online - normal submission
      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });        if (response.ok) {
          const result = await response.json();
          return { success: true, result, online: true };
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return this.storeOfflineJob(formData);
      }
    } else {
      // Offline - store for later
      return this.storeOfflineJob(formData);
    }
  }

  storeOfflineJob(formData: FormData) {
    const job: OfflineJob = {
      id: 'offline-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'form-submission',
      data: formData,
      timestamp: new Date().toISOString(),
      status: 'offline',
      attempts: 0,      maxAttempts: 3
    };

    // Get existing jobs
    const existingJobs = this.getOfflineJobs();
    existingJobs.push(job);

    // Save to localStorage
    localStorage.setItem(this.storageKey, JSON.stringify(existingJobs));

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('offlineJobStored', { detail: job }));

    return {
      success: true,
      result: {
        message: 'Form saved offline - will be submitted when back online',
        job: job,
        offline: true
      },
      online: false
    };
  }

  getOfflineJobs(): OfflineJob[] {
    try {
      const stored = localStorage.getItem(this.storageKey);      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading offline jobs:', error);
      return [];
    }
  }
  async processOfflineJobs() {
    const jobs = this.getOfflineJobs();
    
    if (jobs.length === 0) {
      return;
    }

    const remainingJobs: OfflineJob[] = [];    for (const job of jobs) {
      if (job.attempts >= job.maxAttempts) {
        window.dispatchEvent(new CustomEvent('offlineJobFailed', { detail: job }));
        continue;
      }

      try {
        
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(job.data),
        });        if (response.ok) {
          const result = await response.json();
          
          // Dispatch success event
          window.dispatchEvent(new CustomEvent('offlineJobSynced', { 
            detail: { offlineJob: job, onlineJob: result.job } 
          }));
        } else {
          throw new Error(`HTTP ${response.status}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        job.attempts++;
        remainingJobs.push(job);
      }
    }

    // Update localStorage with remaining jobs
    localStorage.setItem(this.storageKey, JSON.stringify(remainingJobs));
  }
  // Manual trigger for processing
  async manualSync() {
    await this.processOfflineJobs();
  }
}

// Global instance
declare global {
  interface Window {
    offlineFormHandler: OfflineFormHandler;
  }
}

window.offlineFormHandler = new OfflineFormHandler();

export default OfflineFormHandler;
