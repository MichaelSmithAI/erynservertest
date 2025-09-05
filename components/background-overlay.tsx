'use client';

import { useBackground } from './background-provider';
import { BackgroundImage } from './elements/image';

export function BackgroundOverlay() {
  const { background, clearBackground } = useBackground();

  if (!background.isVisible || !background.imageUrl) {
    return null;
  }

  return (
    <>
      {/* Subtle background overlay - doesn't block content */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-black/5" />
      </div>

      {/* Background image positioned behind content */}
      <div className="fixed inset-0 pointer-events-none z-[-1] flex items-center justify-center p-8">
        <BackgroundImage
          imageUrl={background.imageUrl}
          lightingState={background.lightingState}
          description={background.description}
          className="max-w-5xl max-h-full opacity-30"
          alt={`Scene background: ${background.description}`}
        />
      </div>

      {/* Close button - positioned above content */}
      <button
        type="button"
        onClick={clearBackground}
        className="fixed top-4 right-4 bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors z-50 pointer-events-auto"
        aria-label="Hide background"
      >
        ✕
      </button>
    </>
  );
}
