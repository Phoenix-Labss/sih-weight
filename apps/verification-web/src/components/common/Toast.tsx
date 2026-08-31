import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {notifications.map((n) => {
        const isSuccess = n.type === 'success';
        const isError = n.type === 'error';
        const isWarning = n.type === 'warning';
        const isInfo = n.type === 'info';

        const borderClass = isSuccess
          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
          : isError
          ? 'border-red-500 bg-red-50 text-red-900'
          : isWarning
          ? 'border-amber-500 bg-amber-50 text-amber-900'
          : 'border-blue-500 bg-blue-50 text-blue-900';

        const Icon = isSuccess
          ? CheckCircle2
          : isError
          ? AlertCircle
          : isWarning
          ? AlertTriangle
          : Info;

        const iconColor = isSuccess
          ? 'text-emerald-700'
          : isError
          ? 'text-red-600'
          : isWarning
          ? 'text-amber-700'
          : 'text-gov-blue';

        return (
          <div
            key={n.id}
            role={isError ? 'alert' : 'status'}
            className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-overlay ${borderClass}`}
          >
            <Icon className={`mt-0.5 w-5 h-5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{n.title}</div>
              {n.message && <p className="mt-0.5 text-xs opacity-90">{n.message}</p>}
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
