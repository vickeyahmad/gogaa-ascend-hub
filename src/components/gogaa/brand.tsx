import { brand } from '@/lib/brand';
export function BrandLogo({className = ''}:{className?:string}) {return <img src={brand.logo} className={`brand-logo ${className}`} width={80} height={32} alt="GB logo"/>;}
export function BrandWordmark(){return <span className="brand-wordmark">{brand.name}</span>;}
export function BrandLockup(){return <div className="brand-lockup"><div className="logo-tile"><BrandLogo/></div><div className="brand-copy"><BrandWordmark/><span>{brand.subtitle}</span></div></div>;}
