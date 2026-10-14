import React from 'react';
import '../css/NotificationBellButton.css';

export default function NotificationBellButton({
  onClick,
  hasUnread = false,
  unreadCount = 0,
  className = '',
  title = 'Thông báo',
}) {
  return (
    <div
      className={`noti-bell-container ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        height="22"
        width="22"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          stroke="currentColor"
        />
      </svg>

      {/* Chấm radar xanh lá phát sóng khi có thông báo */}
      {(hasUnread || unreadCount > 0) && <div className="noti-bell-point" />}

      {/* Badge hiển thị số lượng nếu có nhiều hơn 0 */}
      {unreadCount > 0 && (
        <span className="noti-bell-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  );
}
