import { NextRequest, NextResponse } from 'next/server';
import { memoryQueue } from '@/lib/memoryQueue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Validate input
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }    // Add job to memory queue
    const job = await memoryQueue.add('form-submission', {
      name,
      email,
      message,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      message: 'Form submitted successfully',
      job: job
    });

  } catch (error) {
    console.error('Error processing form submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
