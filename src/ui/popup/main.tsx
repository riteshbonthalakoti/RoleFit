import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/app.css';
import { PopupApp } from './PopupApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
