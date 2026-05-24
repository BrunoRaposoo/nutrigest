import { Features } from '../components/landing/features';
import { Footer } from '../components/landing/footer';
import { Hero } from '../components/landing/hero';
import { HowItWorks } from '../components/landing/how-it-works';

export default function Landing() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Footer />
    </>
  );
}
