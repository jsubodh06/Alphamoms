import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ATTENDING_OPTIONS,
  COFFEE_OPTIONS,
  DEFAULT_EVENT_CONFIG,
  buildGoogleCalendarUrl,
  buildIcsContent,
  buildOutlookCalendarUrl,
  normalizeIndianPhone,
  type EventConfig,
} from '../config/eventConfig';
import { fetchPublicEvent, submitPublicRsvp } from '../lib/rsvpClient';
import { CoffeeSleeveCard } from './CoffeeSleeveCard';
import { ConfettiBurst } from './ConfettiBurst';
import { SteamingCup } from './SteamingCup';

export interface PublicEventSummary {
  settings: EventConfig;
  confirmedCount: number;
  waitlistCount: number;
  seatsLeft: number;
  isFull: boolean;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'full' | 'error';

const TOTAL_CARDS = 7; // 6 questions + 1 final summary card
const FINAL_STEP = 6;

export function RsvpCarousel({
  onOpenAdmin,
}: {
  onOpenAdmin: () => void;
}) {
  const [eventSummary, setEventSummary] = useState<PublicEventSummary>({
    settings: DEFAULT_EVENT_CONFIG,
    confirmedCount: 0,
    waitlistCount: 0,
    seatsLeft: DEFAULT_EVENT_CONFIG.seatLimit,
    isFull: false,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  // Answers
  const [momName, setMomName] = useState('');
  const [childNameAge, setChildNameAge] = useState('');
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState<string>('');
  const [paediatricianQuestion, setPaediatricianQuestion] = useState('');
  const [coffeeChoice, setCoffeeChoice] = useState<string>('');
  const [customCoffee, setCustomCoffee] = useState('');

  // Errors & submission
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isWaitlistedResult, setIsWaitlistedResult] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  // Mobile keyboard & visualViewport tracking
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [keyboardOpenByViewport, setKeyboardOpenByViewport] = useState(false);

  // Swipe state
  const [dragShiftPx, setDragShiftPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  // Refs for keeping mobile keyboard open across consecutive text questions
  const momInputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const customCoffeeInputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  const loadEventSummary = useCallback(async () => {
    try {
      const data = await fetchPublicEvent();
      if (data?.settings) {
        setEventSummary(data);
      }
    } catch {
      // Non-fatal; default config remains visible
    }
  }, []);

  useEffect(() => {
    void loadEventSummary();
  }, [loadEventSummary]);

  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    setIsTouchDevice(touch);

    const updateViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setViewportHeight(window.innerHeight);
        document.documentElement.style.setProperty('--vvh', `${window.innerHeight}px`);
        return;
      }
      setViewportHeight(vv.height);
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardOpenByViewport(heightDiff > 130);
    };

    updateViewport();
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const isTypingMobile =
    isTouchDevice && (isInputFocused || keyboardOpenByViewport);

  const validateStep = useCallback(
    (step: number): string | null => {
      if (step === 0) {
        if (momName.trim().length < 2) {
          return "Please enter Mom's name (at least 2 characters).";
        }
      } else if (step === 1) {
        if (childNameAge.trim().length < 2) {
          return 'Please enter your child’s name & age (e.g. "Aarav, 3 years").';
        }
      } else if (step === 2) {
        const normalized = normalizeIndianPhone(phone);
        if (!/^\d{10}$/.test(normalized)) {
          return 'Please enter a valid 10-digit mobile number.';
        }
      } else if (step === 3) {
        if (!attending) {
          return 'Please choose an attendance option to continue.';
        }
      } else if (step === 5) {
        if (!coffeeChoice) {
          return 'Please pick your coffee or drink preference.';
        }
        if (coffeeChoice === 'Any other choice' && customCoffee.trim().length < 2) {
          return 'Tell us what you’d love to sip!';
        }
      }
      return null;
    },
    [attending, childNameAge, coffeeChoice, customCoffee, momName, phone],
  );

  const focusStepInput = useCallback((targetStep: number) => {
    if (targetStep === 0) {
      momInputRef.current?.focus({ preventScroll: true });
    } else if (targetStep === 1) {
      childInputRef.current?.focus({ preventScroll: true });
    } else if (targetStep === 2) {
      phoneInputRef.current?.focus({ preventScroll: true });
    } else if (targetStep === 4) {
      questionInputRef.current?.focus({ preventScroll: true });
    } else if (targetStep === 5 && coffeeChoice === 'Any other choice') {
      customCoffeeInputRef.current?.focus({ preventScroll: true });
    }
  }, [coffeeChoice]);

  const goToStep = useCallback(
    (nextStep: number, options?: { keepKeyboard?: boolean }) => {
      if (nextStep < 0 || nextStep >= TOTAL_CARDS) return;
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      setStepError(null);

      // Keep mobile keyboard open synchronously when moving between text fields
      if (options?.keepKeyboard && (nextStep === 0 || nextStep === 1 || nextStep === 2)) {
        focusStepInput(nextStep);
      } else if (nextStep === 3 || nextStep === FINAL_STEP) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }

      setCurrentStep(nextStep);
      setMaxReached((prev) => Math.max(prev, nextStep));

      if (nextStep === FINAL_STEP) {
        setConfettiKey((k) => k + 1);
      }
    },
    [focusStepInput],
  );

