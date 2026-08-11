import { SiteNav } from '@/components/site-nav';
import { Hero } from '@/components/landing/hero';
import { Features, HowItWorks } from '@/components/landing/features';
import { Demo } from '@/components/landing/demo';
import { TutorSection, StudySection, Privacy, SiteFooter } from '@/components/landing/tutor-section';

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="main" className="grain">
        <Hero />
        <Features />
        <HowItWorks />
        <Demo />
        <TutorSection />
        <StudySection />
        <Privacy />
      </main>
      <SiteFooter />
    </>
  );
}
