import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Layout from './components/Layout';
import SessionList from './components/SessionList';
import SessionDetail from './components/SessionDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onProjectChange={setSelectedProject} onSearchChange={setSearchQuery} />}>
            <Route index element={<SessionList selectedProject={selectedProject} searchQuery={searchQuery} />}></Route>
            <Route path="session/:sessionId" element={<SessionDetail />}></Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
