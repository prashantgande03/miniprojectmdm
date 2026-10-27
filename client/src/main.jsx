import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './farmer.css';
import App from './FarmerApp.jsx';

createRoot(document.getElementById('root')).render(<App />);
