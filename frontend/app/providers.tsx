'use client';

import { SessionProvider } from 'next-auth/react';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

const providers = [] as any[];
if (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
  providers.push(alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY }));
}
if (process.env.NEXT_PUBLIC_INFURA_API_KEY) {
  providers.push(infuraProvider({ apiKey: process.env.NEXT_PUBLIC_INFURA_API_KEY }));
}
providers.push(publicProvider());

const { chains, publicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum],
  providers
);

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error('WalletConnect projectId is not defined. Please check your .env.local file.');
}

const { connectors } = getDefaultWallets({
  appName: 'SkillFi',
  projectId,
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