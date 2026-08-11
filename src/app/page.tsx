import { SiteNav } from '@/components/site-nav';
import { Hero } from '@/components/landing/hero';
import { Loop } from '@/components/landing/loop';
import { Method } from '@/components/landing/method';
import { Features, CallToAction, SiteFooter } from '@/components/landing/features';

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <Loop />
        <Method />
        <Features />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
