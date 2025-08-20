"use client";

import { useSession, signOut } from "next-auth/react";
import { useAccount } from "wagmi";
import Image from "next/image";
import Link from "next/link";
import { Settings as SettingsIcon, Wallet, BadgeCheck, PenSquare, Plus, ShieldCheck, Activity as ActivityIcon, Briefcase } from "lucide-react";
import Logo from "@/Images/Logo_skillfi.png";

function shorten(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { address, isConnected } = useAccount();

  const name = (session?.user as any)?.name || (session?.user as any)?.email || (isConnected ? shorten(address) : "Guest");
  const avatar = (session?.user as any)?.image as string | undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Fixed Settings button at top-right */}
      <Link
        href="/settings"
        className="fixed top-4 right-4 z-50 bg-white border rounded-full shadow p-2 hover:bg-gray-50"
        aria-label="Settings"
      >
        <SettingsIcon className="w-5 h-5" />
      </Link>
      {/* Header: cover + avatar + primary actions */}
      <section className="rounded-xl border bg-white overflow-hidden mb-6">
        <div className="h-32 md:h-40 w-full bg-gradient-to-r from-primary-50 to-white" />
        <div className="px-4 pb-4 -mt-10 flex items-end justify-between">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow">
              {avatar ? (
                <Image src={avatar} alt="avatar" width={96} height={96} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image src={Logo} alt="SkillFi" width={72} height={72} />
                </div>
              )}
            </div>
            <div className="pb-2">
              <h1 className="text-2xl font-bold">{name}</h1>
              <p className="text-sm text-gray-600">{isConnected && address ? `Wallet: ${shorten(address)}` : "No wallet connected"}</p>
              <p className="text-sm text-gray-500">On‑chain reputation • Secure escrow • Web3 freelancing</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Link href="/open-to" className="rounded-full border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 flex items-center gap-1"><BadgeCheck className="w-4 h-4 text-primary-600"/>Open to</Link>
            <Link href="/settings/profile" className="rounded-full border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 flex items-center gap-1"><Plus className="w-4 h-4"/>Add profile section</Link>
            <Link href="/settings" className="rounded-full border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 flex items-center gap-1"><PenSquare className="w-4 h-4"/>Enhance profile</Link>
            <Link href="/resources" className="rounded-full border px-3 py-1.5 text-sm bg-white hover:bg-gray-50">Resources</Link>
          </div>
        </div>
      </section>

      {/* Quick actions bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/projects/create" className="btn-primary w-full text-center">Post Project</Link>
        <Link href="/wallet" className="btn-secondary w-full text-center flex items-center justify-center gap-2"><Wallet className="w-4 h-4"/>Link/Manage Wallet</Link>
        <Link href="/reputation" className="btn-secondary w-full text-center flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4"/>View Reputation</Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          <section className="border rounded-lg p-4 bg-white">
            <h2 className="font-semibold mb-3">About</h2>
            <p className="text-sm text-gray-600">Update your bio, skills, and basic information.</p>
            <div className="mt-4">
              <Link href="/settings/profile" className="text-primary-600 hover:underline">Edit profile</Link>
            </div>
          </section>

          <section className="border rounded-lg p-4 bg-white">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><ActivityIcon className="w-4 h-4"/>Activity</h2>
            <p className="text-sm text-gray-600">You haven’t posted yet. Share progress, bounties, or releases.</p>
            <div className="mt-4">
              <Link href="/posts/create" className="btn-secondary">Create a post</Link>
            </div>
          </section>

          <section className="border rounded-lg p-4 bg-white">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4"/>Experience</h2>
            <p className="text-sm text-gray-600">Showcase audits, protocol contributions, and shipped apps.</p>
            <div className="mt-4">
              <Link href="/settings/experience" className="text-primary-600 hover:underline">Add experience</Link>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <section className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-3">Profile language</h3>
            <p className="text-sm text-gray-600">English</p>
          </section>
          <section className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-3">Public profile & URL</h3>
            <p className="text-sm text-gray-600">skillfi.com/u/your-handle</p>
          </section>
          <section className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-3">Analytics</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold">0</div>
                <div className="text-xs text-gray-500">Profile views</div>
              </div>
              <div>
                <div className="text-lg font-semibold">0</div>
                <div className="text-xs text-gray-500">Post impressions</div>
              </div>
              <div>
                <div className="text-lg font-semibold">0</div>
                <div className="text-xs text-gray-500">Reputation changes</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end mt-6">
        {status === "authenticated" && (
          <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-secondary">Sign out</button>
        )}
      </div>
    </div>
  );
}
