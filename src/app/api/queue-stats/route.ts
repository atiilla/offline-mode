// app/api/queue-stats/route.ts
import { NextResponse } from 'next/server';
import { memoryQueue } from '@/lib/memoryQueue';

export async function GET() {
  const stats = memoryQueue.getStats();
  
  return NextResponse.json({
    queueType: 'In-Memory Queue',
    redisRequired: false,
    stats,
    timestamp: new Date().toISOString()
  });
}
