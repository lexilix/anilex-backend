import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, UserPlus, MessageSquare, ExternalLink, Loader2, X } from 'lucide-react';

export default function NotificationDropdown({
  notifications = [],
  unreadCount = 0,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onAcceptFriend,
  onRejectFriend,
  onNavigateAnime
}) {
  const [actionStates, setActionStates] = useState({});

  const handleAccept = async (n) => {
    setActionStates((prev) => ({ ...prev, [n.id]: 'loading_accept' }));
    try {
      if (onAcceptFriend) {
        await onAcceptFriend(n);
      }
      setActionStates((prev) => ({ ...prev, [n.id]: 'accepted' }));
    } catch (err) {
      console.error('Accept error:', err);
      setActionStates((prev) => ({ ...prev, [n.id]: null }));
    }
  };

  const handleReject = async (n) => {
    setActionStates((prev) => ({ ...prev, [n.id]: 'loading_reject' }));
    try {
      if (onRejectFriend) {
        await onRejectFriend(n);
      }
      setActionStates((prev) => ({ ...prev, [n.id]: 'rejected' }));
    } catch (err) {
      console.error('Reject error:', err);
      setActionStates((prev) => ({ ...prev, [n.id]: null }));
    }
  };

  return (
    <div
      role="region"
      aria-label="Список уведомлений"
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#151518]/95 border border-neutral-200/80 dark:border-neutral-800/80 shadow-2xl z-50 flex flex-col max-h-[480px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            Уведомления
          </h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Прочитать все</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850 flex-1 overscroll-contain">
        {(() => {
          const visibleNotifications = notifications.filter(
            (n) => actionStates[n.id] !== 'accepted' && actionStates[n.id] !== 'rejected' && !n.isAccepted && !n.isRejected
          );
          if (visibleNotifications.length === 0) {
            return (
              <div className="py-12 px-4 text-center">
                <Bell className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700 mb-2 opacity-60" />
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Нет новых уведомлений
                </p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                  Здесь будут заявки в друзья и ответы на ваши комментарии
                </p>
              </div>
            );
          }
          return visibleNotifications.map((n) => {
            const isFriendReq = n.type === 'friend_request';
            const isComment = n.type === 'comment_reply';
            const state = actionStates[n.id];
            const isAccepted = state === 'accepted' || (n.isAccepted && state !== 'rejected' && state !== 'loading_reject');
            const isRejected = state === 'rejected' || (n.isRejected && state !== 'accepted' && state !== 'loading_accept');
            const isHandled = isAccepted || isRejected;

            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.isRead && onMarkAsRead) onMarkAsRead(n.id);
                  if (isComment && onNavigateAnime) {
                    onNavigateAnime(n);
                    if (onClose) onClose();
                  }
                }}
                className={`p-3.5 transition-all flex items-start gap-3 relative group cursor-pointer ${
                  isHandled
                    ? 'bg-neutral-200/40 dark:bg-[#0b0b0e]/95 opacity-75 border-l-2 border-l-blue-500/60 dark:border-l-blue-600/60 hover:opacity-90'
                    : !n.isRead
                    ? 'bg-neutral-50/90 dark:bg-neutral-900/60 hover:bg-neutral-100/70 dark:hover:bg-neutral-850/60'
                    : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-900/30'
                }`}
              >
                {/* Unread indicator dot */}
                {!n.isRead && !isHandled && (
                  <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}

                {/* Avatar / Icon */}
                <div className="relative shrink-0 ml-1">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs">
                    {n.data?.fromAvatar ? (
                      <img src={n.data.fromAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{n.data?.fromNickname ? n.data.fromNickname.charAt(0).toUpperCase() : 'U'}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shadow-xs">
                    {isFriendReq ? <UserPlus className="w-2 h-2" /> : <MessageSquare className="w-2 h-2" />}
                  </div>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-neutral-400 shrink-0">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 leading-snug line-clamp-2">
                    {n.message}
                  </p>

                  {/* Action buttons for Friend Request */}
                  {isFriendReq && n.data?.requestId && (
                    <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                      {isAccepted ? (
                        <div className="py-1 px-2.5 rounded-lg bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center gap-1.5 border border-blue-500/30">
                          <Check className="w-3.5 h-3.5" />
                          <span>Принято</span>
                        </div>
                      ) : isRejected ? (
                        <div className="py-1 px-2.5 rounded-lg bg-rose-600/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1.5 border border-rose-500/30">
                          <X className="w-3.5 h-3.5" />
                          <span>Отклонено</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={state === 'loading_accept' || state === 'loading_reject'}
                            onClick={() => handleAccept(n)}
                            className={`py-1 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                              state === 'loading_accept'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-wait'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            }`}
                          >
                            {state === 'loading_accept' ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Принятие...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Принять</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={state === 'loading_accept' || state === 'loading_reject'}
                            onClick={() => handleReject(n)}
                            className={`py-1 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                              state === 'loading_reject'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-wait'
                                : 'bg-neutral-200/70 dark:bg-neutral-800 hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {state === 'loading_reject' ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Отклонение...</span>
                              </>
                            ) : (
                              <span>Отклонить</span>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Comment Reply link */}
                  {isComment && n.data?.animeId && (
                    <div className="mt-2">
                      <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 hover:underline inline-flex items-center gap-1">
                        <span>Перейти к обсуждению</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteNotification) onDeleteNotification(n.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-md transition-opacity shrink-0"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн`;
}
