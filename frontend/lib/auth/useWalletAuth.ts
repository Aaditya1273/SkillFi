import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';
import { signIn } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export function useWalletAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const signInWithWallet = async (): Promise<boolean> => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return false;
    }

    setIsLoading(true);

    try {
      // Get nonce from backend
      const nonceResponse = await fetch('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce');
      }

      const { nonce } = await nonceResponse.json();

      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in with Ethereum to SkillFi',
        uri: window.location.origin,
        version: '1',
        chainId: 1,
        nonce
      });

      const messageString = message.prepareMessage();

      // Sign message
      const signature = await signMessageAsync({
        message: messageString
      });

      // Authenticate with NextAuth
      const result = await signIn('wallet', {
        message: messageString,
        signature,
        address,
        redirect: false
      });

      if (result?.error) {
        toast.error('Wallet authentication failed');
        return false;
      }

      toast.success('Successfully signed in with wallet');
      return true;

    } catch (error) {
      console.error('Wallet auth error:', error);
      toast.error('Failed to sign message');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const linkWalletToAccount = async (): Promise<boolean> => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return false;
    }

    setIsLoading(true);

    try {
      // Get nonce
      const nonceResponse = await fetch('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce');
      }

      const { nonce } = await nonceResponse.json();

      // Create SIWE message for linking
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Link wallet to your SkillFi account',
        uri: window.location.origin,
        version: '1',
        chainId: 1,
        nonce
      });

      const messageString = message.prepareMessage();

      // Sign message
      const signature = await signMessageAsync({
        message: messageString
      });

      // Link wallet via API
      const response = await fetch('/api/auth/social/connect-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message: messageString
        })
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to link wallet');
        return false;
      }

      toast.success('Wallet linked successfully');
      return true;

    } catch (error) {
      console.error('Wallet linking error:', error);
      toast.error('Failed to link wallet');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithWallet,
    linkWalletToAccount,
    isLoading,
    address,
    isConnected
  };
}
