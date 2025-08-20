import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import LinkedInProvider from 'next-auth/providers/linkedin';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SiweMessage } from 'siwe';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Email/Password Authentication
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials: { email: string; password: string } | undefined) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const response = await fetch(`${process.env.AUTH_SERVICE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          return {
            id: data.user.id,
            email: data.user.email,
            username: data.user.username,
            walletAddress: data.user.walletAddress,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            image: data.user.avatar
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    }),

    // Email + OTP Authentication
    CredentialsProvider({
      id: 'email-otp',
      name: 'email-otp',
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' }
      },
      async authorize(credentials: { email: string; otp: string } | undefined) {
        if (!credentials?.email || !credentials?.otp) {
          return null;
        }

        try {
          const response = await fetch(`${process.env.AUTH_SERVICE_URL}/api/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              otp: credentials.otp
            })
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          return {
            id: data.user.id,
            email: data.user.email,
            username: data.user.username,
            walletAddress: data.user.walletAddress,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            image: data.user.avatar
          };
        } catch (error) {
          console.error('OTP auth error:', error);
          return null;
        }
      }
    }),

    // Wallet Authentication
    CredentialsProvider({
      id: 'wallet',
      name: 'wallet',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
        address: { label: 'Address', type: 'text' }
      },
      async authorize(credentials: { message: string; signature: string; address: string } | undefined) {
        if (!credentials?.message || !credentials?.signature || !credentials?.address) {
          return null;
        }

        try {
          // Verify SIWE message
          const siweMessage = new SiweMessage(credentials.message);
          const fields = await siweMessage.verify({ signature: credentials.signature });

          if (fields.data.address.toLowerCase() !== credentials.address.toLowerCase()) {
            return null;
          }

          // Authenticate with backend
          const response = await fetch(`${process.env.AUTH_SERVICE_URL}/api/auth/wallet/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: credentials.message,
              signature: credentials.signature,
              address: credentials.address
            })
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          return {
            id: data.user.id,
            email: data.user.email,
            username: data.user.username || `user_${data.user.walletAddress.slice(-6)}`,
            walletAddress: data.user.walletAddress,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            image: data.user.avatar
          };
        } catch (error) {
          console.error('Wallet auth error:', error);
          return null;
        }
      }
    }),

    // Social Providers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),

    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    }),

    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'r_liteprofile r_emailaddress'
        }
      }
    })
  ],
  
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60 // 24 hours
  },

  callbacks: {
    async signIn({ user, account, profile }: any) {
      // Handle social login account linking
      if (account?.provider !== 'credentials' && account?.provider !== 'wallet') {
        try {
          const response = await fetch(`${process.env.AUTH_SERVICE_URL}/api/auth/social/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: account.provider,
              providerId: account.providerAccountId,
              email: user.email,
              name: user.name,
              image: user.image,
              profile: profile
            })
          });

          if (response.ok) {
            const data = await response.json();
            user.id = data.user.id;
            user.username = data.user.username;
            user.walletAddress = data.user.walletAddress;
          }
        } catch (error) {
          console.error('Social login linking error:', error);
        }
      }
      return true;
    },

    async jwt({ token, user, account }: any) {
      if (user) {
        token.username = user.username;
        token.walletAddress = user.walletAddress;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      
      if (account) {
        token.provider = account.provider;
      }
      
      return token;
    },

    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub;
        session.user.username = token.username;
        session.user.walletAddress = token.walletAddress;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.provider = token.provider;
      }
      return session;
    }
  },

  events: {
    async signIn({ user, account, isNewUser }: any) {
      // Log authentication events
      console.log(`User ${user.email} signed in via ${account?.provider}`);
      
      if (isNewUser) {
        console.log(`New user created: ${user.email}`);
      }
    },
    
    async signOut({ token }: any) {
      console.log(`User ${token?.email} signed out`);
    }
  },

  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error'
  },

  debug: process.env.NODE_ENV === 'development'
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };