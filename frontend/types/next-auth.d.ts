import NextAuth from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string;
      walletAddress?: string;
      firstName?: string;
      lastName?: string;
      provider?: string;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string;
    walletAddress?: string;
    firstName?: string;
    lastName?: string;
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    walletAddress?: string;
    firstName?: string;
    lastName?: string;
    provider?: string;
  }
}
