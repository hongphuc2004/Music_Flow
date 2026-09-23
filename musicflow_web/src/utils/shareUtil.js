/**
 * shareUtil.js — Helpers for creating SoundCloud-style share URLs,
 * formatted social share intents, UTM parameters, Web Share API triggers,
 * and QR code generations for MusicFlow songs.
 */

/**
 * Chuyển chuỗi tiếng Việt có dấu và ký tự đặc biệt sang URL slug chuẩn (kebab-case).
 * @param {string} text
 * @returns {string} URL slug
 */
export function slugify(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/[đĐ]/g, 'd')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '') // Bỏ ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-') // Đổi khoảng trắng thành dấu gạch nối
    .replace(/-+/g, '-') // Gộp nhiều dấu gạch liên tiếp
    .replace(/^-+|-+$/g, ''); // Cắt gạch ở đầu/cuối
}

/**
 * Sinh unique Share Instance ID (`si`) 12 ký tự ngẫu nhiên cho mỗi lượt chia sẻ.
 * @returns {string}
 */
export function generateShareInstanceId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint8Array(6);
      crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // ignore
  }
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
}

/**
 * Creates the SoundCloud-style share URL for a song:
 * `https://musicflow.vn/:artistSlug/:songSlug?utm_source=...&utm_medium=...&utm_campaign=social_sharing&si=...`
 * 
 * @param {object|string} songOrId
 * @param {object} [options]
 * @param {'clipboard'|'facebook'|'zalo'|'twitter'|'telegram'|'qrcode'|'other'} [options.source='clipboard']
 * @param {string} [options.medium='share']
 * @param {string} [options.campaign='social_sharing']
 * @param {string} [options.si]
 * @param {boolean} [options.withUtm=true]
 * @returns {string}
 */
export function createSongShareUrl(songOrId, options = {}) {
  if (!songOrId) return '';

  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.')
  );

  const origin = import.meta.env.VITE_APP_URL
    || (!isLocalhost && typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://music-flow-bay.vercel.app');

  const {
    source = 'clipboard',
    medium = 'share',
    campaign = 'social_sharing',
    si = generateShareInstanceId(),
    withUtm = true,
  } = options;

  let path = '';

  if (typeof songOrId === 'string') {
    // If called with raw song ID or slug
    path = `/songs/${songOrId}`;
  } else {
    const song = songOrId;
    const songSlug = song.slug || slugify(song.title || 'track');

    let artistSlug = 'u';
    if (song.artistSlug) {
      artistSlug = song.artistSlug;
    } else if (Array.isArray(song.artists) && song.artists.length > 0) {
      const firstArtist = song.artists[0];
      if (typeof firstArtist === 'object' && firstArtist !== null) {
        artistSlug = firstArtist.slug || slugify(firstArtist.name || 'u');
      } else if (typeof firstArtist === 'string' && !/^[0-9a-fA-F]{24}$/.test(firstArtist)) {
        artistSlug = slugify(firstArtist);
      } else if (song.artist) {
        artistSlug = slugify(song.artist);
      }
    } else if (song.artist) {
      artistSlug = slugify(song.artist);
    }

    // SoundCloud-style path: /:artistSlug/:songSlug
    // IMPORTANT: artistSlug must NOT be 'artist' or 'admin' to avoid route prefix collisions
    if (artistSlug === 'artist' || artistSlug === 'admin') {
      artistSlug = 'u';
    }
    path = `/${artistSlug || 'u'}/${songSlug || 'track'}`;
  }

  const url = new URL(path, origin);

  if (withUtm) {
    if (source) url.searchParams.set('utm_source', source);
    if (medium) url.searchParams.set('utm_medium', medium);
    if (campaign) url.searchParams.set('utm_campaign', campaign);
    if (si) url.searchParams.set('si', si);
  }

  return url.toString();
}

/**
 * Formats a dynamic share message from song metadata.
 * @param {object} song
 * @returns {string}
 */
export function createSongShareText(song) {
  if (!song) return 'Nghe nhạc chất lượng cao trên MusicFlow 🎵';
  
  const title = song.title || 'Bài hát';
  let artists = '';
  if (Array.isArray(song.artists) && song.artists.length > 0) {
    artists = song.artists
      .map((a) => (typeof a === 'object' && a !== null ? (a.name || a.stageName) : (typeof a === 'string' && !/^[0-9a-fA-F]{24}$/.test(a) ? a : '')))
      .filter(Boolean)
      .join(', ');
  }
  if (!artists) {
    artists = song.artistNames || song.artist || (typeof song.artists === 'string' ? song.artists : '');
  }

  if (artists) {
    return `Nghe "${title}" - ${artists} trên MusicFlow 🎵`;
  }
  return `Nghe bài hát "${title}" trên MusicFlow 🎵`;
}

/**
 * Generates external social network share intents.
 * @param {'facebook'|'zalo'|'twitter'|'telegram'|'messenger'} platform
 * @param {object} params
 * @param {string} params.url
 * @param {string} [params.text]
 * @param {string} [params.title]
 * @returns {string} Intent URL
 */
export function getSocialShareUrl(platform, { url, text, title }) {
  const encUrl = encodeURIComponent(url || '');
  const encText = encodeURIComponent(text || title || '');

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encText}`;
    case 'instagram':
      return 'https://www.instagram.com/direct/inbox/';
    case 'zalo':
      return `https://sp.zalo.me/share?url=${encUrl}`;
    case 'twitter':
    case 'x':
      return `https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encUrl}&text=${encText}`;
    case 'messenger':
      return `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encText}`;
    case 'whatsapp':
      return `https://api.whatsapp.com/send?text=${encText}%0A${encUrl}`;
    default:
      return url;
  }
}

