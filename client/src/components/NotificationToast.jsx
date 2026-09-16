import React, { useEffect } from 'react';
import { UserPlus, MessageSquare, Check, X, ExternalLink } from 'lucide-react';

export default function NotificationToast({
  toasts = [],
  onDismiss,
  onAcceptFriend,
  onRejectFriend,
  onNavigateAnime
}) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside aria-label="Уведомления" className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          onAccept={() => onAcceptFriend && onAcceptFriend(toast)}
          onReject={() => onRejectFriend && onRejectFriend(toast)}
          onNavigate={() => onNavigateAnime && onNavigateAnime(toast)}
        />
      ))}
    </aside>
  );
}

function ToastItem({ toast, onDismiss, onAccept, onReject, onNavigate }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isFriendRequest = toast.type === 'friend_request';
  const isCommentReply = toast.type === 'comment_reply';

  return (
    <div
      role="status"
      className="pointer-events-auto w-full rounded-2xl backdrop-blur-xl bg-white/85 dark:bg-[#18181b]/90 border border-white/40 dark:border-white/10 shadow-2xl p-4 text-neutral-900 dark:text-neutral-100 transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar or Icon */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs">
              {toast.data?.fromAvatar ? (
                <img src={toast.data.fromAvatar} alt={toast.data?.fromNickname || 'Пользователь'} className="w-full h-full object-cover" />
              ) : (
                <span>{toast.data?.fromNickname ? toast.data.fromNickname.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shadow-sm">
              {isFriendRequest ? <UserPlus className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
            </div>
          </div>

          {/* Text Info */}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-tight">
              {toast.title}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-2 leading-snug">
              {toast.message}
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 -mr-1 -mt-1 rounded-lg transition-colors"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      {isFriendRequest && (
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-neutral-200/50 dark:border-neutral-800/60">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Принять</span>
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 py-1.5 px-3 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Отклонить</span>
          </button>
        </div>
      )}

      {isCommentReply && toast.data?.animeId && (
        <div className="mt-3 pt-2.5 border-t border-neutral-200/50 dark:border-neutral-800/60">
          <button
            type="button"
            onClick={onNavigate}
            className="w-full py-1.5 px-3 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Перейти к обсуждению</span>
          </button>
        </div>
      )}
    </div>
  );
}
