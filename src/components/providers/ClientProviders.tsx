'use client';

import { PlatformProvider } from '@/platform/state/PlatformProvider';

interface ClientProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper
 * Must wrap the entire application to ensure platform layer is initialized
 * for all routes including /game
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PlatformProvider>
      {children}
    </PlatformProvider>
  );
}
