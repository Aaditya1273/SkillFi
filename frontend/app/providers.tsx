'use client';

import { SessionProvider } from 'next-auth/react';
import { WagmiConfig, createConfig } from 'wagmi';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { configureChains, mainnet, polygon, optimism, arbitrum } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: 'SkillFi',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider chains={chains}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </SessionProvider>
  );
}