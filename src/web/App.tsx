import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Features from './pages/Features';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/features" element={<Features />} />
    </Routes>
  );
}
