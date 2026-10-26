import React, { useState, useEffect, useRef, useId } from 'react';
import '../css/HeartFavoriteButton.css';

/**
 * Reusable animated heart button with burst celebration particles
 * Inspired by UIVerse / CSS animated heart checkbox
 */
const HeartFavoriteButton = ({
  checked = false,
  onChange,
  size = 38,
  color = 'rgb(255, 91, 137)',
  outlineColor = 'rgba(255, 255, 255, 0.7)',
  title = '',
  disabled = false,
  className = '',
  style = {},
  id,
}) => {
  const [animating, setAnimating] = useState(false);
  const prevCheckedRef = useRef(checked);
  const reactId = useId();
  const elementId = id || `heart-fav-${reactId}`;

  useEffect(() => {
    // Khi chuyển trạng thái từ false -> true, kích hoạt hiệu ứng văng pháo hoa celebrate
    if (!prevCheckedRef.current && checked) {
      const startTimer = setTimeout(() => setAnimating(true), 0);
      const endTimer = setTimeout(() => setAnimating(false), 600);
      prevCheckedRef.current = checked;
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
    prevCheckedRef.current = checked;
  }, [checked]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div
      className={`heart-container ${checked ? 'is-active' : ''} ${animating ? 'is-celebrating' : ''} ${className}`}
      title={title || (checked ? 'Bỏ yêu thích' : 'Yêu thích')}
      style={{
        '--heart-color': color,
        '--heart-outline-color': outlineColor,
        '--heart-size': `${size}px`,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
      onClick={handleClick}
    >
      <input
        type="checkbox"
        className="checkbox"
        id={elementId}
        checked={checked}
        onChange={handleClick}
        disabled={disabled}
        aria-label={title || 'Yêu thích'}
      />
      <div className="svg-container">
        <svg viewBox="0 0 24 24" className="svg-outline" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Zm-3.585,18.4a2.973,2.973,0,0,1-3.83,0C4.947,16.006,2,11.87,2,8.967a4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,11,8.967a1,1,0,0,0,2,0,4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,22,8.967C22,11.87,19.053,16.006,13.915,20.313Z" />
        </svg>

        <svg viewBox="0 0 24 24" className="svg-filled" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Z" />
        </svg>

        <svg className="svg-celebrate" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="10,10 20,20" />
          <polygon points="10,50 20,50" />
          <polygon points="20,80 30,70" />
          <polygon points="90,10 80,20" />
          <polygon points="90,50 80,50" />
          <polygon points="80,80 70,70" />
        </svg>
      </div>
    </div>
  );
};

export default HeartFavoriteButton;
