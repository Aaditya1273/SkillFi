# SkillFi Authentication System Setup Guide

## Overview
The SkillFi authentication system now supports:
- ✅ **Email/Password Authentication**
- ✅ **Wallet Authentication** (MetaMask, WalletConnect via RainbowKit)
- ✅ **Social Login** (Google, GitHub, LinkedIn)
- ✅ **Wallet-Web2 Identity Linking**
- ✅ **Comprehensive Session Management**

## Architecture

### Frontend (Next.js)
- **NextAuth.js** for unified authentication
- **RainbowKit + Wagmi** for wallet connections
- **SIWE (Sign-In with Ethereum)** for wallet authentication
- **Custom hooks** for authentication state management

### Backend (Auth Service)
- **Express.js** authentication service
- **MongoDB** with Mongoose for user data
- **Redis** for session storage
- **Passport.js** for OAuth strategies
- **JWT** tokens for API authentication

## Setup Instructions

### 1. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Auth Service
```bash
cd auth-service
npm install
```

### 2. Environment Configuration

#### Frontend (.env.local)
```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-here

# Auth Service URL
AUTH_SERVICE_URL=http://localhost:5000

# Social OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# WalletConnect Project ID
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-walletconnect-project-id

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/skillfi
```

#### Auth Service (.env)
```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/skillfi
REDIS_URL=redis://localhost:6379

# JWT Secrets
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# Session Secret
SESSION_SECRET=your-session-secret

# Email Service (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# OAuth Credentials (same as frontend)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
```

### 3. OAuth App Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google`

#### GitHub OAuth
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL:
   - `http://localhost:3000/api/auth/callback/github`

#### LinkedIn OAuth
1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Create a new app
3. Add redirect URLs:
   - `http://localhost:3000/api/auth/callback/linkedin`

#### WalletConnect
1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy the Project ID

### 4. Database Setup

#### PostgreSQL (for Prisma)
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

#### MongoDB (for Auth Service)
```bash
# Start MongoDB service
mongod

# The auth service will automatically create collections
```

#### Redis (for Sessions)
```bash
# Start Redis service
redis-server
```

### 5. Start Services

#### Terminal 1 - Auth Service
```bash
cd auth-service
npm run dev
```

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

#### Terminal 3 - Backend API (if needed)
```bash
cd backend
npm run dev
```

## Usage Examples

### 1. Email/Password Authentication
```typescript
import { signIn } from 'next-auth/react';

const handleEmailLogin = async () => {
  const result = await signIn('credentials', {
    email: 'user@example.com',
    password: 'password123',
    redirect: false
  });
};
```

### 2. Wallet Authentication
```typescript
import { useWalletAuth } from '@/lib/auth/useWalletAuth';

const { signInWithWallet, isLoading } = useWalletAuth();

const handleWalletLogin = async () => {
  const success = await signInWithWallet();
  if (success) {
    // User authenticated with wallet
  }
};
```

### 3. Social Login
```typescript
import { signIn } from 'next-auth/react';

const handleGoogleLogin = () => {
  signIn('google', { callbackUrl: '/' });
};
```

### 4. Link Wallet to Existing Account
```typescript
import { useAuth } from '@/lib/auth/AuthContext';

const { linkWallet } = useAuth();

const handleLinkWallet = async () => {
  const success = await linkWallet(address, signature, message);
  if (success) {
    // Wallet linked successfully
  }
};
```

## API Endpoints

### Frontend API Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/wallet/nonce` - Get nonce for wallet auth
- `POST /api/auth/wallet/verify` - Verify wallet signature
- `GET|POST /api/auth/[...nextauth]` - NextAuth endpoints

### Auth Service Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/wallet/nonce` - Generate wallet nonce
- `POST /api/auth/wallet/verify` - Verify wallet signature
- `POST /api/social/link` - Link social account
- `POST /api/social/connect-wallet` - Connect wallet to social account
- `GET /api/social/accounts` - Get linked social accounts

## Authentication Flow

### 1. Email/Password Flow
1. User submits email/password
2. Frontend calls NextAuth credentials provider
3. NextAuth forwards to auth service
4. Auth service validates credentials
5. JWT session created

### 2. Wallet Authentication Flow
1. User connects wallet (RainbowKit)
2. Frontend requests nonce from auth service
3. User signs SIWE message
4. Frontend submits signature to NextAuth
5. NextAuth verifies signature via auth service
6. Session created with wallet address

### 3. Social Login Flow
1. User clicks social login button
2. NextAuth redirects to OAuth provider
3. User authorizes on provider
4. Provider redirects back with code
5. NextAuth exchanges code for tokens
6. User profile created/linked via auth service

### 4. Wallet Linking Flow
1. Authenticated user connects wallet
2. User signs linking message
3. Frontend calls wallet linking API
4. Auth service verifies and links wallet
5. Session updated with wallet address

## Security Features

- **SIWE Message Verification** for wallet authentication
- **JWT Token Rotation** with refresh tokens
- **Rate Limiting** on authentication endpoints
- **Session Management** with Redis
- **CSRF Protection** via NextAuth
- **Secure Cookie Configuration**
- **Input Validation** with Joi/Zod
- **Password Hashing** with bcrypt

## Testing

### Test User Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Test Wallet Nonce
```bash
curl -X POST http://localhost:5000/api/auth/wallet/nonce \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234567890123456789012345678901234567890"}'
```

## Troubleshooting

### Common Issues

1. **OAuth Redirect URI Mismatch**
   - Ensure redirect URIs match exactly in OAuth app settings

2. **Database Connection Errors**
   - Check MongoDB/PostgreSQL/Redis are running
   - Verify connection strings in environment variables

3. **SIWE Verification Failures**
   - Ensure nonce is fresh and matches
   - Check wallet address case sensitivity

4. **Session Issues**
   - Clear browser cookies
   - Restart Redis server
   - Check NEXTAUTH_SECRET is set

### Debug Mode
Set `NODE_ENV=development` and `debug: true` in NextAuth config for detailed logs.

## Next Steps

1. **Install Dependencies**: Run `npm install` in both frontend and auth-service
2. **Configure Environment**: Set up all required environment variables
3. **Setup OAuth Apps**: Create OAuth applications for social login
4. **Start Services**: Run auth service and frontend
5. **Test Authentication**: Verify all authentication methods work
6. **Implement UI**: Create authentication UI components (optional)

The authentication system is now fully configured and ready for use!
