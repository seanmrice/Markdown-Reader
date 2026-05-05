import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';

window.addEventListener('error', (event) => {
  window.api.reportError({
    message: event.message,
    stack: event.error?.stack,
    type: 'uncaught_exception',
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  window.api.reportError({
    message: reason?.message ?? String(reason),
    stack: reason?.stack,
    type: 'unhandled_rejection',
  });
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
