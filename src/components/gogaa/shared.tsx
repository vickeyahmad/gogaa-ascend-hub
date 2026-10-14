import type { ReactNode } from 'react';
import { CircleAlert, Inbox, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import type { OrderStatus } from '@/lib/preview-fixtures';
export function PreviewBadge(){return <span className="preview-badge"><span/>Preview Data</span>;}
export function StatusBadge({status}:{status:OrderStatus}){return <span className={`status-badge status-${status.toLowerCase().replaceAll(' ','-')}`}><span/>{status}</span>;}
export function EmptyState(){return <div className="content-state"><Inbox/><h3>No orders to show</h3><p>No sample orders match your search.</p></div>;}
export function ErrorState({onRetry}:{onRetry:()=>void}){return <div className="content-state"><CircleAlert/><h3>Unable to load orders</h3><p>This is a preview of the error state.</p><Button variant="outline" onClick={onRetry}>Return to sample data</Button></div>;}
export function PreviewDialog({title,onClose,children}:{title:string|null;onClose:()=>void;children?:ReactNode}){return <Dialog open={!!title} onOpenChange={open=>{if(!open)onClose()}}><DialogContent><div className="dialog-symbol"><Sparkles/></div><DialogTitle>{title}</DialogTitle><DialogDescription>{children||'Design preview only. This section will connect to the existing Gogaa Byte backend in a future phase. No data has been changed.'}</DialogDescription><span className="preview-badge">Phase 1 · Frontend preview</span></DialogContent></Dialog>;}
