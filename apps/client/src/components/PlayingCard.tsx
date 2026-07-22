import { motion } from 'framer-motion';
import type { Rank, Suit } from '@twenty-nine/core';
import { isRedSuit, suitSymbol } from '@twenty-nine/core';

export type CardSizeToken = 'sm' | 'md' | 'lg' | 'xl';

interface PlayingCardProps {
  suit: Suit;
  rank: Rank;
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  /** Named size token, ignored when `width` is set. */
  size?: CardSizeToken;
  /** Explicit width in px; height follows standard card aspect (5:7). */
  width?: number;
  onClick?: () => void;
  onDragEnd?: () => void;
  draggable?: boolean;
}

const SIZE_WIDTH: Record<CardSizeToken, number> = {
  sm: 44,
  md: 72,
  lg: 88,
  xl: 100,
};

/** Poker-ish aspect ratio (width:height ≈ 5:7). */
export function cardHeightForWidth(w: number): number {
  return Math.round(w * 1.4);
}

export function resolveCardWidth(size: CardSizeToken = 'md', width?: number): number {
  return width ?? SIZE_WIDTH[size];
}

export function PlayingCard({
  suit,
  rank,
  selected,
  disabled,
  faceDown,
  size = 'md',
  width,
  onClick,
  onDragEnd,
  draggable,
}: PlayingCardProps) {
  const w = resolveCardWidth(size, width);
  const h = cardHeightForWidth(w);
  const font = Math.max(11, Math.round(w * 0.22));
  const inset = Math.max(6, Math.round(w * 0.1));
  const rx = Math.max(6, Math.round(w * 0.1));
  const red = !faceDown && isRedSuit(suit);
  const label = rank === '10' ? '10' : rank;
  const ink = red ? '#b33a3a' : '#1a1a14';
  const backId = `back-${suit}-${rank}-${Math.round(w)}`;

  return (
    <motion.button
      type="button"
      aria-label={faceDown ? 'Face-down card' : `${rank} of ${suit}`}
      disabled={disabled || faceDown}
      onClick={onClick}
      drag={draggable && !disabled ? 'y' : false}
      dragConstraints={{ top: -Math.round(h * 0.85), bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y < -50) onDragEnd?.();
      }}
      whileHover={disabled || faceDown ? undefined : { y: -Math.round(h * 0.12), scale: 1.04 }}
      whileTap={disabled || faceDown ? undefined : { scale: 0.97 }}
      animate={{ y: selected ? -Math.round(h * 0.14) : 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={`card-shadow relative rounded-[10px] border select-none focus:outline-none will-change-transform overflow-visible ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${selected ? 'ring-2 ring-gold' : ''}`}
      style={{ width: w, height: h }}
    >
      {faceDown ? (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible">
          <defs>
            <pattern id={backId} width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 8L8 0" stroke="#2a5080" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={w} height={h} rx={rx} fill="#1e3a5f" />
          <rect
            x={4}
            y={4}
            width={w - 8}
            height={h - 8}
            rx={rx - 2}
            fill="none"
            stroke="#c9a227"
            strokeWidth="2"
          />
          <rect
            x={8}
            y={8}
            width={w - 16}
            height={h - 16}
            rx={Math.max(2, rx - 4)}
            fill={`url(#${backId})`}
          />
          <text
            x="50%"
            y="54%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#c9a227"
            fontSize={font}
            fontFamily="Fraunces, serif"
          >
            29
          </text>
        </svg>
      ) : (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible">
          <rect width={w} height={h} rx={rx} fill="#f3efe6" stroke="#d4cbb8" />

          {/* Top-left index — enough inset so rounded corner never clips "10" */}
          <g>
            <text
              x={inset}
              y={inset + font * 0.85}
              fill={ink}
              fontSize={font}
              fontWeight="700"
              fontFamily="Source Sans 3, sans-serif"
            >
              {label}
            </text>
            <text
              x={inset}
              y={inset + font * 1.95}
              fill={ink}
              fontSize={font}
              fontFamily="Source Sans 3, sans-serif"
            >
              {suitSymbol(suit)}
            </text>
          </g>

          {/* Center pip */}
          <text
            x="50%"
            y="52%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={ink}
            fontSize={font * 2.15}
          >
            {suitSymbol(suit)}
          </text>

          {/* Bottom-right: mirror of top-left (avoids rotate+textAnchor clipping) */}
          <g transform={`translate(${w}, ${h}) rotate(180)`}>
            <text
              x={inset}
              y={inset + font * 0.85}
              fill={ink}
              fontSize={font}
              fontWeight="700"
              fontFamily="Source Sans 3, sans-serif"
            >
              {label}
            </text>
            <text
              x={inset}
              y={inset + font * 1.95}
              fill={ink}
              fontSize={font}
              fontFamily="Source Sans 3, sans-serif"
            >
              {suitSymbol(suit)}
            </text>
          </g>
        </svg>
      )}
    </motion.button>
  );
}
