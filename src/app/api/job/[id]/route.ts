// app/api/job/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { memoryQueue } from '@/lib/memoryQueue';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {  try {
    const { id: jobId } = await params;
    
    const job = memoryQueue.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      timestamp: job.timestamp,
      data: job.data
    });

  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
