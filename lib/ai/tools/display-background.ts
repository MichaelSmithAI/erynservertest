import { tool } from 'ai';
import { z } from 'zod';

// Simple tool that lets the LLM render a background preview inline via Generative UI
export const displayBackground = () =>
  tool({
    description:
      'Display a background preview inline in the chat. Use after generating/uploading a background image.',
    inputSchema: z.object({
      imageUrl: z.string().url(),
      lightingState: z.string(),
      description: z.string(),
    }),
    execute: async ({ imageUrl, lightingState, description }) => {
      // No side effects; return props for Generative UI rendering
      return { imageUrl, lightingState, description };
    },
  });
