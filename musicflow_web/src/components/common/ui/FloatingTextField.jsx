import { useState } from 'react';
import { TextField } from '@mui/material';

/**
 * FloatingTextField
 * - When empty & idle: label sits inside the input box, vertically centered with the icon.
 * - When hovered, focused, or has value: label smoothly floats up onto the top border notch.
 * - Clean transparent background, zero unwanted frames or outer boxes.
 */
export default function FloatingTextField({
  label,
  value = '',
  onChange,
  onFocus,
  onBlur,
  sx,
  InputProps,
  InputLabelProps,
  multiline,
  ...props
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const hasValue = Boolean(value && String(value).length > 0);
  const isFloated = hovered || focused || hasValue;

  const hasStartAdornment = Boolean(InputProps?.startAdornment);
  const idleTranslateX = hasStartAdornment ? '44px' : '16px';

  const idleTop = multiline ? '18px !important' : '50% !important';
  const idleTransform = multiline
    ? `translate(${idleTranslateX}, 0) scale(1) !important`
    : `translate(${idleTranslateX}, -50%) scale(1) !important`;

  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      multiline={multiline}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      InputLabelProps={{
        shrink: isFloated,
        ...InputLabelProps,
      }}
      InputProps={{
        notched: isFloated,
        ...InputProps,
      }}
      sx={{
        position: 'relative',
        '& .MuiOutlinedInput-root': {
          borderRadius: '16px',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '& input': {
            py: 1.6,
          },
          '& .MuiOutlinedInput-notchedOutline': {
            transition: 'border-color 0.25s ease',
          },
        },
        // Label inside input when idle - perfectly vertically centered with icon
        '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': {
          top: idleTop,
          transform: idleTransform,
          lineHeight: 1,
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.45)' : '#64748b',
          pointerEvents: 'none',
          transition:
            'top 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.22s cubic-bezier(0.4, 0, 0.2, 1), font-weight 0.22s ease',
          bgcolor: 'transparent !important',
          px: '0 !important',
          borderRadius: '0 !important',
          boxShadow: 'none !important',
          zIndex: 2,
        },
        // Label floated on top border when hovered, focused, or filled - purely transparent, zero frame/pill
        '& .MuiInputLabel-shrink': {
          top: '0 !important',
          transform: 'translate(14px, -9px) scale(0.75) !important',
          lineHeight: 1.2,
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.75)' : '#475569',
          bgcolor: 'transparent !important',
          px: '0 !important',
          borderRadius: '0 !important',
          boxShadow: 'none !important',
          fontWeight: 600,
          zIndex: 2,
          transition:
            'top 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.22s cubic-bezier(0.4, 0, 0.2, 1), font-weight 0.22s ease',
        },
        // Accent color when hovered
        '&:hover .MuiInputLabel-shrink': {
          color: '#6c63ff !important',
        },
        // Accent color when focused
        '& .Mui-focused.MuiInputLabel-shrink': {
          color: '#6c63ff !important',
          fontWeight: 700,
        },
        ...sx,
      }}
      {...props}
    />
  );
}
