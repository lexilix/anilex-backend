import React, { useState } from 'react';
import { X, User, Mail, Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { apiUrl, apiFetch, getFriendlyErrorMessage } from '../api';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess
}) {
  const [mode, setMode] = useState('register'); // 'register' or 'login'
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  React.useEffect(() => {
    let timer = null;
    if (loading) {
      setLoadingSeconds(0);
      timer = setInterval(() => {
        setLoadingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { email, nickname, password }
        : { email, password };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000)
      }, 2);

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Сервер бэкенда ещё прогревается. Подождите несколько секунд и нажмите «Повторить».');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Произошла ошибка входа');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
        setError('Сервер Render просыпается после паузы (холодный старт Render Free Tier). Нажмите кнопку «Повторить попытку» — контейнер уже активен.');
      } else {
        setError(getFriendlyErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151518] shadow-2xl p-6 sm:p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {mode === 'register' ? 'Создать профиль' : 'Вход в аккаунт'}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {mode === 'register'
              ? 'Простая регистрация по почте без подтверждений'
              : 'Введите почту и пароль для входа'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-6">
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
              mode === 'register'
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Регистрация
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
              mode === 'login'
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Вход
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium leading-relaxed">{error}</p>
                {(error.includes('Render') || error.includes('Сервер')) && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-200 font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Повторить попытку
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              Почта (Email)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ваша_почта@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 focus:bg-neutral-200/80 dark:focus:bg-neutral-700/70 transition-colors"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                Никнейм (Имя для оценок)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Например: Just, Alex, Maria..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 focus:bg-neutral-200/80 dark:focus:bg-neutral-700/70 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              Пароль
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 3 символа"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 focus:bg-neutral-200/80 dark:focus:bg-neutral-700/70 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all mt-4 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-400" />
                <span>
                  {loadingSeconds >= 2
                    ? `Подключение (${loadingSeconds}с)...`
                    : 'Загрузка...'}
                </span>
              </>
            ) : mode === 'register' ? (
              'Зарегистрироваться'
            ) : (
              'Войти'
            )}
          </button>

          {loading && loadingSeconds >= 3 && (
            <p className="text-[11px] text-center text-amber-600/90 dark:text-amber-400/90 mt-2.5 animate-pulse font-medium">
              Сервер Render просыпается после паузы (~20–30 сек). Пожалуйста, не закрывайте окно...
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
