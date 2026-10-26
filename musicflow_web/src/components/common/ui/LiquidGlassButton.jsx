import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import '../css/LiquidGlassButton.css';

export default function LiquidGlassButton({
  isFollowing = false,
  loading = false,
  onClick,
  idleLabel,
  followingLabel = 'Đã quan tâm',
  notFollowingLabel = 'Quan tâm',
  followingSuccessLabel = 'Đã quan tâm',
  unfollowingSuccessLabel = 'Đã bỏ quan tâm',
  successLabel,
  icon,
  size = 'compact',
  disabled = false,
  className = '',
  style = {},
  ariaLabel,
}) {
  const [internalState, setInternalState] = useState('idle'); // 'idle' | 'load' | 'ok'
  const [liveText, setLiveText] = useState('');
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const magRef = useRef(null);
  const timerRef = useRef(null);
  const isReducedMotion = useRef(false);
  const isFollowingRef = useRef(isFollowing);

  useEffect(() => {
    isFollowingRef.current = isFollowing;
  }, [isFollowing]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotion.current = mq.matches;
    const handler = (e) => {
      isReducedMotion.current = e.matches;
    };
    mq.addEventListener?.('change', handler);
    return () => {
      mq.removeEventListener?.('change', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (isReducedMotion.current || !btnRef.current || !magRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    const pull = Math.max(0, 1 - dist / 190);

    magRef.current.style.translate = `${(dx * 0.18 * pull).toFixed(1)}px ${(dy * 0.18 * pull).toFixed(1)}px`;
    btnRef.current.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    btnRef.current.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (magRef.current) {
      magRef.current.style.translate = '0px 0px';
    }
  }, []);

  // Compute effective visual state: 'load', 'ok', or 'idle'
  const effectiveState = internalState !== 'idle' ? internalState : (loading ? 'load' : 'idle');

  const handleClick = async (e) => {
    if (effectiveState === 'load' || disabled || loading) return;

    if (onClick) {
      try {
        setInternalState('load');
        setLiveText('Đang xử lý...');

        const resultPromise = onClick(e);
        if (resultPromise && typeof resultPromise.then === 'function') {
          const result = await resultPromise;
          // If the onClick returned boolean false (e.g. login prompt shown or failed), revert to idle
          if (result === false) {
            setInternalState('idle');
            setLiveText('');
            return;
          }
        }

        setInternalState('ok');
        const computedSuccessLabel = successLabel || (isFollowingRef.current ? followingSuccessLabel : unfollowingSuccessLabel);
        setLiveText(computedSuccessLabel);

        timerRef.current = setTimeout(() => {
          setInternalState('idle');
          setLiveText('');
        }, isReducedMotion.current ? 300 : 1800);
      } catch {
        setInternalState('idle');
        setLiveText('');
      }
    }
  };

  const currentIdleLabel = idleLabel || (isFollowing ? followingLabel : notFollowingLabel);
  const currentSuccessLabel = successLabel || (isFollowing ? followingSuccessLabel : unfollowingSuccessLabel);

  return (
    <div
      ref={rootRef}
      className={`ux-u001-scope u001 u001--${size} ${className}`}
      data-state={effectiveState}
      data-following={isFollowing ? 'true' : 'false'}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Background ambient liquid refraction blobs */}
      <div className="u001-blobs" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      {/* Magnetic translation wrapper */}
      <div ref={magRef} className="u001-mag">
        <div className="u001-float">
          <button
            ref={btnRef}
            className="u001-btn"
            type="button"
            disabled={disabled}
            aria-busy={effectiveState === 'load'}
            aria-pressed={isFollowing}
            aria-label={ariaLabel || currentIdleLabel}
            onClick={handleClick}
          >
            {/* Dynamic specular light reflection sheen */}
            <span className="u001-sheen" aria-hidden="true" />

            {/* Idle state label & icon */}
            <span className="u001-txt">
              {icon && <span className="u001-icon" aria-hidden="true">{icon}</span>}
              <span>{currentIdleLabel}</span>
            </span>

            {/* Water drop loading spinner */}
            <span className="u001-spin" aria-hidden="true">
              <svg viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="10" />
              </svg>
            </span>

            {/* Success state checkmark check & label */}
            <span className="u001-done" aria-hidden="true">
              <b>
                <svg viewBox="0 0 16 16">
                  <path d="M3.5 8.4l3 3 6-6.4" />
                </svg>
              </b>
              <span>{currentSuccessLabel}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Screen-reader live polite updates */}
      <span className="u001-live" aria-live="polite">
        {liveText}
      </span>
    </div>
  );
}

LiquidGlassButton.propTypes = {
  isFollowing: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  idleLabel: PropTypes.string,
  followingLabel: PropTypes.string,
  notFollowingLabel: PropTypes.string,
  followingSuccessLabel: PropTypes.string,
  unfollowingSuccessLabel: PropTypes.string,
  successLabel: PropTypes.string,
  icon: PropTypes.node,
  size: PropTypes.oneOf(['compact', 'regular']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
  ariaLabel: PropTypes.string,
};
