'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSession } from 'next-auth/react';
import { Search, Menu, X, Home, Users, Briefcase, MessageSquare, Bell, Grid3x3, User, FileText, DollarSign, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import Image from 'next/image';
import Logo from '@/Images/Logo_skillfi.png';

function shorten(addr?: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Navbar() {
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthed = Boolean(session) || isConnected;
  const displayName = (session?.user as any)?.name || (session?.user as any)?.email || (address ? shorten(address) : 'Profile');
  const userType = session?.user?.userType || 'jobSeeker';

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Authenticated: LinkedIn-like layout */}
        {isAuthed ? (
          <div className="flex items-center h-16 gap-6">
            {/* Left: Logo + Search */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image src={Logo} alt="SkillFi" width={40} height={40} priority />
            </Link>
            <div className="hidden sm:block flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search jobs, talent, DAOs..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-full focus:ring-2 focus:ring-primary-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Center: Role-based Icon tabs */}
            <div className="hidden md:flex items-end gap-8 mx-auto">
              <Link href="/dashboard" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                <Home className="w-5 h-5" />
                <span className="text-xs mt-1">Home</span>
              </Link>
              
              {userType === 'jobSeeker' ? (
                <>
                  <Link href="/jobs" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                    <Briefcase className="w-5 h-5" />
                    <span className="text-xs mt-1">Find Jobs</span>
                  </Link>
                  <Link href="/applications" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs mt-1">Applications</span>
                  </Link>
                  <Link href="/skills" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                    <User className="w-5 h-5" />
                    <span className="text-xs mt-1">Skills</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/my-jobs" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                    <Briefcase className="w-5 h-5" />
                    <span className="text-xs mt-1">My Jobs</span>
                  </Link>
                  <Link href="/post-job" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs mt-1">Post Job</span>
                  </Link>
                  <Link href="/team" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                    <Users className="w-5 h-5" />
                    <span className="text-xs mt-1">Team</span>
                  </Link>
                </>
              )}
              
              <Link href="/messages" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                <MessageSquare className="w-5 h-5" />
                <span className="text-xs mt-1">Messages</span>
              </Link>
              <Link href="/notifications" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                <Bell className="w-5 h-5" />
                <span className="text-xs mt-1">Notifications</span>
              </Link>
              <div className="w-px h-6 bg-gray-200" />
              <Link href="/earnings" className="flex flex-col items-center text-gray-600 hover:text-primary-600">
                <DollarSign className="w-5 h-5" />
                <span className="text-xs mt-1">Earnings</span>
              </Link>
            </div>

            {/* Right: Me + Connect */}
            <div className="ml-auto flex items-center gap-3">
              <Link href="/profile" className="hidden sm:flex items-center text-gray-700 hover:text-primary-600">
                <span className="text-sm">Me</span>
              </Link>
              <ConnectButton chainStatus="none" showBalance={false} accountStatus="avatar" />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        ) : (
          /* Guest: keep simple marketing navbar */
          <div className="flex items-center h-16 relative">
            {/* Left: Logo */}
            <Link href="/" className="flex items-center space-x-2 shrink-0">
              <Image src={Logo} alt="SkillFi" width={40} height={40} priority />
              <span className="text-xl font-bold text-gray-900">SkillFi</span>
            </Link>
            {/* Center: Nav */}
            <div className="hidden md:flex items-center space-x-8 flex-1 justify-center">
              <Link href="/projects" className="text-gray-700 hover:text-primary-600">Browse Projects</Link>
              <Link href="/freelancers" className="text-gray-700 hover:text-primary-600">Find Talent</Link>
              <Link href="/pricing" className="text-gray-700 hover:text-primary-600">Pricing</Link>
            </div>
            {/* Right: Actions */}
            <div className="flex items-center space-x-4 shrink-0">
              <Link href="/auth/signin" className="text-gray-700 hover:text-primary-600">Sign In</Link>
              <ConnectButton chainStatus="none" showBalance={false} accountStatus="avatar" />
            </div>
            {/* Mobile toggle */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 ml-2">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        )}

        {/* Mobile Menu (guest only simple) */}
        {!isAuthed && isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <Link href="/projects" className="text-gray-700">Browse Projects</Link>
              <Link href="/freelancers" className="text-gray-700">Find Talent</Link>
              <Link href="/pricing" className="text-gray-700">Pricing</Link>
              <Link href="/auth/signin" className="text-gray-700">Sign In</Link>
              <div className="pt-2"><ConnectButton chainStatus="none" showBalance={false} accountStatus="avatar" /></div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}