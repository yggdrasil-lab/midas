import React from 'react';
import ReactDOM from 'react-dom/client';
import '@yggdrasil-lab/ui/style.css';
import './index.css';
import { App } from './App';
import { CategoryProvider } from './hooks/useCategories';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CategoryProvider>
      <App />
    </CategoryProvider>
  </React.StrictMode>,
);
