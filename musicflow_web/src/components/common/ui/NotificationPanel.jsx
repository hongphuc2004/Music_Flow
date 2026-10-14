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

function getBadgeEmoji(type, title, message) {
  const content = `${type || ''} ${title || ''} ${message || ''}`.toLowerCase();
  if (type === 'subscription' || content.includes('premium') || content.includes('gói')) return '👑';
  if (type === 'admin_moderation_alert' || content.includes('cảnh báo') || content.includes('vi phạm')) return '⚠️';
  if (type === 'song_moderation_result' || content.includes('kiểm duyệt') || content.includes('duyệt')) return '🛡️';
  if (type === 'interaction' || content.includes('bình luận') || content.includes('nhắc đến')) return '💬';
  if (content.includes('yêu thích') || content.includes('thả tim') || content.includes('like')) return '❤️';
  if (type === 'system' || content.includes('hệ thống')) return '🔔';
  return '🎵';
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
  onClose,
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
            const sender =
              noti.metadata?.senderName ||
              noti.title ||
              'MusicFlow';
            const message = noti.message || '';
            const initial = sender.trim().charAt(0).toUpperCase() || 'M';
            const avatarUrl = noti.metadata?.senderAvatar;
            const badgeEmoji = getBadgeEmoji(noti.type, noti.title, noti.message);
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
                  className="noti-item-av"
                  style={{ '--av-grad': grad }}
                  aria-hidden="true"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={sender} />
                  ) : (
                    <span>{initial}</span>
                  )}
                  <span className="noti-item-av-badge">{badgeEmoji}</span>
                </div>

                {/* Content */}
                <div className="noti-item-content">
                  <div className="noti-item-text">
                    <span className="noti-item-sender">{sender}</span>
                    <span>{message}</span>
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
