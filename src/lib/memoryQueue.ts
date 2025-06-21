// lib/memoryQueue.ts
import { EventEmitter } from 'events';

interface JobData {
  name?: string;
  email?: string;
  message?: string;
  [key: string]: unknown;
}

interface Job {
  id: string;
  type: string;
  data: JobData;
  timestamp: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
}

class MemoryQueue extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private waitingJobs: Job[] = [];
  private isProcessing = false;

  async add(type: string, data: JobData, options: { maxAttempts?: number } = {}) {
    const job: Job = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      type,
      data,
      timestamp: new Date().toISOString(),
      status: 'waiting',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
    };

    this.jobs.set(job.id, job);
    this.waitingJobs.push(job);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processJobs();
    }

    return job;
  }

  private async processJobs() {
    if (this.isProcessing || this.waitingJobs.length === 0) return;
    
    this.isProcessing = true;

    while (this.waitingJobs.length > 0) {
      const job = this.waitingJobs.shift()!;
      await this.processJob(job);
      
      // Small delay between jobs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  private async processJob(job: Job) {
    job.status = 'processing';
    job.attempts++;

    try {
      // Simulate processing work
      await this.simulateWork();
      
      job.status = 'completed';      
      
      // Keep completed jobs for a short time so UI can poll them
      setTimeout(() => {
        this.jobs.delete(job.id);
      }, 10000); // Keep for 10 seconds
      
      this.emit('completed', job);
        
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      if (job.attempts < job.maxAttempts) {
        job.status = 'waiting';
        this.waitingJobs.push(job); // Retry
      } else {
        job.status = 'failed';
        
        // Keep failed jobs for a short time so UI can see the failure
        setTimeout(() => {
          this.jobs.delete(job.id);
        }, 30000); // Keep failed jobs longer (30 seconds)
        
        this.emit('failed', job, error);
      }
    }
  }

  private async simulateWork(): Promise<void> {
    // Simulate random processing time
    const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate random failure (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Random processing error');
    }

    // Simulate external API call
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Get queue stats
  getStats() {
    const allJobs = Array.from(this.jobs.values());
    return {
      total: allJobs.length,
      waiting: allJobs.filter(j => j.status === 'waiting').length,
      processing: allJobs.filter(j => j.status === 'processing').length,
      completed: allJobs.filter(j => j.status === 'completed').length,
      failed: allJobs.filter(j => j.status === 'failed').length,
    };
  }

  // Get job by ID
  getJob(id: string) {
    return this.jobs.get(id);
  }
}

// Export singleton instance
export const memoryQueue = new MemoryQueue();
