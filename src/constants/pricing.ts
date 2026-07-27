export const PLAN_PRICING: Record<string, { price: number; durationDays: number; name: string; courseId: string }> = {
  'plan-10': { 
    price: 499, 
    durationDays: 10, 
    name: 'Plan 1 — 10 Days',
    courseId: 'nism-va-mock-test-series'
  },
  'plan-30': { 
    price: 599, 
    durationDays: 30, 
    name: 'Plan 2 — 30 Days',
    courseId: 'nism-va-mock-test-series'
  },
  'plan-60': { 
    price: 699, 
    durationDays: 60, 
    name: 'Plan 3 — 60 Days',
    courseId: 'nism-va-mock-test-series'
  },
};

export const GST_RATE = 0.18;
