import { useState, useMemo } from 'react';
import '../css/NotificationPanel.css';

const GRADIENTS = [
  'linear-gradient(135deg, #FF6B8B, #FF8E53)',
  'linear-gradient(135deg, #7B61FF, #3D8BFF)',
  'linear-gradient(135deg, #00C6FF, #0072FF)',
  'linear-gradient(135deg, #F857A6, #FF5858)',
  'linear-gradient(135deg, #11998E, #38EF7D)',
  'linear-gradient(135deg, #F9D423, #FF4E50)',
];

const SYSTEM_TYPES = new Set([
  'system',
  'general',
  'ai_quota_reset',
  'subscription',
  'artist_pro',
  'song_moderation_result',
  'admin_moderation_alert',
  'artist_milestone',
]);

function getSafeInitial(name, fallback = 'M') {
  if (!name || typeof name !== 'string') return fallback;
  // Strip leading emojis and symbols so surrogate pairs are never broken
  const cleaned = name.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, '').trim();
  if (!cleaned) return fallback;
  const firstChar = Array.from(cleaned)[0];
  return firstChar ? firstChar.toUpperCase() : fallback;
}

function stripLeadingEmoji(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, '').trim();
}

function getNotificationVisuals(noti = {}) {
  const type = noti.type || 'system';
  const meta = noti.metadata || {};
  const rawTitle = noti.title || '';
  const rawContent = noti.content || noti.message || rawTitle;

  const hasPersonalActor = Boolean(
    meta.senderName ||
    meta.actorName ||
    meta.commenterName ||
    meta.followerName ||
    meta.artistName
  );

  const isSystem =
    SYSTEM_TYPES.has(type) ||
    (!hasPersonalActor && type !== 'interaction' && type !== 'artist_follow');

  let sender = 'MusicFlow';
  let avatarUrl = null;
  let isSystemAvatar = false;
  let badgeEmoji = '🔔';

  if (isSystem) {
    avatarUrl = '/logo.png';
    isSystemAvatar = true;

    if (type === 'ai_quota_reset') {
      sender = 'MusicFlow AI';
      badgeEmoji = '✨';
    } else if (type === 'subscription' || type === 'artist_pro') {
      sender = meta.planName ? `MusicFlow ${meta.planName}` : 'MusicFlow Premium';
      badgeEmoji = '👑';
    } else if (type === 'song_moderation_result') {
      sender = 'MusicFlow Kiểm duyệt';
      if (meta.status === 'SAFE' || rawTitle.includes('duyệt') || rawTitle.includes('an toàn')) {
        badgeEmoji = '✅';
      } else if (meta.status === 'BLOCK' || rawTitle.includes('xóa') || rawTitle.includes('vi phạm')) {
        badgeEmoji = '⛔';
      } else {
        badgeEmoji = '🛡️';
      }
    } else if (type === 'admin_moderation_alert') {
      sender = meta.status === 'BLOCK' ? 'Cảnh báo vi phạm' : 'Hệ thống kiểm duyệt';
      badgeEmoji = meta.status === 'BLOCK' ? '🚨' : '🛡️';
    } else if (type === 'artist_milestone') {
      sender = 'MusicFlow Cột mốc';
      badgeEmoji = '🎉';
    } else {
      sender = 'Hệ thống MusicFlow';
      badgeEmoji = '🔔';
    }
  } else if (type === 'artist_release') {
    sender = meta.artistName || 'Nghệ sĩ';
    avatarUrl = meta.songCover || meta.artistAvatar || null;
    badgeEmoji = '🎵';
  } else if (type === 'artist_follow') {
    sender = meta.followerName || 'Thính giả mới';
    avatarUrl = meta.followerAvatar || null;
    badgeEmoji = '👤';
  } else if (type === 'interaction') {
    sender = meta.senderName || meta.actorName || meta.commenterName || 'Người dùng';
    avatarUrl = meta.senderAvatar || meta.actorAvatar || meta.commenterAvatar || null;
    const isLike =
      meta.action === 'like' ||
      rawContent.toLowerCase().includes('thích') ||
      rawContent.toLowerCase().includes('like');
    badgeEmoji = isLike ? '❤️' : '💬';
  } else {
    sender = meta.senderName || 'Người dùng';
    avatarUrl = meta.senderAvatar || null;
    badgeEmoji = '💬';
  }

  // Format body text cleanly without duplicating the sender name
  let body = rawContent;
  if (!body || body === rawTitle) {
    body = stripLeadingEmoji(rawTitle);
  }

  if (body.startsWith(sender)) {
    body = body.slice(sender.length).trim();
  }

  const initial = getSafeInitial(sender, 'M');

  return {
    sender,
    body,
    avatarUrl,
    isSystemAvatar,
    badgeEmoji,
    initial,
  };
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Vừa xong';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function NotificationPanel({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onItemClick,
}) {
  const [activeTab, setActiveTab] = useState(0); // 0: Tất cả, 1: Chưa đọc

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const displayedNotifications = useMemo(() => {
    if (activeTab === 1) {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  return (
    <div className="noti-panel">
      {/* Beak Pointer to Bell */}
      <div className="noti-panel-beak" aria-hidden="true" />

      {/* Header */}
      <div className="noti-panel-header">
        <div className="noti-panel-tabs">
          <button
            type="button"
            className={`noti-panel-tab ${activeTab === 0 ? 'active' : ''}`}
            onClick={() => setActiveTab(0)}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`noti-panel-tab ${activeTab === 1 ? 'active' : ''}`}
            onClick={() => setActiveTab(1)}
          >
            Chưa đọc
            {unreadCount > 0 && (
              <span className="noti-tab-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
        </div>

        <button
          type="button"
          className="noti-mark-all-btn"
          disabled={unreadCount === 0}
          onClick={onMarkAllAsRead}
        >
          Đã đọc tất cả
        </button>
      </div>

      {/* List */}
      {displayedNotifications.length === 0 ? (
        <div className="noti-panel-empty">
          <div className="noti-empty-orb">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <b>Không có thông báo nào</b>
          <p>
            {activeTab === 1
              ? 'Bạn đã đọc toàn bộ các thông báo gần đây'
              : 'Các thông báo âm nhạc mới sẽ hiển thị tại đây'}
          </p>
        </div>
      ) : (
        <ul className="noti-panel-list">
          {displayedNotifications.map((noti, index) => {
            const grad = GRADIENTS[index % GRADIENTS.length];
            const visuals = getNotificationVisuals(noti);
            const timeText = formatRelativeTime(noti.createdAt);

            return (
              <li
                key={noti._id || index}
                className={`noti-item ${noti.isRead ? 'read' : 'unread'}`}
                style={{ '--i': index }}
                onClick={() => {
                  if (!noti.isRead && onMarkAsRead) {
                    onMarkAsRead(noti._id);
                  }
                  onItemClick?.(noti);
                }}
              >
                {/* Avatar with Vibrant Gradient & Mini Badge */}
                <div
                  className={`noti-item-av ${visuals.isSystemAvatar ? 'system-logo' : ''}`}
                  style={!visuals.isSystemAvatar && !visuals.avatarUrl ? { '--av-grad': grad } : undefined}
                  aria-hidden="true"
                >
                  {visuals.avatarUrl ? (
                    <img
                      src={visuals.avatarUrl}
                      alt={visuals.sender}
                      onError={(e) => {
                        // Fallback to initial if image fails
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextSibling.style.display = 'inline';
                      }}
                    />
                  ) : null}
                  <span style={{ display: visuals.avatarUrl ? 'none' : 'inline' }}>
                    {visuals.initial}
                  </span>
                  <span className="noti-item-av-badge">{visuals.badgeEmoji}</span>
                </div>

                {/* Content */}
                <div className="noti-item-content">
                  <div className="noti-item-text">
                    <span className="noti-item-sender">{visuals.sender}</span>
                    <span>{visuals.body}</span>
                  </div>
                  <div className="noti-item-time">{timeText}</div>
                </div>

                {/* Accent Dot */}
                <div className="noti-dot" aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
