import React from 'react';
import { X } from 'lucide-react';

export const PageHeader: React.FC<{
  title: string;
  subtitle: string;
  badge?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, badge, actions }) => (
  <div className="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {title}
        </h1>
        {badge && (
          <span className="inline-flex items-center rounded-md border border-[#a7e3ce] bg-[#ecf9f4] px-2 py-0.5 text-xs font-medium text-[#065f46]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'default' | 'mint' | 'warning';
}> = ({ label, value, sublabel, accent = 'default' }) => {
  const borderClass =
    accent === 'mint'
      ? 'border-gray-200 border-t-2 border-t-[#0f9d76]'
      : accent === 'warning'
      ? 'border-gray-200 border-t-2 border-t-amber-500'
      : 'border-gray-200';

  return (
    <div
      className={`rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)] ${borderClass}`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">
        {value}
      </div>
      {sublabel && <div className="mt-1 text-xs text-gray-500">{sublabel}</div>}
    </div>
  );
};

export const SectionCard: React.FC<{
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}> = ({ title, subtitle, actions, children, className = '', noPadding = false }) => (
  <div
    className={`rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(17,24,39,0.03)] ${className}`}
  >
    {(title || actions) && (
      <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-5'}>{children}</div>
  </div>
);

export type StatusTone = 'mint' | 'neutral' | 'warning' | 'danger';

export const StatusBadge: React.FC<{
  label: string;
  tone?: StatusTone;
}> = ({ label, tone = 'neutral' }) => {
  const styles: Record<StatusTone, { wrap: string; dot: string }> = {
    mint: {
      wrap: 'border-[#a7e3ce] bg-[#ecf9f4] text-[#065f46]',
      dot: 'bg-[#0f9d76]',
    },
    neutral: {
      wrap: 'border-gray-200 bg-gray-100 text-gray-700',
      dot: 'bg-gray-500',
    },
    warning: {
      wrap: 'border-amber-200 bg-amber-50 text-amber-900',
      dot: 'bg-amber-600',
    },
    danger: {
      wrap: 'border-red-200 bg-red-50 text-red-900',
      dot: 'bg-red-600',
    },
  };

  const s = styles[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
};

export const NoticeBox: React.FC<{
  title: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'mint' | 'warning';
  className?: string;
}> = ({ title, children, tone = 'neutral', className = '' }) => {
  const toneStyles = {
    neutral: 'border-gray-200 border-l-gray-400 bg-gray-50 text-gray-700',
    mint: 'border-[#c8ede0] border-l-[#0f9d76] bg-[#f7fcfa] text-gray-800',
    warning: 'border-amber-200 border-l-amber-600 bg-amber-50/70 text-amber-950',
  };

  return (
    <div
      className={`rounded-lg border border-l-4 px-4 py-3 text-xs leading-relaxed ${toneStyles[tone]} ${className}`}
    >
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
  }
> = ({ variant = 'secondary', size = 'md', className = '', children, ...props }) => {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f9d76]/30 disabled:cursor-not-allowed disabled:opacity-50';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-xs sm:text-sm',
  };
  const variants = {
    primary: 'bg-[#0f9d76] text-white hover:bg-[#0a7d5d] border border-transparent',
    secondary: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 border border-transparent',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, subtitle, children, maxWidth = 'max-w-xl' }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/35 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col`}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/30" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};
