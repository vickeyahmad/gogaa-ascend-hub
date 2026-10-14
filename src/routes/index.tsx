import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/gogaa/dashboard';
export const Route = createFileRoute('/')({
 head:()=>({meta:[{title:'Dashboard · Gogaa Byte Admin'},{name:'description',content:'Explore the Gogaa Byte Control Center design preview: catalog, orders, payments, and fulfillment.'},{property:'og:title',content:'Dashboard · Gogaa Byte Admin'},{property:'og:description',content:'A premium digital marketplace control center. Frontend design preview with sample data.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:Dashboard,
});
