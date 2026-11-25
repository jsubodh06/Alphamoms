import { ArrowRight, Coffee, Eye } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import alphaMomsLogo from '../assets/alpha-moms-logo.png';
import type { PublicEventSummary } from './RsvpCarousel';

interface CoffeePourIntroProps {
  eventSummary: PublicEventSummary;
  onStartRsvp: () => void;
  onOpenPoster: () => void;
  onOpenAdmin: () => void;
}

export function CoffeePourIntro({
  eventSummary,
  onStartRsvp,
  onOpenPoster,
  onOpenAdmin,
}: CoffeePourIntroProps) {
  const [pourKey, setPourKey] = useState(1);
  const [brewed, setBrewed] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    setBrewed(false);
    const timer = window.setTimeout(() => setBrewed(true), 1950);
    return () => window.clearTimeout(timer);
  }, [pourKey]);

  const handleStart = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      onStartRsvp();
    }, 340);
  };

  return (
    <div
      className={`relative z-10 flex min-h-[100dvh] flex-col justify-between px-4 pt-safe pb-safe transition-all duration-350 ease-out ${
        isLeaving
          ? 'opacity-0 -translate-y-4 scale-[0.985] pointer-events-none'
          : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      {/* Top Alpha Moms Logo Badge */}
      <div className="mx-auto flex w-full max-w-2xl justify-center pt-2 sm:pt-5">
        <button
          type="button"
          onClick={onOpenPoster}
          aria-label="Alpha Moms logo — tap to view official event invite"
          className="inline-flex items-center justify-center rounded-2xl border border-[#e4c29b]/80 bg-white px-4 py-1.5 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.65)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b]"
        >
          <img
            src={alphaMomsLogo}
            alt="Alpha Moms"
            className="h-9 sm:h-11 w-auto object-contain"
          />
        </button>
      </div>

      {/* Main Hero: Live Espresso Pouring Cup + Event Intro */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-3 text-center">
        {/* Interactive Coffee Pour Illustration (tap cup to re-pour) */}
        <button
          type="button"
          onClick={() => setPourKey((k) => k + 1)}
          aria-label="Fresh coffee pouring into cup — tap to pour again"
          className="group relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] rounded-full"
        >
          {/* Soft warm ambient halo behind the cup */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-2 rounded-full opacity-55 transition-opacity duration-500 group-hover:opacity-75"
            style={{
              background:
                'radial-gradient(circle, rgba(201,138,75,0.42) 0%, rgba(233,169,160,0.14) 52%, transparent 74%)',
            }}
          />

          <svg
            key={pourKey}
            viewBox="0 0 220 205"
            className="relative h-[168px] w-[180px] sm:h-[196px] sm:w-[210px] overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              {/* Cup interior clipping path so rising espresso stays cleanly inside */}
              <clipPath id={`cup-interior-${pourKey}`}>
                <path d="M59 96H153L144.5 148C142 162.5 129 170 106 170C83 170 70 162.5 67.5 148L59 96Z" />
              </clipPath>

              {/* Rich espresso-to-crema stream gradient */}
              <linearGradient
                id={`stream-grad-${pourKey}`}
                x1="106"
                y1="6"
                x2="106"
                y2="112"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#8c4e27" stopOpacity="0.92" />
                <stop offset="48%" stopColor="#c98a4b" />
                <stop offset="100%" stopColor="#6b3819" />
              </linearGradient>

              {/* Warm poured espresso & crema fill gradient */}
              <linearGradient
                id={`coffee-fill-${pourKey}`}
                x1="106"
                y1="94"
                x2="106"
                y2="172"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#d99a5b" />
                <stop offset="22%" stopColor="#8b4d27" />
                <stop offset="100%" stopColor="#3c1f10" />
              </linearGradient>
            </defs>

            {/* Expanding subtle coffee aroma rings once brewed */}
            <circle
              cx="106"
              cy="128"
              r="64"
              stroke="#e4c29b"
              strokeOpacity="0.35"
              strokeWidth="1.2"
              className="aroma-ring"
            />
            <circle
              cx="106"
              cy="128"
              r="76"
              stroke="#e9a9a0"
              strokeOpacity="0.24"
              strokeWidth="1"
              className="aroma-ring"
              style={{ animationDelay: '2.7s' }}
            />

            {/* Animated Steam Wisps fading in as the cup fills */}
            <g className="pour-steam-reveal">
              <path
                d="M84 74C79 62 89 52 84 37"
                stroke="#f7ecdc"
                strokeOpacity="0.72"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="steam-wisp-1"
              />
              <path
                d="M106 70C101 56 112 46 106 28"
                stroke="#e9a9a0"
                strokeOpacity="0.82"
                strokeWidth="3"
                strokeLinecap="round"
                className="steam-wisp-2"
              />
              <path
                d="M128 74C123 62 133 52 128 38"
                stroke="#f7ecdc"
                strokeOpacity="0.68"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="steam-wisp-3"
              />
            </g>

            {/* Saucer shadow & ceramic saucer */}
            <ellipse
              cx="106"
              cy="183"
              rx="68"
              ry="11"
              fill="#0f0602"
              fillOpacity="0.52"
            />
            <ellipse
              cx="106"
              cy="177"
              rx="62"
              ry="9.5"
              fill="#e4c29b"
            />
            <ellipse
              cx="106"
              cy="175.5"
              rx="48"
              ry="6"
              fill="#f7ecdc"
              fillOpacity="0.75"
            />

            {/* Ceramic Cup Handle */}
            <path
              d="M152 108C171 108 179 119 179 131.5C179 144.5 167 154 148 154"
              stroke="#f7ecdc"
              strokeWidth="9.5"
              strokeLinecap="round"
            />
            <path
              d="M153 108C170 108 177.5 118.5 177.5 131.5C177.5 143.5 166.5 152.5 149 152.5"
              stroke="#e4c29b"
              strokeOpacity="0.45"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Ceramic Cup Outer Shell */}
            <path
              d="M54 95H158L148.5 151C145.5 167 131.5 175 106 175C80.5 175 66.5 167 63.5 151L54 95Z"
              fill="#f7ecdc"
            />

            {/* Subtle ceramic shading on right edge */}
            <path
              d="M132 95H158L148.5 151C145.5 166 132 174 111 174.8C128 172 138 164 140.5 150L148 95H132Z"
              fill="#e4c29b"
              fillOpacity="0.38"
            />

            {/* Rising Poured Espresso Visible Through Cutaway Window on Sleeve */}
            <g clipPath={`url(#cup-interior-${pourKey})`}>
              <g className="coffee-liquid-rise">
                <rect
                  x="54"
                  y="96"
                  width="104"
                  height="80"
                  fill={`url(#coffee-fill-${pourKey})`}
                />
                {/* Crema foam wave band */}
                <path
                  d="M46 102Q66 96 86 102T126 102T166 102V112H46V102Z"
                  fill="#e4c29b"
                  fillOpacity="0.55"
                  className="coffee-surface-wave"
                />
              </g>
            </g>

            {/* Corrugated Kraft-Caramel Cup Sleeve Band */}
            <path
              d="M57.6 116H154.4L150.2 141H61.8L57.6 116Z"
              fill="#c98a4b"
            />
            <path
              d="M57.6 116H154.4L153.6 120.5H58.4L57.6 116Z"
              fill="#4a2a1a"
              fillOpacity="0.32"
            />
            <path
              d="M61 136.5H151L150.2 141H61.8L61 136.5Z"
              fill="#4a2a1a"
              fillOpacity="0.32"
            />

            {/* Sleeve Heart Emblem */}
            <path
              d="M106 135.2C106 135.2 96.5 129.1 96.5 123.9C96.5 121.3 98.6 119.4 101.1 119.4C103.2 119.4 104.9 120.7 106 122.3C107.1 120.7 108.8 119.4 110.9 119.4C113.4 119.4 115.5 121.3 115.5 123.9C115.5 129.1 106 135.2 106 135.2Z"
              fill="#f7ecdc"
            />

            {/* Cup Rim & Crema Top Surface */}
            <ellipse cx="106" cy="95" rx="52" ry="11.5" fill="#e4c29b" />
            <ellipse cx="106" cy="95.5" rx="46.5" ry="8.8" fill="#4a2a1a" />
            <ellipse
              cx="106"
              cy="96"
              rx="41"
              ry="6.8"
              fill="#7a4321"
              fillOpacity="0.85"
            />

            {/* Blooming Latte-Art Heart on Crema Top */}
            <g className="latte-heart-bloom">
              <ellipse
                cx="106"
                cy="96"
                rx="34"
                ry="5.2"
                fill="#c98a4b"
                fillOpacity="0.55"
              />
              <path
                d="M106 100.3C106 100.3 98 97.2 98 94.6C98 93.3 99.6 92.4 101.6 92.4C103.5 92.4 105.1 93.1 106 94C106.9 93.1 108.5 92.4 110.4 92.4C112.4 92.4 114 93.3 114 94.6C114 97.2 106 100.3 106 100.3Z"
                fill="#f7ecdc"
              />
            </g>

            {/* Silky Live Espresso Stream Pouring into Cup */}
            <path
              d="M102.5 8C102.5 8 103.2 58 103.8 97H108.4C109 58 109.7 8 109.7 8H102.5Z"
              fill={`url(#stream-grad-${pourKey})`}
              className="coffee-pour-stream"
            />

            {/* Subtle Espresso Splash Droplets on Pour Impact */}
            <circle
              cx="98"
              cy="92"
              r="2.6"
              fill="#e4c29b"
              className="coffee-splash-drop"
              style={
                {
                  '--drop-x': '-10px',
                  '--drop-x2': '-16px',
                } as CSSProperties
              }
            />
            <circle
              cx="114"
              cy="91"
              r="2.2"
              fill="#c98a4b"
              className="coffee-splash-drop"
              style={
                {
                  '--drop-x': '11px',
                  '--drop-x2': '17px',
                  animationDelay: '0.16s',
                } as CSSProperties
              }
            />
          </svg>
        </button>

        {/* Event Title & Welcome Copy */}
        <h1 className="mt-2 text-2xl sm:text-4xl font-semibold tracking-tight text-[#f7ecdc] [text-wrap:balance]">
          {eventSummary.settings.title}
        </h1>
        <p className="mt-1.5 text-sm sm:text-base italic text-[#e9a9a0]">
          Mommy, let&apos;s make some coffee memories! 🤍
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs sm:text-sm leading-relaxed text-[#d9b99b]/95 [text-wrap:balance]">
          We are excited to have you join us for a{' '}
          <span className="font-semibold tracking-wide text-[#f7ecdc]">
            RENDEZVOUS WITH {eventSummary.settings.specialGuest.toUpperCase()}
          </span>
        </p>

        {/* Clean Unboxed Event Metadata Strip */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#e4c29b]/90 tabular-nums">
          <span>{eventSummary.settings.eventDate}</span>
          <span aria-hidden="true">·</span>
          <span>{eventSummary.settings.eventTime}</span>
          <span aria-hidden="true">·</span>
          <span>{eventSummary.settings.venueName}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              eventSummary.isFull
                ? 'font-medium text-[#e9a9a0]'
                : 'font-medium text-[#f7ecdc]'
            }
          >
            {eventSummary.isFull
              ? 'Seats full – join waitlist'
              : `Seats left: ${eventSummary.seatsLeft}`}
          </span>
        </div>

        {/* Primary CTA Button */}
        <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={handleStart}
            className={`group flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#f7ecdc] px-6 py-3.5 text-base font-semibold text-[#241209] shadow-[0_18px_40px_-10px_rgba(0,0,0,0.65)] transition-all duration-300 hover:bg-[#fff6e9] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] ${
              brewed ? 'ring-2 ring-[#c98a4b]/60' : ''
            }`}
          >
            <Coffee className="h-4.5 w-4.5 text-[#8b4c24]" />
            <span>Start My RSVP</span>
            <ArrowRight className="h-4 w-4 text-[#4a2a1a] transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={onOpenPoster}
            className="inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#e4c29b]/85 underline decoration-[#c98a4b]/50 underline-offset-4 transition-colors hover:text-[#f7ecdc] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c98a4b]"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Official Invite</span>
          </button>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="mx-auto flex w-full max-w-4xl items-center justify-between pt-2 text-[11px] text-[#d9b99b]/60">
        <span>Tap the cup to pour again</span>
        <button
          type="button"
          onClick={onOpenAdmin}
          className="min-h-[36px] px-2 underline-offset-4 hover:text-[#f7ecdc] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c98a4b]"
        >
          Organizer Admin
        </button>
      </footer>
    </div>
  );
}
