"use client";

import Link from "next/link";
import { Check, Crown, Rocket } from "lucide-react";

const featuresMarket = [
  "Secure on-chain escrow",
  "Instant crypto payouts (USDC/ETH)",
  "SIWE + Web2 login",
  "On-chain reputation & badges",
  "Dispute resolution",
];

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 mt-0.5 text-primary-600" />
      <span className="text-sm text-gray-700">{text}</span>
    </li>
  );
}

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold">Simple, transparent pricing</h1>
        <p className="mt-3 text-gray-600">Built for web3 teams and independent builders. Pay only when value is delivered.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Starter */}
        <div className="border rounded-xl p-6 bg-white flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Rocket className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold">Starter</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">For indie builders starting out</p>
          <div className="mb-4">
            <div className="text-3xl font-bold">0%</div>
            <div className="text-sm text-gray-500">platform fee on first $500 earned</div>
          </div>
          <ul className="space-y-2 mb-6">
            {featuresMarket.map((f) => (
              <FeatureItem key={f} text={f} />
            ))}
          </ul>
          <Link href="/auth/signin" className="btn-primary mt-auto text-center">Get started free</Link>
        </div>

        {/* Pro (recommended) */}
        <div className="border-2 border-primary-200 rounded-xl p-6 bg-primary-50 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs px-3 py-1 rounded-full shadow">Most popular</div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-primary-700" />
            <h2 className="text-xl font-semibold">Pro</h2>
          </div>
          <p className="text-sm text-gray-700 mb-4">For growing teams and freelancers</p>
          <div className="mb-4">
            <div className="text-3xl font-bold">5%</div>
            <div className="text-sm text-gray-600">service fee per completed milestone</div>
          </div>
          <ul className="space-y-2 mb-6">
            {[...featuresMarket, "Priority escrow support", "Reputation boosts"].map((f) => (
              <FeatureItem key={f} text={f} />
            ))}
          </ul>
          <Link href="/projects/create" className="btn-primary mt-auto text-center">Post a project</Link>
        </div>

        {/* Enterprise */}
        <div className="border rounded-xl p-6 bg-white flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-gray-800" />
            <h2 className="text-xl font-semibold">Enterprise</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">For DAOs and companies at scale</p>
          <div className="mb-4">
            <div className="text-3xl font-bold">Custom</div>
            <div className="text-sm text-gray-500">volume pricing • dedicated support</div>
          </div>
          <ul className="space-y-2 mb-6">
            {[...featuresMarket, "Multi-sig workflows", "Compliance & reporting", "Dedicated success manager"].map((f) => (
              <FeatureItem key={f} text={f} />
            ))}
          </ul>
          <Link href="/contact" className="btn-secondary mt-auto text-center">Talk to sales</Link>
        </div>
      </div>

      <div className="mt-12 border rounded-xl p-6 bg-white">
        <h3 className="font-semibold mb-2">What’s included</h3>
        <p className="text-sm text-gray-600 mb-4">All plans include wallet + Web2 login, SIWE verification, instant crypto payouts with on-chain receipts, and a dispute-ready escrow vault for milestones.</p>
        <div className="text-xs text-gray-500">Fees are applied only on successful, released milestones. Gas/network fees are separate.</div>
      </div>
    </div>
  );
}
