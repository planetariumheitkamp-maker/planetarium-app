import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/primitives';
import Home from '@/pages/Home';
import Player from '@/pages/Player';
import Editor from '@/pages/Editor';
import Library from '@/pages/Library';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Marketing */}
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        {/* Tool pages share the AppShell (nested-route pattern) */}
        <Route element={<AppShell />}>
          <Route path="/player" element={<Player />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/library" element={<Library />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
