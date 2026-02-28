import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchApp } from './WorkbenchApp.jsx';

const root = createRoot(document.getElementById('root'));
root.render(<WorkbenchApp />);
