"use client";

import Link from "next/link";
import Image from "next/image";
import Logo from "@/Images/Logo_skillfi.png";

export default function LandingHero() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="flex items-center gap-2 mb-6">
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
            Hire top freelancers
            <br />
            <span className="text-primary-600">for any web3 job</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-xl">
            A decentralized marketplace with secure escrow, instant crypto payouts, and
            wallet/Web2 login. Powered by SIWE, NextAuth, and on-chain reputation.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link href="/auth/signup" className="btn-primary px-6 py-3 text-base">Get Started</Link>
            <Link href="/projects" className="btn-secondary px-6 py-3 text-base">Browse Projects</Link>
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center justify-center">
            <Image
              src={Logo}
              alt="SkillFi Logo"
              priority
              sizes="(min-width: 768px) 420px, 60vw"
              style={{ height: 'auto', width: 'auto', maxWidth: '420px' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
