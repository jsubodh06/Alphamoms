import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { CoffeeBackdrop } from './components/CoffeeBackdrop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RsvpCarousel } from './components/RsvpCarousel';

export default function App() {
  const [route, setRoute] = useState<'rsvp' | 'admin'>(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'rsvp',
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname.startsWith('/admin') ? 'admin' : 'rsvp');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (target: 'rsvp' | 'admin') => {
    const nextPath = target === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(target);
  };

  return (
    <ErrorBoundary>
      <div className="relative min-h-[100dvh] w-full overflow-x-hidden">
        <CoffeeBackdrop />
        {route === 'admin' ? (
          <AdminDashboard onBackToRsvp={() => navigateTo('rsvp')} />
        ) : (
          <RsvpCarousel onOpenAdmin={() => navigateTo('admin')} />
        )}
      </div>
    </ErrorBoundary>
  );
}
