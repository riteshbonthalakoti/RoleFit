import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/app.css';
import { ReportApp } from './ReportApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReportApp />
  </React.StrictMode>,
);
