import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material';
import axios from 'axios';
import api, { setAccessToken, clearApiCache, API_BASE_URL } from '../../../services/api';
import { notifyClientSessionChanged } from '../../../hooks/useClientSession';
import { clearArtistSession, syncArtistSession } from '../../../utils/artistSession';
import useAppToast from '../../../components/common/js/useAppToast';

const SAVED_ACCOUNTS_KEY = 'musicflow_saved_accounts';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const MAX_SAVED_ACCOUNTS = 4;

const getSavedAccounts = () => {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(0, MAX_SAVED_ACCOUNTS) : [];
  } catch {
    return [];
  }
};

const GRADIENTS = [
  'linear-gradient(140deg, #8B6CFF, #5B8CFF)',
  'linear-gradient(140deg, #06B6D4, #3B82F6)',
  'linear-gradient(140deg, #EC4899, #F43F5E)',
  'linear-gradient(140deg, #10B981, #059669)',
  'linear-gradient(140deg, #F59E0B, #D97706)',
];

export function AccountSwitcherMenu({
  userName = 'Listener',
  userEmail = '',
  userAvatar = '',
  userRole = 'user',
  collapsed = false,
  onLogout = () => {},
  onNavigate = () => {},
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState(getSavedAccounts);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0, width: 228 });
  const [switchingTarget, setSwitchingTarget] = useState(null);
  const { showToast } = useAppToast();

  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const chipRef = useRef(null);
  const chipWsRef = useRef(null);

  const activeEmail =
    userEmail ||
    (userRole === 'artist' ? localStorage.getItem('artistEmail') : '') ||
    localStorage.getItem('email') ||
    '';

  // Calculate position anchored to the chip
  useEffect(() => {
    if (!isOpen || !chipRef.current) return;

    const updatePos = () => {
      if (!chipRef.current) return;
      const rect = chipRef.current.getBoundingClientRect();
      if (collapsed) {
        setMenuPos({
          bottom: Math.max(16, window.innerHeight - rect.bottom),
          left: rect.right + 12,
          width: 250,
        });
      } else {
        setMenuPos({
          bottom: Math.max(16, window.innerHeight - rect.top + 8),
          left: rect.left,
          width: rect.width,
        });
      }
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);

    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isOpen, collapsed]);

  // Synchronize current logged-in account into saved accounts storage
  useEffect(() => {
    const currentEmail =
      userEmail ||
      (userRole === 'artist' ? localStorage.getItem('artistEmail') : '') ||
      localStorage.getItem('email') ||
      '';
    if (!currentEmail) return;

    const list = getSavedAccounts();
    const existingIndex = list.findIndex((acc) => acc.email === currentEmail);
    const currentToken = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    const currentRefreshToken = localStorage.getItem('refreshToken') || '';

    const currentAccData = {
      id: (userRole === 'artist' ? localStorage.getItem('artistId') : localStorage.getItem('userId')) || '',
      name:
        userName ||
        (userRole === 'artist' ? localStorage.getItem('artistName') : localStorage.getItem('userName')) ||
        (userRole === 'artist' ? 'Nghệ sĩ' : 'Listener'),
      email: currentEmail,
      avatar:
        userAvatar ||
        (userRole === 'artist' ? localStorage.getItem('artistAvatar') : localStorage.getItem('userAvatar')) ||
        '',
      role: userRole || localStorage.getItem('role') || 'user',
      token: currentToken,
      refreshToken: currentRefreshToken || (existingIndex >= 0 ? list[existingIndex].refreshToken : ''),
      gradient: existingIndex >= 0 ? list[existingIndex].gradient : GRADIENTS[list.length % GRADIENTS.length],
    };

    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...list];
      updatedList[existingIndex] = { ...updatedList[existingIndex], ...currentAccData };
    } else {
      updatedList = [currentAccData, ...list].slice(0, MAX_SAVED_ACCOUNTS);
    }

    setSavedAccounts(updatedList);
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updatedList));
    } catch {
      // ignore
    }
  }, [userName, userEmail, userAvatar, userRole]);

  // Highlight bar tracking
  const handleItemHover = (e) => {
    const it = e.currentTarget;
    const list = it.closest('.u037-list');
    if (!list || !menuRef.current) return;

    const allLists = menuRef.current.querySelectorAll('.u037-list');
    allLists.forEach((l) => {
      if (l !== list) l.classList.remove('is-hl');
    });

    const bar = list.querySelector('.u037-hl');
    if (bar && it.parentNode) {
      bar.style.setProperty('--y', `${it.parentNode.offsetTop}px`);
      bar.style.setProperty('--h', `${it.offsetHeight}px`);
      list.classList.add('is-hl');
    }
  };

  const handleMenuMouseLeave = () => {
    if (!menuRef.current) return;
    const allLists = menuRef.current.querySelectorAll('.u037-list');
    allLists.forEach((l) => l.classList.remove('is-hl'));
  };

  // Re-authenticate specific Google account if token/session is expired
  const reAuthViaGoogle = (targetAcc) => {
    if (!GOOGLE_CLIENT_ID) {
      alert('Chưa cấu hình Google Client ID.');
      setSwitchingTarget(null);
      return;
    }

    const runOAuth = () => {
      if (!window.google?.accounts?.oauth2) {
        alert(`Phiên đăng nhập của tài khoản ${targetAcc.email} đã hết hạn. Vui lòng đăng nhập lại Google.`);
        setSwitchingTarget(null);
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        hint: targetAcc.email,
        callback: async (response) => {
          if (response?.access_token) {
            try {
              const res = await api.post('/auth/google', {
                credential: response.access_token,
                tokenType: 'access_token',
              });
              const { token, refreshToken, user } = res.data;

              const updatedAcc = {
                ...targetAcc,
                id: user._id || '',
                name: user.name || targetAcc.name,
                email: user.email || targetAcc.email,
                avatar: user.avatar || targetAcc.avatar,
                role: user.role || targetAcc.role || 'user',
                token,
                refreshToken: refreshToken || '',
              };

              const list = getSavedAccounts();
              const existingIdx = list.findIndex((a) => a.email === updatedAcc.email);
              const updated = existingIdx >= 0
                ? list.map((a) => (a.email === updatedAcc.email ? updatedAcc : a))
                : [updatedAcc, ...list];
              setSavedAccounts(updated);
              localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));

              setAccessToken(token);
              localStorage.setItem('accessToken', token);
              localStorage.setItem('token', token);
              if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
              localStorage.setItem('role', user.role || 'user');
              localStorage.setItem('userName', user.name || 'Listener');
              localStorage.setItem('email', user.email || '');
              localStorage.setItem('userId', user._id || '');
              if (user.avatar) localStorage.setItem('userAvatar', user.avatar);

              if (user.role === 'artist') {
                syncArtistSession(user);
              } else {
                clearArtistSession();
              }

              clearApiCache();
              notifyClientSessionChanged();

              setTimeout(() => {
                if (user.role === 'artist' && !window.location.pathname.startsWith('/artist')) {
                  window.location.href = '/artist/dashboard';
                } else if (user.role !== 'artist' && window.location.pathname.startsWith('/artist')) {
                  window.location.href = '/';
                } else {
                  window.location.reload();
                }
              }, 700);
            } catch (e) {
              alert(e.response?.data?.message || 'Đăng nhập Google thất bại');
              setSwitchingTarget(null);
            }
          } else {
            setSwitchingTarget(null);
          }
        },
        error_callback: () => {
          setSwitchingTarget(null);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account', hint: targetAcc.email });
    };

    if (window.google?.accounts?.oauth2) {
      runOAuth();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = runOAuth;
      document.head.appendChild(script);
    }
  };

  // Switch to another saved Google / Listener account with authentic backend session refresh
  const handleSwitchAccount = async (acc) => {
    if (acc.email === activeEmail) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setSwitchingTarget(acc);

    try {
      let freshToken = acc.token;
      let freshRefreshToken = acc.refreshToken;
      let userObj = null;
      let targetRole = acc.role || 'user';
      let isArtist = targetRole === 'artist';

      // 1. Nếu có refreshToken, gọi API refresh để backend xác thực, cấp token mới và set Cookie HTTP-Only cho đúng tài khoản
      if (acc.refreshToken) {
        try {
          const refreshRes = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken: acc.refreshToken },
            { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
          );
          if (refreshRes.data?.success) {
            freshToken = refreshRes.data.token;
            freshRefreshToken = refreshRes.data.refreshToken || acc.refreshToken;
            userObj = refreshRes.data.user;
            if (refreshRes.data.isArtist) {
              targetRole = 'artist';
              isArtist = true;
            } else if (userObj?.role) {
              targetRole = userObj.role;
            }
          }
        } catch (err) {
          console.warn('Switch session via refresh token failed:', err);
          // Phiên refresh token hết hạn trên server -> re-auth qua Google
          reAuthViaGoogle(acc);
          return;
        }
      } else {
        // Tài khoản lưu cũ chưa có refreshToken -> re-auth qua Google để lấy token & cookie hợp lệ
        reAuthViaGoogle(acc);
        return;
      }

      // 2. Cập nhật localStorage và in-memory token
      setAccessToken(freshToken);
      if (freshToken) {
        localStorage.setItem('accessToken', freshToken);
        localStorage.setItem('token', freshToken);
      }
      if (freshRefreshToken) {
        localStorage.setItem('refreshToken', freshRefreshToken);
      }
      localStorage.setItem('role', targetRole);
      localStorage.setItem('userName', userObj?.name || acc.name || 'Listener');
      localStorage.setItem('email', userObj?.email || acc.email || '');
      localStorage.setItem('userId', userObj?._id || acc.id || '');
      localStorage.setItem('userAvatar', userObj?.avatar || acc.avatar || '');

      if (isArtist) {
        syncArtistSession(userObj || acc);
      } else {
        clearArtistSession();
      }

      // 3. Đồng bộ lại danh sách tài khoản đã lưu
      const list = getSavedAccounts();
      const updatedList = list.map((a) => {
        if (a.email === acc.email) {
          return {
            ...a,
            token: freshToken,
            refreshToken: freshRefreshToken,
            name: userObj?.name || a.name,
            avatar: userObj?.avatar || a.avatar,
            role: targetRole,
            id: userObj?._id || a.id,
          };
        }
        return a;
      });
      setSavedAccounts(updatedList);
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updatedList));

      clearApiCache();
      notifyClientSessionChanged();

      // 4. Reload hoặc điều hướng phù hợp với role
      setTimeout(() => {
        if (targetRole === 'artist' && !window.location.pathname.startsWith('/artist')) {
          window.location.href = '/artist/dashboard';
        } else if (targetRole !== 'artist' && window.location.pathname.startsWith('/artist')) {
          window.location.href = '/';
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (error) {
      console.error('Lỗi chuyển đổi tài khoản:', error);
      reAuthViaGoogle(acc);
    }
  };

  const handleRemoveAccount = (e, accToRemove) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const list = getSavedAccounts();
    const updated = list.filter((a) => a.email !== accToRemove.email);
    setSavedAccounts(updated);
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Add another Google account via Google OAuth
  const handleAddGoogleAccount = () => {
    if (savedAccounts.length >= MAX_SAVED_ACCOUNTS) {
      showToast({
        severity: 'warning',
        title: 'Giới hạn tài khoản',
        message: 'Bạn chỉ được lưu tối đa 4 tài khoản. Vui lòng xóa bớt tài khoản để tiếp tục đăng nhập tài khoản khác.',
      });
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      alert('Chưa cấu hình Google Client ID.');
      return;
    }

    const startOAuth = () => {
      if (!window.google?.accounts?.oauth2) {
        alert('Google OAuth SDK chưa sẵn sàng. Vui lòng thử lại sau.');
        return;
      }

      setGoogleLoading(true);

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response?.access_token) {
            try {
              const res = await api.post('/auth/google', {
                credential: response.access_token,
                tokenType: 'access_token',
              });
              const { token, refreshToken, user } = res.data;

              const newAcc = {
                id: user._id || '',
                name: user.name || 'Listener',
                email: user.email || '',
                avatar: user.avatar || '',
                role: user.role || 'user',
                token,
                refreshToken: refreshToken || '',
                gradient: GRADIENTS[savedAccounts.length % GRADIENTS.length],
              };

              const currentList = getSavedAccounts();
              const existing = currentList.filter((a) => a.email !== newAcc.email);
              if (existing.length >= MAX_SAVED_ACCOUNTS) {
                showToast({
                  severity: 'warning',
                  title: 'Giới hạn tài khoản',
                  message: 'Bạn chỉ được lưu tối đa 4 tài khoản. Vui lòng xóa bớt tài khoản để tiếp tục đăng nhập tài khoản khác.',
                });
                return;
              }

              const updated = [newAcc, ...existing].slice(0, MAX_SAVED_ACCOUNTS);
              setSavedAccounts(updated);
              localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));

              setAccessToken(token);
              localStorage.setItem('accessToken', token);
              localStorage.setItem('token', token);
              if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
              localStorage.setItem('role', user.role || 'user');
              localStorage.setItem('userName', user.name || 'Listener');
              localStorage.setItem('email', user.email || '');
              localStorage.setItem('userId', user._id || '');
              localStorage.setItem('userAvatar', user.avatar || '');

              if (user.role === 'artist') {
                syncArtistSession(user);
              } else {
                clearArtistSession();
              }

              setIsOpen(false);
              setSwitchingTarget(newAcc);
              clearApiCache();
              notifyClientSessionChanged();

              setTimeout(() => {
                if (user.role === 'artist' && !window.location.pathname.startsWith('/artist')) {
                  window.location.href = '/artist/dashboard';
                } else if (user.role !== 'artist' && window.location.pathname.startsWith('/artist')) {
                  window.location.href = '/';
                } else {
                  window.location.reload();
                }
              }, 700);
            } catch (err) {
              alert(err.response?.data?.error || err.response?.data?.message || 'Đăng nhập Google thất bại');
            } finally {
              setGoogleLoading(false);
            }
            return;
          }
          setGoogleLoading(false);
        },
        error_callback: () => {
          setGoogleLoading(false);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    };

    if (window.google?.accounts?.oauth2) {
      startOAuth();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = startOAuth;
      document.head.appendChild(script);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
    }
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      chipRef.current?.focus();
    }
  };

  const handleChipKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setTimeout(() => {
        const firstBtn = menuRef.current?.querySelector('.u037-it');
        firstBtn?.focus();
      }, 60);
    }
  };

  const handleItemKeyDown = (e, index) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const allButtons = Array.from(menuRef.current?.querySelectorAll('.u037-it') || []);
      const nextIndex = (index + delta + allButtons.length) % allButtons.length;
      allButtons[nextIndex]?.focus();
    }
  };

  const roleLabel =
    userRole === 'artist'
      ? 'Nghệ sĩ'
      : userRole === 'admin'
      ? 'Quản trị viên'
      : 'Người nghe';

  // Active account information for display
  const activeAccount = savedAccounts.find((a) => a.email === activeEmail) || {
    name: userName || (userRole === 'artist' ? 'Nghệ sĩ' : 'Listener'),
    email: activeEmail,
    avatar: userAvatar,
    gradient: GRADIENTS[0],
  };

  const activeInitial = (activeAccount.name || 'L').charAt(0).toUpperCase();

  const sharedStyles = `
    /* Lucian UX/UI Prompt #037 Scoped CSS */
    .u037 {
      position: relative;
      width: 100%;
      font-family: inherit;
      --ux-surface: #FFFFFF;
      --ux-surface-2: #F5F3EF;
      --ux-line: rgba(22, 21, 27, 0.09);
      --ux-line-2: rgba(22, 21, 27, 0.17);
      --ux-ink: #16151B;
      --ux-ink-2: #57535F;
      --ux-ink-3: #8E8A97;
      --ux-accent: #6c63ff;
      --ux-danger: #D93A55;
      --ux-shadow-strong: rgba(40, 30, 80, 0.25);
      --ux-spring: cubic-bezier(.34, 1.45, .64, 1);
      --ux-ease: cubic-bezier(.2, .8, .2, 1);
    }
    .u037.is-dark {
      --ux-surface: #141724;
      --ux-surface-2: #1e2235;
      --ux-line: rgba(255, 255, 255, 0.08);
      --ux-line-2: rgba(255, 255, 255, 0.16);
      --ux-ink: #F4F0E8;
      --ux-ink-2: rgba(244, 240, 232, 0.68);
      --ux-ink-3: rgba(244, 240, 232, 0.45);
      --ux-accent: #B7A4FF;
      --ux-danger: #FF7D8C;
      --ux-shadow-strong: rgba(0, 0, 0, 0.72);
    }

    .u037-menu {
      box-sizing: border-box;
      padding: 8px 6px;
      border-radius: 20px;
      background: var(--ux-surface);
      box-shadow: 0 0 0 1px var(--ux-line), 0 34px 64px -30px var(--ux-shadow-strong);
      transform-origin: 30px 100%;
      opacity: 0;
      transform: translateY(10px) scale(.92);
      visibility: hidden;
      transition: opacity .2s var(--ux-ease), transform .45s var(--ux-spring), visibility 0s .45s;
      z-index: 99999;
      backdrop-filter: blur(20px);
    }
    .u037.is-collapsed .u037-menu {
      transform-origin: 0 100%;
    }
    .u037.is-open .u037-menu {
      opacity: 1;
      transform: none;
      visibility: visible;
      transition: opacity .2s var(--ux-ease), transform .5s var(--ux-spring);
    }

    .u037-sec {
      margin: 6px 8px 6px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--ux-ink-3);
    }
    .u037-list {
      position: relative;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .u037-hl {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: var(--h, 48px);
      border-radius: 12px;
      background: var(--ux-surface-2);
      transform: translateY(var(--y, 0));
      opacity: 0;
      transition: transform .3s var(--ux-spring), height .3s var(--ux-spring), opacity .2s;
      pointer-events: none;
    }
    .u037-list.is-hl .u037-hl {
      opacity: 1;
    }

    .u037-it {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      height: 48px;
      padding: 0 8px;
      border: 0;
      border-radius: 12px;
      background: none;
      color: var(--ux-ink);
      font-size: 13px;
      font-weight: 650;
      text-align: left;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity .25s var(--ux-ease), transform .45s var(--ux-spring);
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
    }
    .u037.is-open .u037-it {
      opacity: 1;
      transform: none;
      transition-delay: calc(var(--i) * 32ms);
    }
    .u037-it:focus-visible {
      outline: 2px solid var(--ux-accent);
      outline-offset: -2px;
    }

    .u037-ws {
      width: 32px;
      height: 32px;
      flex: none;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 850;
      color: #ffffff;
      background: var(--c);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }
    .u037-it small {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--ux-ink-3);
    }
    .u037-ck {
      margin-left: auto;
      width: 17px;
      height: 17px;
      flex: none;
      fill: none;
      stroke: var(--ux-accent);
      stroke-width: 2.6;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0;
      transform: scale(.4);
      transition: opacity .2s, transform .4s var(--ux-spring);
    }
    .u037-it[aria-checked="true"] .u037-ck {
      opacity: 1;
      transform: none;
    }

    .u037-rm {
      width: 22px;
      height: 22px;
      margin-left: 6px;
      border: none;
      background: rgba(255, 255, 255, 0.05);
      color: var(--ux-ink-3);
      cursor: pointer;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0.65;
      transition: opacity .15s, color .15s, background .15s;
      flex: none;
    }
    .u037-it:hover .u037-rm {
      opacity: 0.9;
    }
    .u037-rm:hover {
      opacity: 1 !important;
      color: var(--ux-danger);
      background: rgba(217, 58, 85, 0.16);
    }

    .u037-ico {
      width: 30px;
      height: 30px;
      flex: none;
      display: grid;
      place-items: center;
      color: var(--ux-ink-2);
    }
    .u037-ico svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .u037-kbd {
      margin-left: auto;
      padding: 2px 6px;
      border-radius: 6px;
      background: var(--ux-surface-2);
      box-shadow: inset 0 0 0 1px var(--ux-line);
      font-size: 10px;
      font-weight: 700;
      color: var(--ux-ink-3);
      flex: none;
    }

    .u037-it.out {
      color: var(--ux-danger);
    }
    .u037-it.out .u037-ico {
      color: var(--ux-danger);
    }

    .u037-sep {
      height: 1px;
      margin: 6px 8px;
      background: var(--ux-line);
    }

    /* Bottom Account Chip */
    .u037-chip {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      height: 62px;
      padding: 0 12px;
      border: 0;
      border-radius: 18px;
      background: var(--ux-surface);
      color: var(--ux-ink);
      text-align: left;
      box-shadow: 0 0 0 1px var(--ux-line), 0 18px 36px -24px var(--ux-shadow-strong);
      transition: transform .4s var(--ux-spring), box-shadow .3s, background .2s;
      cursor: pointer;
      box-sizing: border-box;
    }
    .u037.is-collapsed .u037-chip {
      height: 50px;
      padding: 0;
      justify-content: center;
      border-radius: 14px;
    }
    .u037-chip:hover {
      box-shadow: 0 0 0 1px var(--ux-line-2), 0 18px 36px -24px var(--ux-shadow-strong);
    }
    .u037-chip:active {
      transform: scale(.98);
    }
    .u037-chip:focus-visible {
      outline: 2px solid var(--ux-accent);
      outline-offset: 3px;
    }

    .u037-chip .u037-ws {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      font-size: 15px;
      transition: background .4s var(--ux-ease);
    }
    .u037.is-collapsed .u037-chip .u037-ws {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .u037-chip b {
      display: block;
      font-size: 13.5px;
      font-weight: 750;
      line-height: 1.25;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .u037-chip small {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: var(--ux-ink-3);
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .u037-car {
      margin-left: auto;
      width: 18px;
      height: 18px;
      fill: none;
      stroke: var(--ux-ink-3);
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform .45s var(--ux-spring);
    }
    .u037.is-open .u037-car {
      transform: rotate(180deg);
    }

    @media (prefers-reduced-motion: reduce) {
      .u037-menu, .u037-it, .u037-hl, .u037-car, .u037-chip {
        transition: none !important;
        animation: none !important;
      }
    }
  `;

  return (
    <div
      ref={rootRef}
      className={`ux u037 ${isOpen ? 'is-open' : ''} ${isDark ? 'is-dark' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <style>{sharedStyles}</style>

      {/* Upward Growing Switcher Menu rendered into document.body to prevent sidebar clipping */}
      {createPortal(
        <div
          className={`ux u037 ${isOpen ? 'is-open' : ''} ${isDark ? 'is-dark' : ''} ${collapsed ? 'is-collapsed' : ''}`}
          style={{
            position: 'fixed',
            zIndex: 99999,
            pointerEvents: isOpen ? 'auto' : 'none',
            visibility: isOpen ? 'visible' : 'hidden',
          }}
        >
          <style>{sharedStyles}</style>
          <div
            ref={menuRef}
            className="u037-menu"
            role="menu"
            aria-label="Menu chuyển đổi tài khoản"
            style={{
              position: 'fixed',
              left: `${menuPos.left}px`,
              bottom: `${menuPos.bottom}px`,
              width: `${menuPos.width}px`,
            }}
            onMouseLeave={handleMenuMouseLeave}
          >
            <p className="u037-sec">{userRole === 'artist' ? 'Tài khoản Nghệ sĩ' : 'Tài khoản nghe nhạc'}</p>
            <ul className="u037-list">
              <li className="u037-hl" role="presentation" />
              
              {/* List of Saved Listener / Google Accounts */}
              {savedAccounts.map((acc, index) => {
                const isSelected = acc.email === activeEmail;
                const initial = (acc.name || 'L').charAt(0).toUpperCase();

                return (
                  <li key={acc.email || index} role="none">
                    <button
                      className="u037-it"
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      style={{ '--i': index }}
                      onPointerEnter={handleItemHover}
                      onFocus={handleItemHover}
                      onKeyDown={(e) => handleItemKeyDown(e, index)}
                      onClick={() => handleSwitchAccount(acc)}
                    >
                      <span
                        className="u037-ws"
                        style={{ '--c': acc.gradient || GRADIENTS[index % GRADIENTS.length] }}
                        aria-hidden="true"
                      >
                        {acc.avatar ? (
                          <img
                            src={acc.avatar}
                            alt={acc.name}
                            style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }}
                          />
                        ) : (
                          initial
                        )}
                      </span>
                      <div style={{ minWidth: 0, flexGrow: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.name}
                        </div>
                        <small style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.email}
                        </small>
                      </div>
                      {isSelected ? (
                        <svg className="u037-ck" viewBox="0 0 18 18" aria-hidden="true">
                          <path d="M4 9.5l3.5 3.5L14 6" />
                        </svg>
                      ) : (
                        <span
                          className="u037-rm"
                          role="button"
                          tabIndex={0}
                          title="Xóa tài khoản khỏi danh sách lưu"
                          onClick={(e) => handleRemoveAccount(e, acc)}
                        >
                          <svg viewBox="0 0 18 18" width="13" height="13" stroke="currentColor" fill="none" strokeWidth="2">
                            <line x1="4" y1="4" x2="14" y2="14" />
                            <line x1="14" y1="4" x2="4" y2="14" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}

              {/* Add Another Google Account Button */}
              <li role="none">
                <button
                  className="u037-it"
                  type="button"
                  role="menuitem"
                  disabled={googleLoading}
                  style={{ '--i': savedAccounts.length }}
                  onPointerEnter={handleItemHover}
                  onFocus={handleItemHover}
                  onKeyDown={(e) => handleItemKeyDown(e, savedAccounts.length)}
                  onClick={handleAddGoogleAccount}
                >
                  <span className="u037-ico" style={{ width: 32, height: 32 }}>
                    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </span>
                  <span style={{ color: 'var(--ux-accent)', fontWeight: 700, fontSize: 12.5 }}>
                    {googleLoading ? 'Đang kết nối Google...' : '+ Thêm tài khoản Google'}
                  </span>
                </button>
              </li>
            </ul>

            <div className="u037-sep" role="separator" />

            <ul className="u037-list">
              <li className="u037-hl" role="presentation" />

              {/* Settings & Profile */}
              <li role="none">
                <button
                  className="u037-it"
                  type="button"
                  role="menuitem"
                  style={{ '--i': savedAccounts.length + 1 }}
                  onPointerEnter={handleItemHover}
                  onFocus={handleItemHover}
                  onKeyDown={(e) => handleItemKeyDown(e, savedAccounts.length + 1)}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate(userRole === 'artist' ? '/artist/profile' : '/profile');
                  }}
                >
                  <span className="u037-ico">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.6 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.4 10h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1 1z" />
                    </svg>
                  </span>
                  <span>Cài đặt & Hồ sơ</span>
                  <span className="u037-kbd">⌘ P</span>
                </button>
              </li>

              {/* MusicFlow Pro / Upgrade */}
              <li role="none">
                <button
                  className="u037-it"
                  type="button"
                  role="menuitem"
                  style={{ '--i': savedAccounts.length + 2 }}
                  onPointerEnter={handleItemHover}
                  onFocus={handleItemHover}
                  onKeyDown={(e) => handleItemKeyDown(e, savedAccounts.length + 2)}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/client/premium');
                  }}
                >
                  <span className="u037-ico" style={{ color: '#eab308' }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </span>
                  <span>Gói hội viên Pro</span>
                </button>
              </li>

              {/* Artist Studio Portal Link */}
              <li role="none">
                <button
                  className="u037-it"
                  type="button"
                  role="menuitem"
                  style={{ '--i': savedAccounts.length + 3 }}
                  onPointerEnter={handleItemHover}
                  onFocus={handleItemHover}
                  onKeyDown={(e) => handleItemKeyDown(e, savedAccounts.length + 3)}
                  onClick={() => {
                    setIsOpen(false);
                    if (userRole === 'artist') {
                      onNavigate('/');
                    } else {
                      onNavigate('/artistlogin');
                    }
                  }}
                >
                  <span className="u037-ico" style={{ color: userRole === 'artist' ? '#00bcd4' : '#f97316' }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {userRole === 'artist' ? (
                        <path d="M9 18V5l12-2v13M9 9l12-2" />
                      ) : (
                        <>
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </>
                      )}
                    </svg>
                  </span>
                  <span>{userRole === 'artist' ? 'Không gian nghe nhạc' : 'Không gian Artist Studio'}</span>
                </button>
              </li>

              {/* Security & Sign-in */}
              <li role="none">
                <button
                  className="u037-it"
                  type="button"
                  role="menuitem"
                  style={{ '--i': savedAccounts.length + 4 }}
                  onPointerEnter={handleItemHover}
                  onFocus={handleItemHover}
                  onKeyDown={(e) => handleItemKeyDown(e, savedAccounts.length + 4)}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/profile');
                  }}
                >
                  <span className="u037-ico">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      <rect x="5" y="11" width="14" height="9" rx="2.5" />
                    </svg>
                  </span>
                  <span>Bảo mật & Đăng nhập</span>
                </button>
              </li>

              {/* Sign Out */}
              <li role="none">
                <button
                  className="u037-it out"
                  type="button"
                  role="menuitem"
                  style={{ '--i': savedAccounts.length + 5 }}
                  onPointerEnter={handleItemHover}
                  onFocus={handleItemHover}
                  onKeyDown={(e) => handleItemKeyDown(e, savedAccounts.length + 5)}
                  onClick={() => {
                    setIsOpen(false);
                    onLogout();
                  }}
                >
                  <span className="u037-ico">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
                    </svg>
                  </span>
                  <span>Đăng xuất</span>
                </button>
              </li>
            </ul>
          </div>
        </div>,
        document.body
      )}

      {/* Fullscreen Account Switching Loading Screen Overlay */}
      {switchingTarget && createPortal(
        <div
          className={`ux u037 ${isDark ? 'is-dark' : ''}`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark ? 'rgba(7, 10, 18, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(30px) saturate(180%)',
            color: isDark ? '#F4F0E8' : '#16151B',
            animation: 'u037-fade-in .25s ease both',
          }}
        >
          <style>{`
            @keyframes u037-fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes u037-pop-avatar {
              0% { transform: scale(0.6) translateY(24px); opacity: 0; }
              60% { transform: scale(1.08) translateY(-4px); opacity: 1; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes u037-progress-glide {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(50%); }
              100% { transform: translateX(200%); }
            }
          `}</style>

          {/* Glowing Avatar of target account */}
          <div
            style={{
              position: 'relative',
              width: 78,
              height: 78,
              borderRadius: 24,
              background: switchingTarget.gradient || GRADIENTS[0],
              display: 'grid',
              placeItems: 'center',
              fontSize: 32,
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: isDark
                ? '0 16px 40px -10px rgba(108, 99, 255, 0.65), 0 0 0 4px rgba(255,255,255,0.12)'
                : '0 16px 36px -10px rgba(108, 99, 255, 0.45), 0 0 0 4px rgba(108, 99, 255, 0.1)',
              animation: 'u037-pop-avatar .55s cubic-bezier(.34, 1.45, .64, 1) both',
              overflow: 'hidden',
              marginBottom: 18,
            }}
          >
            {switchingTarget.avatar ? (
              <img
                src={switchingTarget.avatar}
                alt={switchingTarget.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (switchingTarget.name || 'L').charAt(0).toUpperCase()
            )}
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: isDark ? '#B7A4FF' : '#6c63ff',
              marginBottom: 6,
            }}
          >
            Đang chuyển đổi tài khoản...
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 850,
              marginBottom: 4,
              textAlign: 'center',
            }}
          >
            {switchingTarget.name}
          </div>

          <div
            style={{
              fontSize: 13,
              color: isDark ? 'rgba(244, 240, 232, 0.6)' : 'rgba(22, 21, 27, 0.6)',
              marginBottom: 24,
              textAlign: 'center',
            }}
          >
            {switchingTarget.email}
          </div>

          {/* Smooth progress bar */}
          <div
            style={{
              width: 190,
              height: 4,
              borderRadius: 999,
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '60%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #6c63ff, #00bcd4)',
                animation: 'u037-progress-glide 1s infinite ease-in-out',
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Main Account Chip at bottom */}
      <button
        ref={chipRef}
        className="u037-chip"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Tài khoản: ${activeAccount.name}, email: ${activeAccount.email}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleChipKeyDown}
      >
        <span
          ref={chipWsRef}
          className="u037-ws"
          style={{ '--c': activeAccount.gradient || GRADIENTS[0] }}
          aria-hidden="true"
        >
          {activeAccount.avatar ? (
            <img
              src={activeAccount.avatar}
              alt={activeAccount.name}
              style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }}
            />
          ) : (
            activeInitial
          )}
        </span>

        {!collapsed && (
          <>
            <div style={{ minWidth: 0, flexGrow: 1 }}>
              <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeAccount.name}
              </b>
              <small
                title={activeAccount.email || roleLabel}
                style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {userRole === 'artist' ? 'Nghệ sĩ' : (activeAccount.email || 'Người nghe')}
              </small>
            </div>
            <svg className="u037-car" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M6 12l4-4 4 4" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

AccountSwitcherMenu.propTypes = {
  userName: PropTypes.string,
  userEmail: PropTypes.string,
  userAvatar: PropTypes.string,
  userRole: PropTypes.string,
  collapsed: PropTypes.bool,
  onLogout: PropTypes.func,
  onNavigate: PropTypes.func,
};
