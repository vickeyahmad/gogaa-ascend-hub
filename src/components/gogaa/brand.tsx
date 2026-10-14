import { useState } from 'react';
import { brand } from '@/lib/brand';

export function BrandLogo({
  className = '',
  alt = `${brand.name} logo`,
  width = 40,
  height = 40,
}: {
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span
        className={`brand-logo-fallback ${className}`}
        role="img"
        aria-label={alt}
      >
        GB
      </span>
    );
  }

  return (
    <img
      src={brand.logo}
      className={`brand-logo ${className}`}
      width={width}
      height={height}
      alt={alt}
      loading="eager"
      decoding="async"
      onError={(err) => {
        console.error(`[BrandLogo] Failed to load brand logo from "${brand.logo}":`, err);
        setHasError(true);
      }}
    />
  );
}

export function BrandWordmark() {
  return <span className="brand-wordmark">{brand.name}</span>;
}

export function BrandLockup() {
  return (
    <div className="brand-lockup">
      <div className="logo-tile">
        <BrandLogo width={30} height={30} />
      </div>
      <div className="brand-copy">
        <BrandWordmark />
        <span>{brand.subtitle}</span>
      </div>
    </div>
  );
}

