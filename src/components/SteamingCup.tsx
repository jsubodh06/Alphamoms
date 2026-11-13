export function SteamingCup({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mx-auto flex items-center justify-center transition-transform duration-300 ${
        compact ? 'scale-75' : 'scale-100'
      }`}
      aria-hidden="true"
    >
      <svg
        width="76"
        height="72"
        viewBox="0 0 76 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Animated Steam Wisps */}
        <path
          d="M27 25C25 20.5 29.5 17 27.5 11.5"
          stroke="#f7ecdc"
          strokeOpacity="0.72"
          strokeWidth="2.1"
          strokeLinecap="round"
          className="steam-wisp-1"
        />
        <path
          d="M38 24C36 18.5 41 15 38.5 8.5"
          stroke="#e9a9a0"
          strokeOpacity="0.75"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="steam-wisp-2"
        />
        <path
          d="M49 25C47 20.5 51.5 17 49.5 12"
          stroke="#f7ecdc"
          strokeOpacity="0.68"
          strokeWidth="2.1"
          strokeLinecap="round"
          className="steam-wisp-3"
        />

        {/* Saucer */}
        <ellipse cx="38" cy="63.5" rx="26" ry="4.5" fill="#c98a4b" fillOpacity="0.35" />
        <ellipse cx="38" cy="61.5" rx="22" ry="3.5" fill="#e4c29b" />

        {/* Cup Handle */}
        <path
          d="M55 36.5C61.5 36.5 64.5 41 64.5 45.5C64.5 50.5 60 54 53.5 54"
          stroke="#f7ecdc"
          strokeWidth="3.8"
          strokeLinecap="round"
        />

        {/* Cup Body */}
        <path
          d="M19 33H57L53.5 52.5C52.5 57.5 47.5 60.5 38 60.5C28.5 60.5 23.5 57.5 22.5 52.5L19 33Z"
          fill="#f7ecdc"
        />
        {/* Cup Sleeve Band */}
        <path
          d="M20.4 40.5H55.6L54.1 49.5H21.9L20.4 40.5Z"
          fill="#c98a4b"
        />
        {/* Subtle Roast Heart on Sleeve */}
        <path
          d="M38 47.2C38 47.2 34.4 44.8 34.4 42.9C34.4 41.9 35.2 41.2 36.1 41.2C36.9 41.2 37.6 41.7 38 42.3C38.4 41.7 39.1 41.2 39.9 41.2C40.8 41.2 41.6 41.9 41.6 42.9C41.6 44.8 38 47.2 38 47.2Z"
          fill="#f7ecdc"
        />

        {/* Crema Rim */}
        <ellipse cx="38" cy="33" rx="19" ry="4" fill="#d9b99b" />
        <ellipse cx="38" cy="33.3" rx="16.2" ry="2.6" fill="#4a2a1a" />
      </svg>
    </div>
  );
}
