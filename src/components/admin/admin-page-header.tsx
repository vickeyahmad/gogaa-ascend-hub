import type { ReactNode } from 'react';

export interface AdminPageHeaderProps {
  title: string;
  description: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  className = '',
}: AdminPageHeaderProps) {
  return (
    <div className={`page-heading ${className}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="tracking-tight">{title}</h1>
          {badge}
        </div>
        <p className="max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="heading-actions flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
