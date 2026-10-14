import { useEffect, useRef, useId } from 'react';
import '../css/MorphingPlayButton.css';

const PLAY_POLYGONS = [
  [[13, 8], [22.5, 13.6], [22.5, 26.4], [13, 32]],
  [[22.5, 13.6], [32, 20], [32, 20], [22.5, 26.4]],
];

const PAUSE_POLYGONS = [
  [[11, 9], [17, 9], [17, 31], [11, 31]],
  [[23, 9], [29, 9], [29, 31], [23, 31]],
];

function springEase(x) {
  return 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
}

function computePolygonPoints(shape, k) {
  return PLAY_POLYGONS[k]
    .map((p, j) => {
      const q = PAUSE_POLYGONS[k][j];
      const x = p[0] + (q[0] - p[0]) * shape;
      const y = p[1] + (q[1] - p[1]) * shape;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * MorphingPlayButton
 *
 * Smooth morphing Play/Pause button with:
 * - Spring polygon interpolation (Play <-> Pause)
 * - Pulsing halo aura on active playback
 * - Smooth circular progress arc
 * - Preserves existing MusicFlow system palette (#8c85ff, #6c63ff, #00e5ff)
 */
export default function MorphingPlayButton({
  isPlaying = false,
  onClick,
  progress = 0,
  showProgressRing = true,
  size = 50,
  buttonSize = 40,
  className = '',
  style = {},
  title = '',
  disabled = false,
}) {
  const leftPolyRef = useRef(null);
  const rightPolyRef = useRef(null);
  const shapeRef = useRef(isPlaying ? 1 : 0);
  const rafRef = useRef(null);
  const rawId = useId();
  const gradientId = `mf-play-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const ringRadius = 45;
  const circumference = 2 * Math.PI * ringRadius;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const dashOffset = circumference * (1 - safeProgress);

  // Function to apply points directly to DOM SVG elements for max performance
  const applyShape = (t) => {
    if (leftPolyRef.current) {
      leftPolyRef.current.setAttribute('points', computePolygonPoints(t, 0));
    }
    if (rightPolyRef.current) {
      rightPolyRef.current.setAttribute('points', computePolygonPoints(t, 1));
    }
  };

  useEffect(() => {
    const targetShape = isPlaying ? 1 : 0;
    if (Math.abs(shapeRef.current - targetShape) < 0.001) {
      applyShape(targetShape);
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      shapeRef.current = targetShape;
      applyShape(targetShape);
      return;
    }

    const startShape = shapeRef.current;
    const duration = 400; // ms
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = springEase(elapsed);
      const currentShape = startShape + (targetShape - startShape) * eased;
      shapeRef.current = currentShape;
      applyShape(currentShape);

      if (elapsed < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        shapeRef.current = targetShape;
        applyShape(targetShape);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying]);

  const outerSize = showProgressRing ? size : buttonSize;
  const iconSize = Math.round(buttonSize * 0.6);

  return (
    <div
      className={`mf-play-wrapper ${isPlaying ? 'is-playing' : ''} ${className}`}
      style={{
        width: outerSize,
        height: outerSize,
        ...style,
      }}
      title={title || (isPlaying ? 'Tạm dừng' : 'Phát nhạc')}
    >
      {showProgressRing && (
        <svg
          className="mf-play-ring"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8c85ff" />
              <stop offset="50%" stopColor="#6c63ff" />
              <stop offset="100%" stopColor="#00e5ff" />
            </linearGradient>
          </defs>
          <circle
            className="mf-play-track"
            cx="50"
            cy="50"
            r={ringRadius}
            strokeWidth="3"
          />
          <circle
            className="mf-play-arc"
            cx="50"
            cy="50"
            r={ringRadius}
            strokeWidth="3.5"
            stroke={`url(#${gradientId})`}
            strokeDasharray={circumference.toFixed(2)}
            strokeDashoffset={dashOffset.toFixed(2)}
          />
        </svg>
      )}

      {/* Pulsing halo ring */}
      <span className="mf-play-pulse" aria-hidden="true" />

      {/* Main button with morphing polygon icon */}
      <button
        type="button"
        className="mf-play-btn"
        onClick={onClick}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
        style={{
          width: buttonSize,
          height: buttonSize,
        }}
      >
        <svg
          viewBox="0 0 40 40"
          width={iconSize}
          height={iconSize}
          aria-hidden="true"
        >
          <polygon ref={leftPolyRef} points={computePolygonPoints(isPlaying ? 1 : 0, 0)} />
          <polygon ref={rightPolyRef} points={computePolygonPoints(isPlaying ? 1 : 0, 1)} />
        </svg>
      </button>
    </div>
  );
}
