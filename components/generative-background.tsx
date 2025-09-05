'use client';

import { BackgroundImage } from './elements/image';

// This component is designed for AI SDK Generative UI
// It can be used by the LLM to display background images inline with text
export function GenerativeBackground({
  imageUrl,
  lightingState,
  description,
}: {
  imageUrl: string;
  lightingState: string;
  description: string;
}) {
  return (
    <div className="my-6 flex justify-center">
      <div className="max-w-2xl w-full">
        <BackgroundImage
          imageUrl={imageUrl}
          lightingState={lightingState}
          description={description}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground mt-2 text-center">
          {description} • {lightingState} lighting
        </p>
      </div>
    </div>
  );
}

// Export for AI SDK Generative UI registration
export const generativeBackground = {
  component: GenerativeBackground,
  props: ['imageUrl', 'lightingState', 'description'] as const,
  description: 'Display a background image with lighting state and description',
};
