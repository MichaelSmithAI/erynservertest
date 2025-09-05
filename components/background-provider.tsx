'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDataStream } from './data-stream-provider';

interface BackgroundState {
  imageUrl?: string;
  lightingState: string;
  description: string;
  isVisible: boolean;
}

interface BackgroundContextValue {
  background: BackgroundState;
  setBackground: (background: BackgroundState) => void;
  clearBackground: () => void;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

export function BackgroundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [background, setBackground] = useState<BackgroundState>({
    lightingState: 'day',
    description: 'Default scene',
    isVisible: true,
  });

  const { dataStream } = useDataStream();

  // Listen for background change events from the data stream
  useEffect(() => {
    if (!dataStream?.length) return;

    // Find the latest background change event
    const backgroundChangeDelta = dataStream
      .slice()
      .reverse()
      .find((delta) => delta.type === 'data-backgroundChange');

    if (backgroundChangeDelta) {
      setBackground({
        imageUrl: backgroundChangeDelta.data.imageUrl,
        lightingState: backgroundChangeDelta.data.lightingState,
        description: backgroundChangeDelta.data.description,
        isVisible: true,
      });
    }
  }, [dataStream]);

  const clearBackground = () => {
    setBackground((prev) => ({ ...prev, isVisible: false }));
  };

  const value = {
    background,
    setBackground,
    clearBackground,
  };

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
}
