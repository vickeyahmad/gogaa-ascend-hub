import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo, BrandWordmark } from './brand';
export function ButtonLoader(){return <span className="button-loader" aria-label="Loading" role="status"/>;}
export function SkeletonLoader({className=''}:{className?:string}){return <div className={`skeleton-shimmer ${className}`} aria-hidden="true"/>;}
export function GogaaByteLoader({complete=false,compact=false}:{complete?:boolean;compact?:boolean}){return <div className={`energy-loader ${compact?'compact':''} ${complete?'complete':''}`} role="status" aria-live="polite"><div className="energy-core"><div className="energy-ring"/><div className="energy-glass"><BrandLogo/></div></div><div className="loader-wordmark"><BrandWordmark/></div><p>{complete?'Your workspace is ready.':'Preparing your digital universe...'}</p><div className="energy-progress"><span/></div></div>;}
export function PageLoader(){return <div className="page-loader"><GogaaByteLoader compact/></div>;}
export function FullScreenLoader({complete=false}:{complete?:boolean}){return <div className={`full-screen-loader ${complete?'dissolving':''}`}><GogaaByteLoader complete={complete}/></div>;}
export function LoaderPreview({onClose}:{onClose:()=>void}){const [complete,setComplete]=useState(false);useEffect(()=>{const timer=setTimeout(()=>setComplete(true),4200);return ()=>clearTimeout(timer)},[]);useEffect(()=>{if(!complete)return;const timer=setTimeout(onClose,1100);return()=>clearTimeout(timer)},[complete,onClose]);return <div className="loader-preview" role="dialog" aria-modal="true" aria-label="Brand loader design preview"><FullScreenLoader complete={complete}/><div className="loader-preview-top"><span className="preview-chip">Design preview · no API operation</span><Button variant="glass" size="icon" aria-label="Close loader preview" onClick={onClose}><X/></Button></div></div>;}
