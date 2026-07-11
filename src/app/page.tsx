import React from 'react';
import { Hero } from '@/components/sections/hero';
import { InteractiveSandbox } from '@/components/sections/interactive-sandbox';
import { Testimonials } from '@/components/sections/testimonials';
import { Faq } from '@/components/sections/faq';
import { ContactSection } from '@/components/sections/contact-section';

export default function HomePage() {
  return (
    <div className="flex flex-col w-full overflow-x-hidden">
      {/* 1. Hero Section (Distinctive Soft Slate / Dark Navy Background with Live CBT Terminal Preview) */}
      <Hero />

      {/* 2. Interactive Mock Test Sandbox (Immediately below Hero, Real interactive question + custom physical carousel) */}
      <InteractiveSandbox />

      {/* 3. Verified Charterholder Reviews & Score Progressions in Institutional Dark Space */}
      <Testimonials />

      {/* 6. Frequently Asked Questions (Custom Smooth Accordion) */}
      <Faq />

      {/* 7. Institutional Consultation & Candidate Access Banner */}
      <ContactSection />
    </div>
  );
}
