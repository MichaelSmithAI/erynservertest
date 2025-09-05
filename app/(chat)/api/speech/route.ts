import type { NextRequest } from 'next/server';
import { experimental_generateSpeech as generateSpeech } from 'ai';
import { elevenlabs } from '@ai-sdk/elevenlabs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing ELEVENLABS_API_KEY' }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }
    const { text, voice, language } = (await request.json()) as {
      text?: string;
      voice?: string | undefined;
      language?: string | undefined;
    };

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!elevenlabs) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs provider not available' }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    console.log('text', text);

    // Remove text wrapped in asterisks (e.g., *action* or *emotion*)
    const cleanedText = text.replace(/\*[^*]*\*/g, '').trim();

    if (!cleanedText || cleanedText.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No speakable text after filtering' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
    console.log('cleanedText', cleanedText);
    const result = await generateSpeech({
      model: elevenlabs.speech('eleven_turbo_v2_5'),
      text: cleanedText,
      voice: 'jZPrG0t6FOc6pSrEustX',
      language,
    });

    // Robustly extract raw audio bytes
    const audioAny: any = (result as any).audio ?? result;
    let audioBytes: Uint8Array | null = null;
    let contentType = 'audio/mpeg';

    if (audioAny) {
      if (audioAny.mimeType && typeof audioAny.mimeType === 'string') {
        contentType = audioAny.mimeType;
      }
      if (audioAny.audioData instanceof Uint8Array) {
        audioBytes = audioAny.audioData as Uint8Array;
      } else if (audioAny instanceof Uint8Array) {
        audioBytes = audioAny as Uint8Array;
      } else if (typeof audioAny === 'string') {
        // Could be a data URL string
        if (audioAny.startsWith('data:')) {
          const commaIndex = audioAny.indexOf(',');
          const header = audioAny.slice(0, commaIndex);
          const base64 = audioAny.slice(commaIndex + 1);
          const ctMatch = header.match(/^data:([^;]+);/);
          if (ctMatch) contentType = ctMatch[1];
          const binary = Buffer.from(base64, 'base64');
          audioBytes = new Uint8Array(binary);
        } else {
          // Unexpected string, not playable
          audioBytes = null;
        }
      } else if (typeof audioAny.toBase64URL === 'function') {
        const dataUrl: string = await audioAny.toBase64URL();
        if (dataUrl?.startsWith('data:')) {
          const commaIndex = dataUrl.indexOf(',');
          const header = dataUrl.slice(0, commaIndex);
          const base64 = dataUrl.slice(commaIndex + 1);
          const ctMatch = header.match(/^data:([^;]+);/);
          if (ctMatch) contentType = ctMatch[1];
          const binary = Buffer.from(base64, 'base64');
          audioBytes = new Uint8Array(binary);
        }
      } else if (typeof audioAny.toBase64 === 'function') {
        const b64: string = await audioAny.toBase64();
        const binary = Buffer.from(b64, 'base64');
        audioBytes = new Uint8Array(binary);
      } else if (typeof audioAny.base64 === 'string') {
        const binary = Buffer.from(audioAny.base64, 'base64');
        audioBytes = new Uint8Array(binary);
      } else if (typeof audioAny.arrayBuffer === 'function') {
        const ab: ArrayBuffer = await audioAny.arrayBuffer();
        audioBytes = new Uint8Array(ab);
      } else if (typeof audioAny.toArrayBuffer === 'function') {
        const ab: ArrayBuffer = await audioAny.toArrayBuffer();
        audioBytes = new Uint8Array(ab);
      } else if (audioAny.data && audioAny.type === 'Buffer') {
        // Node Buffer JSON shape
        audioBytes = new Uint8Array(audioAny.data);
      }
    }

    if (!audioBytes) {
      return new Response(
        JSON.stringify({ error: 'No audio bytes generated' }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }

    return new Response(audioBytes, {
      status: 200,
      headers: {
        'content-type': contentType || 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Speech error:', error);
    return new Response(
      JSON.stringify({
        error: 'Speech generation failed',
        message: String(error),
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
}
