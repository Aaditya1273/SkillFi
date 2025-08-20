import LandingHero from '@/components/landing/LandingHero';
import FeatureGrid from '@/components/landing/FeatureGrid';
import Showcase from '@/components/landing/Showcase';
import TrustLogos from '@/components/landing/TrustLogos';
import CTA from '@/components/landing/CTA';

export default function HomePage() {
  return (
    <main>
      <LandingHero />
      <FeatureGrid />
      <Showcase />
      <TrustLogos />
      <CTA />
    </main>
  );
}