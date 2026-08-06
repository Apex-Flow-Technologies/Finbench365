import React from 'react';
import { Hero } from '@/components/sections/hero';
import { ExamTracks } from '@/components/sections/exam-tracks';
import { InteractiveSandbox } from '@/components/sections/interactive-sandbox';
import { Faq } from '@/components/sections/faq';
import { ContactSection } from '@/components/sections/contact-section';

export default function HomePage() {
  return (
    <div className="flex flex-col w-full overflow-x-hidden">
      <Hero />

      {/* The exams actually on sale, driven by the official NISM pattern table. */}
      <ExamTracks />

      {/* Try a real question before buying. */}
      <InteractiveSandbox />

      <Faq />

      <ContactSection />

      {/*
        The Testimonials section was removed rather than rewritten.
        Every entry was invented: candidates who do not exist ("Candidate #1048,
        Investment Analyst at Institutional Asset Manager"), specific score
        improvements presented as fact ("Mock Score: 62% → 89%", "96th
        Percentile Overall"), and praise for features this platform does not
        have — an IRT diagnostic engine, Monte Carlo problems that regenerate
        their numbers, CFA Level II and III preparation.

        Fabricated social proof is the most exposed content a site can carry
        under the Consumer Protection Act 2019 and the ASCI code, and it cannot
        be corrected by editing the wording — it needs real candidates. The team
        checklist already plans to gather them ("provide students coupon for
        free trials for 1-2 exams for testimonials"). Restore the section with
        genuine, attributable reviews once those exist.
      */}
    </div>
  );
}
