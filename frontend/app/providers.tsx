'use client';

import { SessionProvider } from 'next-auth/react';
import { WagmiProvider, createConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import { http } from 'viem';
import type { Chain } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import '@rainbow-me/rainbowkit/styles.css';

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!;

// Define chains once to reuse across config and wallets
const chains = [mainnet, polygon, optimism, arbitrum] as const satisfies readonly [Chain, ...Chain[]];

// RainbowKit v2: pass wallet factory functions in `wallets` and provide shared options
// (appName, projectId, chains) via the second argument.
const connectors = connectorsForWallets([
  {
    groupName: 'Popular',
    wallets: [
      injectedWallet,
      metaMaskWallet,
      rainbowWallet,
      coinbaseWallet,
      walletConnectWallet,
    ],
  },
], {
  appName: 'SkillFi',
  projectId,
});

export const config = createConfig({
  chains,
  connectors,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={lightTheme({
              // Purple accent to match the bird shade
              // Adjust if you have an exact hex from your design system
              accentColor: '#7C4DFF',
              accentColorForeground: 'white',
              borderRadius: 'large',
              fontStack: 'rounded',
              overlayBlur: 'small',
            })}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}