  const handleNext = useCallback(
    (options?: { keepKeyboard?: boolean }) => {
      const error = validateStep(currentStep);
      if (error) {
        setStepError(error);
        return;
      }
      if (currentStep < FINAL_STEP) {
        const nextStep = currentStep + 1;
        const consecutiveText =
          (currentStep === 0 && nextStep === 1) ||
          (currentStep === 1 && nextStep === 2);
        goToStep(nextStep, {
          keepKeyboard: options?.keepKeyboard ?? consecutiveText,
        });
      }
    },
    [currentStep, goToStep, validateStep],
  );

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  // Arrow key navigation when not typing inside an input/textarea
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStep < maxReached) {
          goToStep(currentStep + 1);
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStep, goToStep, handleBack, handleNext, maxReached]);

  const handleSelectAttending = (option: string) => {
    setAttending(option);
    setStepError(null);
    if (submitState !== 'idle') {
      setSubmitState('idle');
    }
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
    }
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      goToStep(4);
    }, 350);
  };

  const handleSelectCoffee = (option: string) => {
    setCoffeeChoice(option);
    setStepError(null);
    if (submitState !== 'idle') {
      setSubmitState('idle');
    }
    if (option === 'Any other choice') {
      window.setTimeout(() => {
        customCoffeeInputRef.current?.focus({ preventScroll: true });
      }, 40);
      return;
    }
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
    }
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      goToStep(FINAL_STEP);
    }, 350);
  };

  // Swipe handlers on stage
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('button') ||
      target.closest('a')
    ) {
      return;
    }
    dragStartRef.current = { x: e.clientX, y: e.clientY, active: true };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start?.active) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!isDragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      setIsDragging(true);
    }
    if (isDragging || (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy))) {
      setDragShiftPx(Math.max(-140, Math.min(140, dx)));
    }
  };

  const handlePointerEnd = () => {
    if (isDragging) {
      if (dragShiftPx < -52) {
        if (currentStep < maxReached) {
          goToStep(currentStep + 1);
        } else {
          handleNext();
        }
      } else if (dragShiftPx > 52 && currentStep > 0) {
        handleBack();
      }
    }
    dragStartRef.current = null;
    setIsDragging(false);
    setDragShiftPx(0);
  };

  const finalCoffeeOrder =
    coffeeChoice === 'Any other choice'
      ? customCoffee.trim()
      : coffeeChoice;

  const submitRsvp = async (options?: {
    mode?: 'create' | 'update';
    joinWaitlist?: boolean;
  }) => {
    if (submitState === 'submitting') return;

    // Validate all required steps before API call
    for (const s of [0, 1, 2, 3, 5]) {
      const err = validateStep(s);
      if (err) {
        goToStep(s);
        setStepError(err);
        return;
      }
    }

    setSubmitState('submitting');
    setSubmitError(null);

    const mode = options?.mode ?? 'create';

    try {
      const data = await submitPublicRsvp({
        momName: momName.trim(),
        childNameAge: childNameAge.trim(),
        phone: normalizeIndianPhone(phone),
        attending,
        paediatricianQuestion: paediatricianQuestion.trim(),
        coffeeOrder: finalCoffeeOrder,
        mode,
        joinWaitlist: Boolean(options?.joinWaitlist),
      });

      if (data.statusCode === 409 && data.code === 'DUPLICATE_PHONE') {
        setSubmitState('duplicate');
        return;
      }

      if (data.statusCode === 409 && data.code === 'SEATS_FULL') {
        setSubmitState('full');
        await loadEventSummary();
        return;
      }

      if (!data.ok) {
        setSubmitState('error');
        setSubmitError(data.error || 'Could not save your RSVP. Please retry.');
        return;
      }

      setIsWaitlistedResult(
        data.status === 'waitlisted' || Boolean(data.rsvp?.isWaitlist),
      );
      setSubmitState('success');
      setConfettiKey((k) => k + 1);
      await loadEventSummary();
    } catch {
      setSubmitState('error');
      setSubmitError('Network hiccup while saving your RSVP. Please retry.');
    }
  };

  const handleDownloadIcs = () => {
    const ics = buildIcsContent(eventSummary.settings);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alpha-moms-coffee-meet.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const firstName = momName.trim().split(/\s+/)[0] || 'Mama';
  const finalHeading =
    attending === "I'll try my best!"
      ? `We'll save you a seat, ${firstName}!`
      : `See you there, ${firstName}!`;

  const stageHeightClass = isTypingMobile
    ? 'h-[260px]'
    : currentStep === FINAL_STEP
      ? 'h-[530px] sm:h-[545px]'
      : 'h-[355px] sm:h-[385px]';

  return (
    <div
      style={viewportHeight ? { minHeight: `${viewportHeight}px` } : undefined}
      className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-4 pt-safe pb-safe transition-[min-height] duration-150"
    >
      <ConfettiBurst burstKey={confettiKey} />

      {/* Header — hidden while typing on touch devices so the card & input never jump */}
      <header
        className={`mx-auto w-full max-w-2xl text-center transition-all duration-200 ${
          isTypingMobile
            ? 'hidden'
            : 'pt-2 sm:pt-5 pb-2'
        }`}
      >
        <SteamingCup />
        <h1 className="mt-1 text-2xl sm:text-4xl font-semibold tracking-tight text-[#f7ecdc] [text-wrap:balance]">
          {eventSummary.settings.title} RSVP
        </h1>
        <p className="mt-1.5 text-sm sm:text-base italic text-[#e9a9a0]">
          Mommy, let&apos;s make some coffee memories! 🤍
        </p>
        <p className="mx-auto mt-2.5 max-w-xl text-xs sm:text-sm leading-relaxed text-[#d9b99b]/90 [text-wrap:balance]">
          We&apos;re excited to have you join us for a morning of coffee,
          conversations and an exclusive interaction with{' '}
          <span className="font-medium text-[#f7ecdc]">
            {eventSummary.settings.specialGuest}
          </span>
          .
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#e4c29b]/85 tabular-nums">
          <span>{eventSummary.settings.eventDate}</span>
          <span aria-hidden="true">·</span>
          <span>{eventSummary.settings.eventTime}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              eventSummary.isFull ? 'text-[#e9a9a0] font-medium' : 'text-[#f7ecdc] font-medium'
            }
          >
            {eventSummary.isFull
              ? 'Seats full – join waitlist'
              : `Seats left: ${eventSummary.seatsLeft}`}
          </span>
        </div>
      </header>

      {/* Main 3D Question Carousel */}
      <main
        className={`mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center ${
          isTypingMobile ? 'py-2' : 'py-3 sm:py-4'
        }`}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onFocusCapture={() => setIsInputFocused(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsInputFocused(false);
            }
          }}
          className={`carousel-stage relative w-full overflow-visible touch-pan-y select-none ${stageHeightClass}`}
          role="region"
          aria-roledescription="carousel"
          aria-label="Coffee Meet RSVP Questions"
        >
          {/* Question 1: Mom's Name */}
          <CoffeeSleeveCard
            offset={0 - currentStep}
            isReachable={0 <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={isTypingMobile}
            tag="Question 1 of 6"
            onSelectSideCard={() => goToStep(0)}
          >
            <label
              htmlFor="rsvp-mom-name"
              className="block text-xl sm:text-2xl font-semibold leading-snug text-[#241209]"
            >
              Mom&apos;s name
            </label>
            <p className="mt-1 text-sm text-[#6b3f24]">
              So we know whose cup to write on!
            </p>
            <input
              ref={momInputRef}
              id="rsvp-mom-name"
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              value={momName}
              onChange={(e) => {
                setMomName(e.target.value);
                setStepError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNext({ keepKeyboard: true });
                }
              }}
              placeholder="e.g. Ananya Sharma"
              className="mt-4 w-full rounded-xl border border-[#c98a4b]/55 bg-white/85 px-4 py-3 text-base text-[#241209] placeholder:text-[#8c5a3c]/60 focus:border-[#4a2a1a] focus:outline-none focus:ring-2 focus:ring-[#c98a4b]/40"
            />
            {currentStep === 0 && stepError && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-[#9f2c20]">
                {stepError}
              </p>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => handleNext({ keepKeyboard: true })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#4a2a1a] px-5 py-2.5 text-sm font-medium text-[#f7ecdc] shadow-sm transition-transform active:scale-[0.98] hover:bg-[#381f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </CoffeeSleeveCard>

          {/* Question 2: Child's Name & Age */}
          <CoffeeSleeveCard
            offset={1 - currentStep}
            isReachable={1 <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={isTypingMobile}
            tag="Question 2 of 6"
            onSelectSideCard={() => goToStep(1)}
          >
            <label
              htmlFor="rsvp-child-name-age"
              className="block text-xl sm:text-2xl font-semibold leading-snug text-[#241209]"
            >
              Child&apos;s name &amp; age
            </label>
            <p className="mt-1 text-sm text-[#6b3f24]">
              Helps us tailor our morning conversations.
            </p>
            <input
              ref={childInputRef}
              id="rsvp-child-name-age"
              type="text"
              enterKeyHint="next"
              value={childNameAge}
              onChange={(e) => {
                setChildNameAge(e.target.value);
                setStepError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNext({ keepKeyboard: true });
                }
              }}
              placeholder="e.g. Aarav, 3 years"
              className="mt-4 w-full rounded-xl border border-[#c98a4b]/55 bg-white/85 px-4 py-3 text-base text-[#241209] placeholder:text-[#8c5a3c]/60 focus:border-[#4a2a1a] focus:outline-none focus:ring-2 focus:ring-[#c98a4b]/40"
            />
            {currentStep === 1 && stepError && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-[#9f2c20]">
                {stepError}
              </p>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => handleNext({ keepKeyboard: true })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#4a2a1a] px-5 py-2.5 text-sm font-medium text-[#f7ecdc] shadow-sm transition-transform active:scale-[0.98] hover:bg-[#381f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </CoffeeSleeveCard>

          {/* Question 3: Contact Number */}
          <CoffeeSleeveCard
            offset={2 - currentStep}
            isReachable={2 <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={isTypingMobile}
            tag="Question 3 of 6"
            onSelectSideCard={() => goToStep(2)}
          >
            <label
              htmlFor="rsvp-phone"
              className="block text-xl sm:text-2xl font-semibold leading-snug text-[#241209]"
            >
              Contact number
            </label>
            <p className="mt-1 text-sm text-[#6b3f24]">
              10-digit WhatsApp / mobile number for meet updates.
            </p>
            <input
              ref={phoneInputRef}
              id="rsvp-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              enterKeyHint="next"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setStepError(null);
                if (submitState === 'duplicate') {
                  setSubmitState('idle');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNext({ keepKeyboard: false });
                }
              }}
              placeholder="e.g. 9876543210"
              className="mt-4 w-full rounded-xl border border-[#c98a4b]/55 bg-white/85 px-4 py-3 text-base text-[#241209] tabular-nums placeholder:text-[#8c5a3c]/60 focus:border-[#4a2a1a] focus:outline-none focus:ring-2 focus:ring-[#c98a4b]/40"
            />
            {currentStep === 2 && stepError && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-[#9f2c20]">
                {stepError}
              </p>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => handleNext({ keepKeyboard: false })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#4a2a1a] px-5 py-2.5 text-sm font-medium text-[#f7ecdc] shadow-sm transition-transform active:scale-[0.98] hover:bg-[#381f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </CoffeeSleeveCard>

          {/* Question 4: Are you attending? */}
          <CoffeeSleeveCard
            offset={3 - currentStep}
            isReachable={3 <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={isTypingMobile}
            tag="Question 4 of 6"
            onSelectSideCard={() => goToStep(3)}
          >
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug text-[#241209]">
              Are you attending?
            </h2>
            <p className="mt-1 text-sm text-[#6b3f24]">
              Tap your answer to continue.
            </p>
            <div className="mt-4 space-y-3" role="radiogroup" aria-label="Attendance">
              {ATTENDING_OPTIONS.map((option) => {
                const selected = attending === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleSelectAttending(option)}
                    className={`flex min-h-[50px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-base font-medium transition-all active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] ${
                      selected
                        ? 'border-[#4a2a1a] bg-[#4a2a1a] text-[#f7ecdc] shadow-sm'
                        : 'border-[#c98a4b]/55 bg-white/80 text-[#241209] hover:border-[#4a2a1a]/60 hover:bg-white'
                    }`}
                  >
                    <span>{option}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-[#e9a9a0]" />}
                  </button>
                );
              })}
            </div>
            {currentStep === 3 && stepError && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-[#9f2c20]">
                {stepError}
              </p>
            )}
          </CoffeeSleeveCard>

          {/* Question 5: Paediatrician Question */}
          <CoffeeSleeveCard
            offset={4 - currentStep}
            isReachable={4 <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={isTypingMobile}
            tag="Question 5 of 6"
            onSelectSideCard={() => goToStep(4)}
          >
            <label
              htmlFor="rsvp-paediatrician-q"
              className="block text-lg sm:text-xl font-semibold leading-snug text-[#241209]"
            >
              What&apos;s that ONE question you&apos;ve always wanted to ask a
              paediatrician?
            </label>
            <p className="mt-1 text-sm text-[#6b3f24]">
              Optional — Dr. Pratyush Jain will address these during our chat.
            </p>
            <textarea
              ref={questionInputRef}
              id="rsvp-paediatrician-q"
              rows={isTypingMobile ? 2 : 3}
              value={paediatricianQuestion}
              onChange={(e) => setPaediatricianQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleNext({ keepKeyboard: false });
                }
              }}
              placeholder="Sleep schedules, picky eating, immunity, screen time..."
              className="mt-3.5 w-full resize-none rounded-xl border border-[#c98a4b]/55 bg-white/85 px-4 py-3 text-base text-[#241209] placeholder:text-[#8c5a3c]/60 focus:border-[#4a2a1a] focus:outline-none focus:ring-2 focus:ring-[#c98a4b]/40"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-[#7a4526]">
                {paediatricianQuestion.trim() ? 'Press Next to continue' : 'You can skip this too'}
              </span>
              <button
                type="button"
                onClick={() => handleNext({ keepKeyboard: false })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#4a2a1a] px-5 py-2.5 text-sm font-medium text-[#f7ecdc] shadow-sm transition-transform active:scale-[0.98] hover:bg-[#381f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
              >
                <span>{paediatricianQuestion.trim() ? 'Next' : 'Skip / Next'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </CoffeeSleeveCard>

          {/* Question 6: Coffee Order */}
          <CoffeeSleeveCard
            offset={5 - currentStep}
            isReachable={5 <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={isTypingMobile}
            tag="Question 6 of 6"
            onSelectSideCard={() => goToStep(5)}
          >
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug text-[#241209]">
              Your coffee order?
            </h2>
            <p className="mt-0.5 text-sm italic text-[#7a4526]">
              Just kidding… but we would love to know! 😂
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Coffee order">
              {COFFEE_OPTIONS.map((option) => {
                const selected = coffeeChoice === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleSelectCoffee(option)}
                    className={`flex min-h-[46px] items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] ${
                      selected
                        ? 'border-[#4a2a1a] bg-[#4a2a1a] text-[#f7ecdc] shadow-sm'
                        : 'border-[#c98a4b]/55 bg-white/80 text-[#241209] hover:border-[#4a2a1a]/60 hover:bg-white'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {coffeeChoice === 'Any other choice' && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={customCoffeeInputRef}
                  type="text"
                  enterKeyHint="done"
                  value={customCoffee}
                  onChange={(e) => {
                    setCustomCoffee(e.target.value);
                    setStepError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext({ keepKeyboard: false });
                    }
                  }}
                  placeholder="Matcha, hot chocolate, chai..."
                  aria-label="Custom drink order"
                  className="min-w-0 flex-1 rounded-xl border border-[#c98a4b]/55 bg-white/90 px-3.5 py-2.5 text-base text-[#241209] placeholder:text-[#8c5a3c]/60 focus:border-[#4a2a1a] focus:outline-none focus:ring-2 focus:ring-[#c98a4b]/40"
                />
                <button
                  type="button"
                  onClick={() => handleNext({ keepKeyboard: false })}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-[#4a2a1a] px-4 py-2.5 text-sm font-medium text-[#f7ecdc] hover:bg-[#381f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
                >
                  <span>Done</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {currentStep === 5 && stepError && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-[#9f2c20]">
                {stepError}
              </p>
            )}
          </CoffeeSleeveCard>

          {/* Final Card (Index 6) */}
          <CoffeeSleeveCard
            offset={FINAL_STEP - currentStep}
            isReachable={FINAL_STEP <= maxReached}
            isDragging={isDragging}
            dragShiftPx={dragShiftPx}
            compact={false}
            tag="Confirm your spot"
            onSelectSideCard={() => goToStep(FINAL_STEP)}
          >
            <div className="space-y-3.5">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-[#241209] [text-wrap:balance]">
                  {finalHeading}
                </h2>
                <p className="mt-1 text-xs text-[#6b3f24]">
                  {eventSummary.isFull
                    ? 'Seats full – join waitlist'
                    : `Seats left: ${eventSummary.seatsLeft}`}
                </p>
              </div>

              {/* Event Details */}
              <div className="space-y-1.5 rounded-xl border border-[#c98a4b]/35 bg-white/65 px-3.5 py-3 text-xs sm:text-sm text-[#241209]">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#8b4c24]" />
                  <span>{eventSummary.settings.eventDate}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#8b4c24]" />
                  <span>{eventSummary.settings.eventTime}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8b4c24]" />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">
                      {eventSummary.settings.venueName}
                    </p>
                    <p className="text-xs text-[#6b3f24]">
                      {eventSummary.settings.venueAddress}
                    </p>
                    <a
                      href={eventSummary.settings.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#7a4526] underline decoration-[#c98a4b] underline-offset-2 hover:text-[#241209]"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Primary Submit / Status Actions */}
              {submitState === 'success' ? (
                <div
                  role="status"
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#345938] px-4 py-3 text-center text-sm sm:text-base font-semibold text-[#f7ecdc] shadow-sm"
                >
                  {isWaitlistedResult
                    ? 'Waitlist RSVP sent ✅ – Thank you!'
                    : 'RSVP sent ✅ – Thank you!'}
                </div>
              ) : submitState === 'duplicate' ? (
                <div className="rounded-xl border border-[#c98a4b]/60 bg-[#fff7eb] p-3 text-xs sm:text-sm text-[#241209]">
                  <p className="font-medium">
                    You&apos;ve already RSVP&apos;d – want to update?
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void submitRsvp({ mode: 'update' })}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#4a2a1a] px-3.5 py-2 text-xs font-medium text-[#f7ecdc] hover:bg-[#381f12]"
                    >
                      Update my RSVP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitState('idle');
                        goToStep(2);
                      }}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#c98a4b]/60 px-3 py-2 text-xs font-medium text-[#4a2a1a] hover:bg-[#e4c29b]/30"
                    >
                      Change number
                    </button>
                  </div>
                </div>
              ) : submitState === 'full' ? (
                <div className="rounded-xl border border-[#c98a4b]/60 bg-[#fff7eb] p-3 text-xs sm:text-sm text-[#241209]">
                  <p className="font-medium">
                    Seats full – join waitlist so we can ping you if a spot opens.
                  </p>
                  <button
                    type="button"
                    onClick={() => void submitRsvp({ joinWaitlist: true })}
                    className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#4a2a1a] px-4 py-2.5 text-sm font-medium text-[#f7ecdc] hover:bg-[#381f12]"
                  >
                    Join Waitlist
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={submitState === 'submitting'}
                    onClick={() =>
                      void submitRsvp({ joinWaitlist: eventSummary.isFull })
                    }
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#4a2a1a] px-5 py-3 text-base font-semibold text-[#f7ecdc] shadow-md transition-all active:scale-[0.985] hover:bg-[#361c10] disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
                  >
                    <Sparkles className="h-4 w-4 text-[#e9a9a0]" />
                    <span>
                      {submitState === 'submitting'
                        ? 'Saving your spot…'
                        : eventSummary.isFull
                          ? 'Join Waitlist'
                          : 'Submit my RSVP'}
                    </span>
                  </button>

                  {submitState === 'error' && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#9f2c20]/35 bg-[#fceeed] px-3 py-2 text-xs text-[#8f2318]">
                      <span>{submitError || 'Something went wrong.'}</span>
                      <button
                        type="button"
                        onClick={() => void submitRsvp()}
                        className="inline-flex shrink-0 items-center gap-1 font-semibold underline"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Calendar Add Links */}
              <div className="pt-0.5">
                <p className="mb-1.5 text-[11px] font-medium text-[#6b3f24]">
                  Save the date
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <a
                    href={buildGoogleCalendarUrl(eventSummary.settings)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-[#c98a4b]/50 bg-white/75 px-2 py-1.5 text-center text-[11px] font-medium text-[#4a2a1a] hover:bg-white"
                  >
                    Google Cal
                  </a>
                  <a
                    href={buildOutlookCalendarUrl(eventSummary.settings)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-[#c98a4b]/50 bg-white/75 px-2 py-1.5 text-center text-[11px] font-medium text-[#4a2a1a] hover:bg-white"
                  >
                    Outlook
                  </a>
                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[#c98a4b]/50 bg-white/75 px-2 py-1.5 text-center text-[11px] font-medium text-[#4a2a1a] hover:bg-white"
                  >
                    <Download className="h-3 w-3 shrink-0" />
                    <span>Apple / .ics</span>
                  </button>
                </div>
              </div>

              {/* Dutch-Pay Notice */}
              <div className="rounded-xl border border-[#e9a9a0]/70 bg-[#e9a9a0]/20 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#3a1d10]">
                A little heads-up: This is a Dutch-pay coffee meet. Everyone
                settles their own food and beverage bill. Please RSVP by{' '}
                <span className="font-semibold">
                  {eventSummary.settings.rsvpByDate}
                </span>
                . Seats are limited.
              </div>
            </div>
          </CoffeeSleeveCard>
        </div>

        {/* Carousel Navigation & Progress Dots — hidden on touch keyboard open */}
        {!isTypingMobile && (
          <div className="mt-4 flex w-full max-w-[450px] flex-col items-center gap-3">
            <div className="flex w-full items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="inline-flex min-h-[44px] min-w-[96px] items-center justify-center gap-1.5 rounded-xl border border-[#d9b99b]/35 bg-[#361b0e]/75 px-4 py-2 text-sm font-medium text-[#f7ecdc] transition-colors hover:bg-[#4a2a1a] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              {/* Progress Dots */}
              <div
                className="flex items-center justify-center gap-0.5"
                role="tablist"
                aria-label="RSVP question progress"
              >
                {Array.from({ length: TOTAL_CARDS }, (_, idx) => {
                  const isCurrent = idx === currentStep;
                  const isDone = idx < currentStep || (idx <= maxReached && idx !== currentStep);
                  const canJump = idx <= maxReached;
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      aria-label={
                        idx === FINAL_STEP
                          ? 'Final RSVP confirmation'
                          : `Go to question ${idx + 1}`
                      }
                      disabled={!canJump}
                      onClick={() => canJump && goToStep(idx)}
                      className="flex min-h-[44px] min-w-[24px] items-center justify-center px-0.5 focus-visible:outline-none"
                    >
                      <span
                        className={`block h-2.5 rounded-full transition-all duration-300 ${
                          isCurrent
                            ? 'w-7 bg-[#f7ecdc]'
                            : isDone
                              ? 'w-2.5 bg-[#e9a9a0]'
                              : 'w-2.5 bg-[#d9b99b]/30'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (currentStep < maxReached) {
                    goToStep(currentStep + 1);
                  } else {
                    handleNext();
                  }
                }}
                disabled={currentStep >= maxReached || currentStep === FINAL_STEP}
                className="inline-flex min-h-[44px] min-w-[96px] items-center justify-center gap-1.5 rounded-xl border border-[#d9b99b]/35 bg-[#361b0e]/75 px-4 py-2 text-sm font-medium text-[#f7ecdc] transition-colors hover:bg-[#4a2a1a] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      {!isTypingMobile && (
        <footer className="mx-auto flex w-full max-w-4xl items-center justify-between pt-2 text-[11px] text-[#d9b99b]/60">
          <span>Swipe or use arrow keys</span>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="min-h-[36px] px-2 underline-offset-4 hover:text-[#f7ecdc] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c98a4b]"
          >
            Organizer Admin
          </button>
        </footer>
      )}
    </div>
  );
}
