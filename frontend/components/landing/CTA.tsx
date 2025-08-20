import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 bg-primary-600 text-white rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl md:text-3xl font-bold">Join SkillFi today</h3>
          <p className="text-white/90 mt-2">Post a job, hire faster, and pay securely with on‑chain escrow.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/auth/signup" className="bg-white text-primary-700 rounded-lg px-5 py-3 font-semibold">Join now</Link>
          <Link href="/projects" className="bg-primary-700 hover:bg-primary-700/90 rounded-lg px-5 py-3 font-semibold">Explore jobs</Link>
        </div>
      </div>
    </section>
  );
}
