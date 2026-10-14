import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo, BrandWordmark } from './brand';
export function ButtonLoader(){return <span className="button-loader" aria-label="Loading" role="status"/>;}
export function SkeletonLoader({className=''}:{className?:string}){return <div className={`skeleton-shimmer ${className}`} aria-hidden="true"/>;}
export function GogaaByteLoader({
  complete = false,
  compact = false,
  message,
}: {
  complete?: boolean;
  compact?: boolean;
  message?: string;
}) {
  const displayText =
    message ?? (complete ? 'Your workspace is ready.' : 'Preparing your digital universe...');
  return (
    <div
      className={`energy-loader ${compact ? 'compact' : ''} ${complete ? 'complete' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="energy-core">
        <div className="energy-ring" />
        <div className="energy-glass">
          <BrandLogo width={compact ? 45 : 80} height={compact ? 45 : 80} />
        </div>
      </div>
      <div className="loader-wordmark">
        <BrandWordmark />
      </div>
      <p>{displayText}</p>
      <div className="energy-progress">
        <span />
      </div>
    </div>
  );
}
export function PageLoader() {
  return (
    <div className="page-loader">
      <GogaaByteLoader compact />
    </div>
  );
}
export function FullScreenLoader({
  complete = false,
  message,
}: {
  complete?: boolean;
  message?: string;
}) {
  return (
    <div className={`full-screen-loader ${complete ? 'dissolving' : ''}`}>
      <GogaaByteLoader complete={complete} message={message} />
    </div>
  );
}
export function LoaderPreview({onClose}:{onClose:()=>void}){const [complete,setComplete]=useState(false);useEffect(()=>{const timer=setTimeout(()=>setComplete(true),4200);return ()=>clearTimeout(timer)},[]);useEffect(()=>{if(!complete)return;const timer=setTimeout(onClose,1100);return()=>clearTimeout(timer)},[complete,onClose]);return <div className="loader-preview" role="dialog" aria-modal="true" aria-label="Brand loader design preview"><FullScreenLoader complete={complete}/><div className="loader-preview-top"><span className="preview-chip">Design preview · no API operation</span><Button variant="glass" size="icon" aria-label="Close loader preview" onClick={onClose}><X/></Button></div></div>;}
