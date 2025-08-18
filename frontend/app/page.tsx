import { Hero } from '@/components/home/Hero';
import { FeaturedProjects } from '@/components/home/FeaturedProjects';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Stats } from '@/components/home/Stats';

export default function HomePage() {
  return (
    <div>
      <Hero />
      <Stats />
      <FeaturedProjects />
      <HowItWorks />
    </div>
  );
}