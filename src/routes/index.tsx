import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/gogaa/dashboard';
import { ProtectedRoute } from '@/lib/auth-context';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Dashboard · Gogaa Byte Admin' },
      { name: 'description', content: 'Explore the Gogaa Byte Control Center: catalog, orders, payments, and fulfillment.' },
      { property: 'og:title', content: 'Dashboard · Gogaa Byte Admin' },
      { property: 'og:description', content: 'A premium digital marketplace control center.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: ProtectedDashboard,
});

function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
