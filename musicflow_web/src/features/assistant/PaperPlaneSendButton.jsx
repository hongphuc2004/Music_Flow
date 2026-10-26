import React, { useState, useRef, useImperativeHandle, forwardRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

export const PaperPlaneSendButton = forwardRef(function PaperPlaneSendButton(
  {
    onSend,
    disabled = false,
    rootRef,
    hasContent = false,
    onEmptyTrigger,
    className = '',
  },
  ref
) {
  const [btnState, setBtnState] = useState('idle');
  const [isBusy, setIsBusy] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [skyContainer, setSkyContainer] = useState(null);
  const buttonRef = useRef(null);
  const skySvgRef = useRef(null);
  const maskPathRef = useRef(null);
  const trailPathRef = useRef(null);
  const generatedId = useId();
  const maskId = `u005-m-${generatedId.replace(/:/g, '')}`;

  useEffect(() => {
    if (rootRef?.current) {
      setSkyContainer(rootRef.current);
    }
  }, [rootRef]);

  const calculateRoute = () => {
    if (!buttonRef.current || !rootRef?.current) return '';
    const b = buttonRef.current.getBoundingClientRect();
    const r = rootRef.current.getBoundingClientRect();
    const k = rootRef.current.offsetWidth / (r.width || 1);
    const x = (b.left - r.left + b.width / 2) * k;
    const y = (b.top - r.top + b.height / 2) * k;

    return (
      `M${x} ${y} ` +
      `C${x - 30} ${y - 60} ${x - 150} ${y - 70} ${x - 150} ${y - 140} ` +
      `C${x - 150} ${y - 205} ${x - 70} ${y - 215} ${x - 60} ${y - 165} ` +
      `C${x - 50} ${y - 120} ${x - 125} ${y - 110} ${x - 120} ${y - 170} ` +
      `C${x - 115} ${y - 235} ${x - 10} ${y - 280} ${x + 90} ${y - 330}`
    );
  };

  const triggerSend = () => {
    if (isBusy || disabled) return;

    if (!hasContent) {
      onEmptyTrigger?.();
      return;
    }

    setIsBusy(true);

    const rm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = rm ? 0 : 1500;

    // Fire the message immediately so it rises into the chat
    onSend?.();

    const d = calculateRoute();
    setFlightData({ d, maskId });

    setBtnState('fly');

    const rootEl = rootRef?.current;
    let fp = null;

    if (!rm && rootEl && d) {
      // Create flying plane DOM node inside chat container
      fp = document.createElement('div');
      fp.className = 'u005-fp';
      fp.innerHTML = `
        <svg viewBox="0 0 28 24" style="width:100%;height:100%">
          <path d="M1 3 27 12 10 13Z" fill="#fff"/>
          <path d="M10 13 27 12 6 22Z" fill="#D8E0FF"/>
          <path d="M10 13 27 12 12.5 17Z" fill="#A3B4FF"/>
          <path d="M1 3 27 12 10 13Z" fill="none" stroke="#7B61FF" stroke-width=".8" stroke-linejoin="round"/>
          <path d="M10 13 27 12 6 22Z" fill="none" stroke="#7B61FF" stroke-width=".8" stroke-linejoin="round"/>
        </svg>
      `;
      rootEl.appendChild(fp);

      const canPath = typeof window !== 'undefined' && window.CSS && CSS.supports && CSS.supports('offset-path', 'path("M0 0L1 1")');
      const ease = 'cubic-bezier(.45, 0, .3, 1)';

      if (canPath && fp.animate) {
        fp.style.offsetPath = `path("${d}")`;
        fp.style.offsetRotate = 'auto';
        fp.animate(
          [
            { offsetDistance: '0%', transform: 'scale(.75)' },
            { offsetDistance: '35%', transform: 'scale(1.25)', offset: 0.35 },
            { offsetDistance: '100%', transform: 'scale(.7)' },
          ],
          { duration: dur, easing: ease, fill: 'forwards' }
        );
      } else if (fp.animate) {
        const p = d.split(/[ MC]+/).filter(Boolean).map(Number);
        fp.animate(
          [
            { transform: `translate(${p[0] - 17}px, ${p[1] - 15}px)` },
            { transform: `translate(${p[p.length - 2] - 17}px, ${p[p.length - 1] - 15}px) rotate(-40deg)` },
          ],
          { duration: dur, easing: ease, fill: 'forwards' }
        );
      }

      // Animate trail mask revealing the dotted line
      if (maskPathRef.current?.animate) {
        maskPathRef.current.animate(
          [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
          { duration: dur, easing: ease, fill: 'forwards' }
        );
      }

      setTimeout(() => {
        if (fp && fp.parentNode) {
          fp.remove();
        }
        if (trailPathRef.current) {
          trailPathRef.current.style.opacity = '0';
        }
      }, dur + 80);
    }

    // Step 2: Plane completes flight -> Success Checkmark
    setTimeout(() => {
      setBtnState('done');
    }, dur ? dur - 100 : 0);

    // Step 3: New plane glides back into button
    setTimeout(() => {
      setBtnState('back');
      setIsBusy(false);
      setFlightData(null);
    }, rm ? 0 : dur + 900);

    // Step 4: Reset back to idle resting state
    setTimeout(() => {
      setBtnState('idle');
    }, rm ? 0 : dur + 1500);
  };

  useImperativeHandle(ref, () => ({
    triggerSend,
    isBusy,
  }));

  // Render sky overlay portal into skyContainer so it spans the entire chat panel
  const renderSkyPortal = () => {
    if (!skyContainer || !flightData?.d) return null;

    return createPortal(
      <svg
        ref={skySvgRef}
        className="u005-sky"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: 40,
        }}
      >
        <defs>
          <mask
            id={flightData.maskId}
            maskUnits="userSpaceOnUse"
            x="-100"
            y="-200"
            width="2000"
            height="2000"
          >
            <path
              ref={maskPathRef}
              className="u005-mk"
              d={flightData.d}
              fill="none"
              stroke="#fff"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength="1"
              strokeDasharray="1 1"
              strokeDashoffset="1"
            />
          </mask>
        </defs>
        <path
          ref={trailPathRef}
          className="u005-tr"
          d={flightData.d}
          mask={`url(#${flightData.maskId})`}
        />
      </svg>,
      skyContainer
    );
  };

  return (
    <>
      <style>{`
        /* Lucian UX/UI Prompt #005 Scoped Styles */
        .u005-btn {
          position: relative;
          flex: none;
          width: 36px;
          height: 36px;
          border: 0;
          padding: 0;
          border-radius: 50%;
          background: linear-gradient(140deg, #7B61FF, #3D8BFF);
          box-shadow: 0 4px 14px -3px rgba(106, 87, 242, 0.5);
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #ffffff;
          transition: transform .35s cubic-bezier(.34, 1.45, .64, 1), background .35s, box-shadow .35s, opacity .2s;
        }
        .u005-btn:hover:not(:disabled) {
          transform: scale(1.08);
          box-shadow: 0 6px 18px -3px rgba(106, 87, 242, 0.65);
        }
        .u005-btn:active:not(:disabled) {
          transform: scale(.92);
        }
        .u005-btn:disabled {
          opacity: 0.45;
          cursor: default;
          box-shadow: none;
        }
        .u005-btn:focus-visible {
          outline: 2px solid #7B61FF;
          outline-offset: 2px;
        }
        .u005-pl {
          width: 19px;
          height: 17px;
          transform: translate(-1px, 1px) rotate(-18deg);
          transition: transform .45s cubic-bezier(.34, 1.45, .64, 1), opacity .2s;
          pointer-events: none;
        }
        .u005-btn.fly .u005-pl {
          opacity: 0;
          transform: translate(10px, -10px) rotate(-30deg) scale(.6);
          transition: none;
        }
        .u005-btn.back .u005-pl {
          animation: u005-back .6s cubic-bezier(.2, 1.2, .4, 1) both;
        }
        @keyframes u005-back {
          from {
            opacity: 0;
            transform: translate(-26px, 14px) rotate(10deg) scale(.7);
          }
        }
        .u005-rg {
          position: absolute;
          inset: -4px;
          width: 44px;
          height: 44px;
          transform: rotate(-90deg);
          opacity: 0;
          pointer-events: none;
          transition: opacity .2s;
        }
        .u005-rg circle {
          fill: none;
          stroke: #7B61FF;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-dasharray: 145;
          stroke-dashoffset: 145;
        }
        .u005-btn.fly .u005-rg {
          opacity: 1;
        }
        .u005-btn.fly .u005-rg circle {
          transition: stroke-dashoffset 1.4s cubic-bezier(.4, 0, .3, 1);
          stroke-dashoffset: 0;
        }
        .u005-ck {
          position: absolute;
          width: 18px;
          height: 18px;
          fill: none;
          stroke: #ffffff;
          stroke-width: 2.6;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          opacity: 0;
          pointer-events: none;
        }
        .u005-btn.done {
          background: linear-gradient(140deg, #37B24D, #20C997) !important;
          box-shadow: 0 4px 16px -2px rgba(55, 178, 77, 0.65) !important;
        }
        .u005-btn.done .u005-ck {
          opacity: 1;
          stroke-dashoffset: 0;
          transition: stroke-dashoffset .35s .05s;
        }
        .u005-btn.done .u005-pl {
          opacity: 0;
        }
        .u005-tr {
          fill: none;
          stroke: #7B61FF;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-dasharray: 2 6;
          opacity: .75;
          transition: opacity .6s;
        }
        .u005-fp {
          position: absolute;
          left: 0;
          top: 0;
          width: 32px;
          height: 28px;
          margin: 0;
          pointer-events: none;
          z-index: 45;
          filter: drop-shadow(0 6px 8px rgba(106, 87, 242, 0.4));
        }
        .u005-shake {
          animation: u005-sh .4s ease;
        }
        @keyframes u005-sh {
          25% { transform: translateX(-6px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .u005-btn.back .u005-pl { animation: none !important; }
          .u005-btn.fly .u005-rg circle { transition: none !important; }
          .u005-shake { animation: none !important; }
        }
      `}</style>

      {renderSkyPortal()}

      <button
        ref={buttonRef}
        type="button"
        aria-label="Gửi tin nhắn (Enter)"
        disabled={disabled}
        onClick={triggerSend}
        className={`u005-btn ${btnState !== 'idle' ? btnState : ''} ${className}`}
      >
        {/* Progress Circular Ring */}
        <svg className="u005-rg" viewBox="0 0 50 50" aria-hidden="true">
          <circle cx="25" cy="25" r="23" />
        </svg>

        {/* Resting / Flying Return Paper Plane */}
        <svg className="u005-pl" viewBox="0 0 28 24" aria-hidden="true">
          <path d="M1 3 27 12 10 13Z" fill="#fff" />
          <path d="M10 13 27 12 6 22Z" fill="#D8E0FF" />
          <path d="M10 13 27 12 12.5 17Z" fill="#A3B4FF" />
        </svg>

        {/* Success Checkmark */}
        <svg className="u005-ck" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 10.5 8.3 14.5 16 6" />
        </svg>
      </button>
    </>
  );
});

PaperPlaneSendButton.propTypes = {
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  rootRef: PropTypes.shape({ current: PropTypes.any }),
  hasContent: PropTypes.bool,
  onEmptyTrigger: PropTypes.func,
  className: PropTypes.string,
};
