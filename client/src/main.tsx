import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#14152b',
            border: '1px solid #e1e2ee',
            boxShadow: '0 8px 24px -8px rgba(20, 21, 43, 0.15)',
            fontFamily: 'Cairo, sans-serif',
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
);