/**
 * Triggers native Web Share API on mobile or supported desktop browsers.
 * Returns true if native share succeeded, false if unsupported or cancelled.
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.text
 * @param {string} params.url
 * @returns {Promise<boolean>}
 */
export async function triggerNativeShare({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ url })) {
    try {
      await navigator.share({
        title: title || 'MusicFlow',
        text: text || '',
        url: url || window.location.href,
      });
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share failed:', err);
      }
      return false;
    }
  }
  return false;
}

/**
 * Generates an SVG QR Code URL using public lightweight QR rendering.
 * @param {string} text
 * @param {number} [size=240]
 * @returns {string}
 */
export function getQrCodeImageUrl(text, size = 300) {
  if (!text) return '';
  const enc = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}&qzone=2&color=000000&bgcolor=FFFFFF`;
}

/**
 * Chuyển tên nghệ sĩ thành ZingMP3-style URL slug (ví dụ: "Khánh Phương" -> "Khanh-Phuong").
 * @param {string} name
 * @returns {string}
 */
export function toZingArtistSlug(name = '') {
  if (!name) return 'artist';
  const noAccents = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'Đ' ? 'D' : 'd'))
    .trim();

  const words = noAccents.split(/[\s_-]+/).filter(Boolean);
  if (!words.length) return 'artist';

  const slug = words
    .map((w) => {
      if (w === w.toUpperCase() && w.length > 1) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join('-');

  return slug.replace(/[^a-zA-Z0-9-]/g, '') || 'artist';
}

/**
 * Trả về route path chuẩn ZingMP3 cho nghệ sĩ (ví dụ: /Da-LAB hoặc /Khanh-Phuong).
 * @param {object|string} artist
 * @returns {string}
 */
export function getArtistPath(artist) {
  if (!artist) return '/';
  if (typeof artist === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(artist)) {
      return `/artists/${artist}`;
    }
    return `/${toZingArtistSlug(artist)}`;
  }
  if (artist.slug) return `/${artist.slug}`;
  if (artist.name) return `/${toZingArtistSlug(artist.name)}`;
  if (artist._id || artist.id) return `/artists/${artist._id || artist.id}`;
  return '/';
}

/**
 * Trả về route path chuẩn cho Tuyển tập của nghệ sĩ (ví dụ: /playlists/artist-MIN-best_songs).
 * @param {object|string} artist
 * @param {string} [collectionId='best_songs']
 * @returns {string}
 */
export function getArtistCollectionPath(artist, collectionId = 'best_songs') {
  if (!artist) return `/playlists/artist-unknown-${collectionId}`;
  let slug = '';
  if (typeof artist === 'string') {
    slug = /^[0-9a-fA-F]{24}$/.test(artist) ? artist : toZingArtistSlug(artist);
  } else if (artist.slug) {
    slug = artist.slug;
  } else if (artist.name) {
    slug = toZingArtistSlug(artist.name);
  } else {
    slug = artist._id || artist.id || 'artist';
  }
  return `/playlists/artist-${slug}-${collectionId}`;
}

/**
 * Creates the share URL for an artist page with ZingMP3-style clean slug, UTM and tracking params.
 * Example: https://musicflow.vn/Khanh-Phuong
 * @param {object|string} artistOrId
 * @param {object} [options]
 * @returns {string}
 */
export function createArtistShareUrl(artistOrId, options = {}) {
  if (!artistOrId) return typeof window !== 'undefined' ? window.location.href : '';

  let artistSlug = '';
  if (typeof artistOrId === 'object' && artistOrId !== null) {
    if (artistOrId.slug) {
      artistSlug = artistOrId.slug;
    } else if (artistOrId.name) {
      artistSlug = toZingArtistSlug(artistOrId.name);
    } else {
      artistSlug = artistOrId._id || artistOrId.id;
    }
  } else if (typeof artistOrId === 'string') {
    artistSlug = artistOrId;
  }

  // Prevent collisions with system root paths
  const reservedRoutes = [
    'admin', 'artist', 'client', 'songs', 'playlists', 'collections',
    'discover', 'genres', 'rankings', 'library', 'favorites', 'profile',
    'premium', 'accountlogin', 'adminlogin', 'artistlogin', 'home',
  ];
  if (reservedRoutes.includes(String(artistSlug).toLowerCase())) {
    artistSlug = `artists/${artistSlug}`;
  }

  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.')
  );

  const origin = import.meta.env.VITE_APP_URL
    || (!isLocalhost && typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://music-flow-bay.vercel.app');

  const {
    source = 'clipboard',
    medium = 'share',
    campaign = 'artist_sharing',
    si = generateShareInstanceId(),
    withUtm = true,
  } = options;

  const path = `/${artistSlug}`;
  const url = new URL(path, origin);

  if (withUtm) {
    if (source) url.searchParams.set('utm_source', source);
    if (medium) url.searchParams.set('utm_medium', medium);
    if (campaign) url.searchParams.set('utm_campaign', campaign);
    if (si) url.searchParams.set('si', si);
  }

  return url.toString();
}

/**
 * Formats a dynamic share message for an artist.
 * @param {object} artist
 * @returns {string}
 */
export function createArtistShareText(artist) {
  if (!artist) return 'Khám phá âm nhạc chất lượng cao trên MusicFlow 🎵';
  const name = artist.name || 'Nghệ sĩ';
  return `Khám phá các ca khúc tuyệt vời của ${name} trên MusicFlow 🎵`;
}

