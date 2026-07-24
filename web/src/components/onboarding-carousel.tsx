import { useState } from 'react';

import { AnimatePresence, motion, type PanInfo } from 'motion/react';

import { Brick, type BrickVariant } from '@/components/ui/brick';

type Slide = {
  brickVariant: BrickVariant;
  title: string;
  body: string;
};

function slidesFor(firstName: string): Slide[] {
  return [
    {
      brickVariant: 'default',
      title: `Hey ${firstName}! I'm Brick.`,
      body: 'Think of me as your unofficial referee for bets with friends.',
    },
    {
      brickVariant: 'default',
      title: 'Challenge a friend to anything',
      body: "Chores, coffee, who's right about something — no real money, just bragging rights.",
    },
    {
      brickVariant: 'waiting',
      title: "I keep score so you don't have to",
      body: "Win, lose, or settle up — it's all tracked automatically, right down to who owes what.",
    },
    {
      brickVariant: 'cheeky',
      title: "Alright, let's find you a rival.",
      body: "I'll be right here when you win.",
    },
  ];
}

const CONFETTI = [
  { top: '15%', left: '12%', color: 'bg-lime', delay: 0 },
  { top: '25%', left: '82%', color: 'bg-up', delay: 0.05 },
  { top: '10%', left: '55%', color: 'bg-white', delay: 0.1 },
  { top: '42%', left: '18%', color: 'bg-down', delay: 0.15 },
  { top: '55%', left: '88%', color: 'bg-lime', delay: 0.2 },
  { top: '8%', left: '30%', color: 'bg-up', delay: 0.25 },
] as const;

const SWIPE_THRESHOLD = 60;

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
};

/**
 * Full-screen onboarding takeover, replacing the earlier small inline
 * Brick card -- same "first-run only" gate (see home.tsx's
 * INTRO_SEEN_STORAGE_KEY), just a real takeover moment instead of a card
 * competing for attention with the empty-state content behind it. Swipeable
 * (drag="x") in addition to the Next button, since a takeover like this
 * reads as a native carousel, not a form.
 */
export function OnboardingCarousel({
  firstName,
  onDone,
}: {
  firstName: string;
  onDone: () => void;
}) {
  const slides = slidesFor(firstName);
  const [[step, direction], setStep] = useState<[number, number]>([0, 0]);
  const isLast = step === slides.length - 1;
  const slide = slides[step];

  function goTo(next: number) {
    if (next < 0 || next >= slides.length) return;
    setStep(([current]) => [next, next > current ? 1 : -1]);
  }

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD) goTo(step + 1);
    else if (info.offset.x > SWIPE_THRESHOLD) goTo(step - 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#1C1917] text-white dark:bg-black">
      <button
        type="button"
        onClick={onDone}
        className="absolute right-four top-six z-10 text-sm font-bold text-white/60"
      >
        Skip
      </button>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-four">
        {isLast
          ? CONFETTI.map((c, i) => (
              <motion.span
                key={i}
                aria-hidden
                className={`absolute h-3 w-3 rounded-[2px] ${c.color}`}
                style={{ top: c.top, left: c.left }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                transition={{ delay: c.delay, type: 'spring', stiffness: 200, damping: 15 }}
              />
            ))
          : null}

        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={handleDragEnd}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex w-full max-w-app flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            >
              <Brick size={104} variant={slide.brickVariant} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-five font-display text-hero font-extrabold tracking-display-tight"
            >
              {slide.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="mt-two text-white/70"
            >
              {slide.body}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-four p-four pb-six">
        <div className="flex items-center justify-center gap-1">
          {slides.map((_, i) => (
            <motion.span
              key={i}
              className={`h-1.5 rounded-pill ${i === step ? 'bg-lime' : 'bg-white/25'}`}
              animate={{ width: i === step ? 24 : 6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          ))}
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => (isLast ? onDone() : goTo(step + 1))}
          className="w-full rounded-[16px] bg-lime px-four py-three text-sm font-extrabold text-on-lime"
        >
          {isLast ? "Let's go" : 'Next'}
        </motion.button>
      </div>
    </div>
  );
}
