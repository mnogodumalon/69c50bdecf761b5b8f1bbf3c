import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import TestfallErfassungPage from '@/pages/TestfallErfassungPage';

const TestfallDurchfuehrenPage = lazy(() => import('@/pages/intents/TestfallDurchfuehrenPage'));
const FehlerMeldenPage = lazy(() => import('@/pages/intents/FehlerMeldenPage'));

export default function App() {
  return (
    <HashRouter>
      <ActionsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="testfall-erfassung" element={<TestfallErfassungPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="intents/testfall-durchfuehren" element={<Suspense><TestfallDurchfuehrenPage /></Suspense>} />
            <Route path="intents/fehler-melden" element={<Suspense><FehlerMeldenPage /></Suspense>} />
          </Route>
        </Routes>
      </ActionsProvider>
    </HashRouter>
  );
}
