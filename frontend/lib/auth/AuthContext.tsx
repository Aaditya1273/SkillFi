'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount, useDisconnect } from 'wagmi';

interface User {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  walletAddress?: string;
  image?: string;
  provider?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasWallet: boolean;
  hasEmail: boolean;
  authMethod: 'email' | 'wallet' | 'social' | null;
  linkWallet: (address: string, signature: string, message: string) => Promise<boolean>;
  unlinkWallet: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(status === 'loading');
  }, [status]);

  const user: User | null = session?.user ? {
    id: session.user.id,
    email: session.user.email || undefined,
    username: session.user.username,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    walletAddress: session.user.walletAddress,
    image: session.user.image || undefined,
    provider: session.user.provider
  } : null;

  const isAuthenticated = !!user;
  const hasWallet = !!user?.walletAddress;
  const hasEmail = !!user?.email;
  
  const authMethod: 'email' | 'wallet' | 'social' | null = user?.provider === 'credentials' 
    ? (hasEmail ? 'email' : 'wallet')
    : user?.provider === 'wallet' 
    ? 'wallet'
    : user?.provider 
    ? 'social' 
    : null;

  const linkWallet = async (address: string, signature: string, message: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/social/connect-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message
        })
      });

      if (response.ok) {
        await update(); // Refresh session
        return true;
      }
      return false;
    } catch (error) {
      console.error('Wallet linking error:', error);
      return false;
    }
  };

  const unlinkWallet = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/wallet/unlink', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await update(); // Refresh session
        if (isConnected) {
          disconnect(); // Disconnect from wallet
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Wallet unlinking error:', error);
      return false;
    }
  };

  const refreshUser = async (): Promise<void> => {
    await update();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    hasWallet,
    hasEmail,
    authMethod,
    linkWallet,
    unlinkWallet,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
