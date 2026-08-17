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
            background: '#1e2148',
            color: '#f3f2ff',
            border: '1px solid #34397a',
            fontFamily: 'Cairo, sans-serif',
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
);
