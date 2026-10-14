import React from 'react';

export interface ActiveStatusBadgeProps {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}

export function ActiveStatusBadge({
  isActive,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
  className = '',
}: ActiveStatusBadgeProps) {
  const statusClass = isActive ? 'status-badge-active' : 'status-badge-inactive';

  return (
    <span
      className={`status-badge ${statusClass} ${className}`}
      data-testid={isActive ? 'status-active' : 'status-inactive'}
      role="status"
    >
      <span aria-hidden="true" />
      {isActive ? activeLabel : inactiveLabel}
    </span>
  );
}
