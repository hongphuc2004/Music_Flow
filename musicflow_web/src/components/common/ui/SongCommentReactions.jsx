import { useState, useRef, useEffect, useCallback } from 'react';
import '../css/SongCommentReactions.css';

const MUSICFLOW_REACTION_EMOJIS = [
  { key: 'like', emoji: '👍', label: 'Thích' },
  { key: 'love', emoji: '❤️', label: 'Yêu thích' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'celebrate', emoji: '🎉', label: 'Chúc mừng' },
  { key: 'fire', emoji: '🔥', label: 'Tuyệt vời' },
  { key: 'watching', emoji: '👀', label: 'Quan sát' },
  { key: 'thanks', emoji: '🙏', label: 'Cảm ơn' },
  { key: 'done', emoji: '✅', label: 'Đã xong' },
  { key: 'idea', emoji: '💡', label: 'Ý tưởng' },
  { key: 'wow', emoji: '😮', label: 'Ngạc nhiên' },
  { key: 'launch', emoji: '🚀', label: 'Bay bổng' },
  { key: 'clap', emoji: '👏', label: 'Vỗ tay' },
];

const EMOJI_CONFIG_MAP = {
  like: { emoji: '👍', label: 'Thích' },
  love: { emoji: '❤️', label: 'Yêu thích' },
  haha: { emoji: '😂', label: 'Haha' },
  celebrate: { emoji: '🎉', label: 'Chúc mừng' },
  fire: { emoji: '🔥', label: 'Tuyệt vời' },
  watching: { emoji: '👀', label: 'Quan sát' },
  thanks: { emoji: '🙏', label: 'Cảm ơn' },
  done: { emoji: '✅', label: 'Đã xong' },
  idea: { emoji: '💡', label: 'Ý tưởng' },
  wow: { emoji: '😮', label: 'Ngạc nhiên' },
  launch: { emoji: '🚀', label: 'Bay bổng' },
  clap: { emoji: '👏', label: 'Vỗ tay' },
  sad: { emoji: '😢', label: 'Buồn' },
  angry: { emoji: '😡', label: 'Tức giận' },
};

export default function SongCommentReactions({
  comment,
  currentUserId,
  onSelectReaction,
  onRemoveReaction,
  onReply,
  timeAgo,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popStyle, setPopStyle] = useState({});
  const [poppingKey, setPoppingKey] = useState(null);

  const containerRef = useRef(null);
  const addBtnRef = useRef(null);
  const popRef = useRef(null);

  // Determine current user's reaction
  const myReaction = comment.reactions?.find(
    (r) => String(r.userId) === String(currentUserId)
  );
  const myReactionType = myReaction?.type;

  // Compile unique active reaction keys
  const summary = comment.reactionSummary || {};
  const activeKeys = new Set();
  Object.entries(summary).forEach(([key, count]) => {
    if (count > 0) activeKeys.add(key);
  });
  if (myReactionType) {
    activeKeys.add(myReactionType);
  }

  // Positioning the popup relative to container
  const updatePosition = useCallback(() => {
    if (!addBtnRef.current || !containerRef.current) return;
    const btn = addBtnRef.current;
    const container = containerRef.current;

    const btnOffsetLeft = btn.offsetLeft;
    const btnOffsetTop = btn.offsetTop;
    const btnWidth = btn.offsetWidth;
    const btnHeight = btn.offsetHeight;

    const popupWidth = 264;
    const popupHeight = 120;

    // Anchor X at center of button
    const ax = btnOffsetLeft + btnWidth / 2;
    const ay = btnOffsetTop;

    // Constrain left within container
    const containerWidth = container.offsetWidth || 300;
    const x = Math.max(0, Math.min(containerWidth - popupWidth, ax - 44));
    const ox = Math.max(16, Math.min(popupWidth - 16, ax - x));

    // Check if there is room above
    const isAbove = ay >= popupHeight + 10;
    const y = isAbove ? ay - popupHeight - 12 : ay + btnHeight + 10;

    setPopStyle({
      '--x': `${x}px`,
      '--y': `${y}px`,
      '--ox': `${ox}px`,
      isArrowTop: !isAbove,
    });
  }, []);

  const openPopup = () => {
    updatePosition();
    setIsOpen(true);
  };

  const closePopup = () => {
    setIsOpen(false);
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target) &&
        addBtnRef.current &&
        !addBtnRef.current.contains(e.target)
      ) {
        closePopup();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const triggerPopAnimation = (key) => {
    setPoppingKey(key);
    setTimeout(() => {
      setPoppingKey((current) => (current === key ? null : current));
    }, 450);
  };

  const handleChipClick = (key) => {
    triggerPopAnimation(key);
    if (myReactionType === key) {
      onRemoveReaction(comment);
    } else {
      onSelectReaction(comment, key);
    }
  };

  const handleSelectEmoji = (key) => {
    closePopup();
    triggerPopAnimation(key);
    if (myReactionType === key) {
      onRemoveReaction(comment);
    } else {
      onSelectReaction(comment, key);
    }
  };

  return (
    <div className="mf-comment-rx" ref={containerRef} role="group" aria-label="Reactions">
      {/* Active reaction chips */}
      {Array.from(activeKeys).map((key) => {
        const item = EMOJI_CONFIG_MAP[key] || { emoji: '👍', label: key };
        const count = summary[key] ?? (myReactionType === key ? 1 : 0);
        const isPressed = myReactionType === key;
        const isPopping = poppingKey === key;

        return (
          <button
            key={key}
            type="button"
            className={`mf-reaction-chip ${isPopping ? 'pop' : ''}`}
            aria-pressed={isPressed}
            data-e={item.emoji}
            onClick={() => handleChipClick(key)}
            title={`${item.label} (${count})`}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <b>{count}</b>
          </button>
        );
      })}

      {/* Smiley add button */}
      <button
        ref={addBtnRef}
        type="button"
        className="mf-reaction-add-btn"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Thêm cảm xúc"
        onClick={() => (isOpen ? closePopup() : openPopup())}
        title="Thêm cảm xúc"
      >
        <svg viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M6.5 10.5a3 3 0 0 0 5 0M7 7h.01M11 7h.01" />
        </svg>
      </button>

      {/* Reply button */}
      {onReply && (
        <button
          type="button"
          onClick={() => onReply(comment)}
          style={{
            background: 'none',
            border: 0,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.45)',
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#B7A4FF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)')}
        >
          Trả lời
        </button>
      )}

      {/* Time stamp */}
      {timeAgo && (
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.35)',
            marginLeft: 2,
            userSelect: 'none',
          }}
        >
          • {timeAgo}
        </span>
      )}

      {/* Floating Picker Popup */}
      <div
        ref={popRef}
        className={`mf-reaction-picker ${isOpen ? '' : 'closed'} ${popStyle.isArrowTop ? 'arrow-top' : ''}`}
        style={{
          '--x': popStyle['--x'] || '0px',
          '--y': popStyle['--y'] || '0px',
          '--ox': popStyle['--ox'] || '30px',
        }}
        role="dialog"
        aria-label="Chọn cảm xúc"
      >
        <small>Thường dùng</small>
        <div className="mf-reaction-grid">
          {MUSICFLOW_REACTION_EMOJIS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="mf-reaction-emoji-btn"
              title={item.label}
              onClick={() => handleSelectEmoji(item.key)}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
