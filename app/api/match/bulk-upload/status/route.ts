import { logError } from '@/lib/sentry/logger';
import { jobService } from '@/lib/services/matchBulkUpload/jobService';
import { NextRequest, NextResponse } from 'next/server';

// A simple, in-memory cache for job results. For larger scale, use Redis or similar.

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return new Response('Missing jobId', { status: 400 });
    }

    const stream = new ReadableStream({
      start(controller) {
        let cursor = 0;
        let isClosed = false;

        const interval = setInterval(async () => {
          if (isClosed) return;
          try {
            const currentJob = await jobService.get(jobId);

            // Handle case where job might be cleaned up or invalid
            if (!currentJob) {
              if (isClosed) return;
              isClosed = true;

              controller.enqueue(`data: ${JSON.stringify({ status: 'error', message: 'Job not found or expired.' })}\n\n`);
              clearInterval(interval);
              controller.close();
              return;
            }

            // Check for new results since the last check
            if (cursor < currentJob.results.length) {
              if (isClosed) return;

              const newResults = currentJob.results.slice(cursor);
              controller.enqueue(`data: ${JSON.stringify({ status: 'processing', results: newResults })}\n\n`);
              cursor = currentJob.results.length; // Update the cursor
            }

            // Check if the job is finished
            if (currentJob.status === 'complete' || currentJob.status === 'failed') {
              if (isClosed) return;
              isClosed = true;

              controller.enqueue(`data: ${JSON.stringify({ status: currentJob.status, message: 'Processing complete.' })}\n\n`);
              clearInterval(interval);
              controller.close();
             await jobService.delete(jobId);
            }
          } catch (err) {
            const errorId = logError(err, { endpoint: 'GET /api/match/bulk-upload/status', jobId });
            try {
              controller.enqueue(`data: ${JSON.stringify({ status: 'error', message: 'Internal server error.', errorId })}\n\n`);
            } catch (_) {}
            clearInterval(interval);
            isClosed = true;
            try { controller.close(); } catch (_) {}
          }
        }, 1000); // Check for updates every second
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/match/bulk-upload/status' });
    return NextResponse.json({ error: 'Internal Server Error', errorId }, { status: 500 });
  }
}