import React, { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../../hooks/useData';
import FullPageSpinner from './FullPageSpinner';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // useData() debe estar disponible porque Layout está dentro de DataProvider en index.tsx
  const { isLoading } = useData();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 w-full" style={{ maxWidth: '100%', overflowX: 'hidden', width: '100%' }}>
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full md:pl-16 transition-all duration-300" style={{ maxWidth: '100%', overflowX: 'hidden', width: '100%' }}>
        <Header setIsSidebarOpen={setIsSidebarOpen} />
        <main className="flex-1 overflow-x-hidden bg-slate-50 dark:bg-slate-900 w-full" style={{ maxWidth: '100%', overflowX: 'hidden', width: '100%' }}>
          <div className="container mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 w-full max-w-full" style={{ maxWidth: '100%', overflowX: 'hidden', width: '100%' }}>
            {children}
          </div>
        </main>
      </div>
    </div >
  );
};

export default Layout;
