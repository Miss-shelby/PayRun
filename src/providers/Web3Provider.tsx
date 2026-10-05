'use client';

import { ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { config } from '@/lib/chain/config';

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={{
            "--ck-font-family": "var(--font-serif), serif",
            "--ck-border-radius": "16px",
            "--ck-accent-color": "#3D5A35",
            "--ck-accent-text-color": "#FAF7F0",
            "--ck-body-background": "#FAF7F0",
            "--ck-body-background-secondary": "#F3EFE6",
            "--ck-body-color": "#2C3E27",
            "--ck-body-color-muted": "#687D62",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
