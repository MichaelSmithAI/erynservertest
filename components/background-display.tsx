'use client';

import { BackgroundImage } from './elements/image';

// This component is designed to work with AI SDK Generative UI
// It can be used in the LLM's response to display background images
export function BackgroundDisplay({
  imageUrl,
  lightingState,
  description,
}: {
  imageUrl: string;
  lightingState: string;
  description: string;
}) {
  return (
    <div className="my-4">
      <BackgroundImage
        imageUrl={imageUrl}
        lightingState={lightingState}
        description={description}
        className="max-w-2xl mx-auto"
      />
    </div>
  );
}

// Export for use in AI SDK Generative UI
export const backgroundDisplay = {
  component: BackgroundDisplay,
  props: ['imageUrl', 'lightingState', 'description'] as const,
};
