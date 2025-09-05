import type { NextRequest } from 'next/server';
import { experimental_transcribe as transcribe } from 'ai';
import { groq } from '@ai-sdk/groq';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json(
        { error: 'Expected multipart/form-data' },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get('audio') as File | null;
    const language = (form.get('language') as string | null) || undefined;

    if (!file) {
      return Response.json({ error: 'Missing audio file' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    const result = await transcribe({
      model: groq.transcription('whisper-large-v3'),
      audio: new Uint8Array(arrayBuffer),
      providerOptions: language ? { groq: { language } } : undefined,
    });

    return Response.json({
      text: result.text,
      segments: result.segments ?? [],
      language: result.language ?? null,
      durationInSeconds: result.durationInSeconds ?? null,
      warnings: result.warnings ?? [],
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return Response.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
