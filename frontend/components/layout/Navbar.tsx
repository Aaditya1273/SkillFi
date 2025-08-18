'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSession } from 'next-auth/react';
import { Search, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold text-gray-900">SkillFi</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/projects" className="text-gray-700 hover:text-primary-600">
              Browse Projects
            </Link>
            <Link href="/freelancers" className="text-gray-700 hover:text-primary-600">
              Find Talent
            </Link>
            <Link href="/how-it-works" className="text-gray-700 hover:text-primary-600">
              How It Works
            </Link>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search projects, skills..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Auth & Actions */}
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <Link href="/dashboard" className="btn-secondary">
                  Dashboard
                </Link>
                <Link href="/projects/create" className="btn-primary">
                  Post Project
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-gray-700 hover:text-primary-600">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="btn-primary">
                  Get Started
                </Link>
              </>
            )}
            <ConnectButton />
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <Link href="/projects" className="text-gray-700">Browse Projects</Link>
              <Link href="/freelancers" className="text-gray-700">Find Talent</Link>
              <Link href="/how-it-works" className="text-gray-700">How It Works</Link>
              <div className="pt-4 border-t">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}