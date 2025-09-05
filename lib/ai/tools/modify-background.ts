import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { experimental_generateImage as generateImage } from 'ai';
import { fireworks } from '@ai-sdk/fireworks';
import { put } from '@vercel/blob';
import { generateUUID } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';

// Available lighting states
export const LIGHTING_STATES = [
  'sunrise',
  'morning',
  'midday',
  'afternoon',
  'sunset',
  'dusk',
  'night',
  'midnight',
  'moonlight',
  'overcast',
  'stormy',
  'indoor_warm',
  'indoor_cool',
  'studio',
  'neon',
  'candlelight',
  'fireplace',
  'lantern',
] as const;

const prefills = `(anime visual novel style), 1980s anime style, 100 degree FOV, 90 degree camera angle, facing forward, 5 feet off of ground, `;

export type LightingState = (typeof LIGHTING_STATES)[number];

// Current background state (in-memory for now - could be persisted to DB later)
let currentBackgroundState: {
  imageDescription: string;
  lightingState: LightingState;
  imageUrl?: string;
} = {
  imageDescription: 'A cozy indoor room with warm lighting',
  lightingState: 'indoor_warm',
};

interface ModifyBackgroundProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const modifyBackground = ({
  session,
  dataStream,
}: ModifyBackgroundProps) =>
  tool({
    description: `Manage background images and lighting states for scene changes. Use this tool when the scene changes to a new location, time of day, or other environmental changes. The tool can:
    - Get current background status (image description and lighting state)
    - Get list of available lighting states
    - Set a new background with image generation and appropriate lighting`,

    inputSchema: z.discriminatedUnion('action', [
      z.object({
        action: z.literal('get_status'),
      }),
      z.object({
        action: z.literal('get_lighting_states'),
      }),
      z.object({
        action: z.literal('set_background'),
        sceneDescription: z
          .string()
          .max(800)
          .describe(
            '50 words or less description of the current scene for image generation',
          ),
        suggestedLighting: z
          .enum(LIGHTING_STATES)
          .optional()
          .describe(
            'Suggested lighting state - if not provided, will auto-select based on scene',
          ),
      }),
    ]),

    execute: async (input) => {
      switch (input.action) {
        case 'get_status':
          return {
            currentImageDescription: currentBackgroundState.imageDescription,
            currentLightingState: currentBackgroundState.lightingState,
            currentImageUrl: currentBackgroundState.imageUrl,
          };

        case 'get_lighting_states':
          return {
            availableLightingStates: LIGHTING_STATES,
            description:
              'Available lighting states for different times of day and environments',
          };

        case 'set_background': {
          const { sceneDescription, suggestedLighting } = input;
          const imagePrompt = `${prefills}${sceneDescription}`;

          // Auto-select lighting based on scene description if not provided
          let lightingState = suggestedLighting;
          if (!lightingState) {
            lightingState = autoSelectLighting(sceneDescription);
          }

          // Generate image using Fireworks Flux model
          try {
            const { image } = await generateImage({
              model: fireworks.image(
                'accounts/fireworks/models/flux-1-schnell-fp8',
              ),
              prompt: imagePrompt,
              size: '1024x1024', // Square format for backgrounds
              aspectRatio: '1:1',
            });

            // Convert base64 to Buffer for blob storage upload
            const imageBuffer = Buffer.from(image.base64, 'base64');

            // Upload to Vercel Blob Storage
            const filename = `background-${Date.now()}-${generateUUID()}.png`;
            const blob = await put(filename, imageBuffer, {
              access: 'public',
              contentType: 'image/png',
            });

            const imageUrl = blob.url;
            console.log('imageUrl', imageUrl);

            // Update current state
            currentBackgroundState = {
              imageDescription: sceneDescription,
              lightingState,
              imageUrl,
            };

            // Stream the background change to the UI
            dataStream.write({
              type: 'data-backgroundChange',
              data: {
                imageUrl,
                lightingState,
                description: sceneDescription,
              },
              transient: true,
            });

            return {
              success: true,
              imageUrl,
              lightingState,
              description: sceneDescription,
              message: `Background updated to: ${sceneDescription} with ${lightingState} lighting`,
            };
          } catch (error) {
            console.error('Image generation failed:', error);
            return {
              success: false,
              error: 'Failed to generate background image',
              fallbackDescription: sceneDescription,
              lightingState,
            };
          }
        }

        default:
          throw new Error(`Unknown action: ${(input as any).action}`);
      }
    },
  });

// Helper function to auto-select lighting based on scene description
function autoSelectLighting(sceneDescription: string): LightingState {
  const desc = sceneDescription.toLowerCase();

  // Time-based lighting
  if (desc.includes('sunrise') || desc.includes('dawn')) return 'sunrise';
  if (desc.includes('morning') && !desc.includes('late')) return 'morning';
  if (desc.includes('midday') || desc.includes('noon')) return 'midday';
  if (desc.includes('afternoon')) return 'afternoon';
  if (desc.includes('sunset') || desc.includes('dusk')) return 'sunset';
  if (desc.includes('night') || desc.includes('evening')) return 'night';
  if (desc.includes('midnight')) return 'midnight';

  // Weather-based lighting
  if (
    desc.includes('storm') ||
    desc.includes('rain') ||
    desc.includes('thunder')
  )
    return 'stormy';
  if (desc.includes('cloud') || desc.includes('overcast')) return 'overcast';
  if (desc.includes('moon') || desc.includes('star')) return 'moonlight';

  // Indoor lighting
  if (
    desc.includes('indoor') ||
    desc.includes('room') ||
    desc.includes('house')
  ) {
    if (desc.includes('warm') || desc.includes('cozy') || desc.includes('fire'))
      return 'indoor_warm';
    if (
      desc.includes('cool') ||
      desc.includes('modern') ||
      desc.includes('studio')
    )
      return 'indoor_cool';
  }

  // Special lighting
  if (desc.includes('studio') || desc.includes('photography')) return 'studio';
  if (
    desc.includes('neon') ||
    (desc.includes('city') && desc.includes('night'))
  )
    return 'neon';
  if (desc.includes('candle') || desc.includes('romantic'))
    return 'candlelight';
  if (desc.includes('fireplace') || desc.includes('hearth')) return 'fireplace';
  if (desc.includes('lantern') || desc.includes('torch')) return 'lantern';

  // Default fallback
  return 'midday';
}
