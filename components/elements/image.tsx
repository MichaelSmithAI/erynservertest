import { cn } from '@/lib/utils';
import type { Experimental_GeneratedImage } from 'ai';
import Image from 'next/image';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const GeneratedImage = ({
  base64,
  uint8Array,
  mediaType,
  ...props
}: ImageProps) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    {...props}
    alt={props.alt}
    className={cn(
      'h-auto max-w-full overflow-hidden rounded-md',
      props.className,
    )}
    src={`data:${mediaType};base64,${base64}`}
  />
);

// BackgroundImage component for displaying background images from blob storage
export type BackgroundImageProps = {
  imageUrl: string;
  lightingState: string;
  description: string;
  className?: string;
  alt?: string;
};

export const BackgroundImage = ({
  imageUrl,
  lightingState,
  description,
  className,
  alt,
}: BackgroundImageProps) => (
  <div className={cn('relative group', className)}>
    <Image
      src={imageUrl}
      alt={alt || `Background image: ${description}`}
      width={1024}
      height={1024}
      className="h-auto max-w-full overflow-hidden rounded-lg shadow-lg"
      priority={false}
    />
    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
      {lightingState}: {description}
    </div>
  </div>
);
