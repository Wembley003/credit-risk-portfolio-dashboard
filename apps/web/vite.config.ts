import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Base para GitHub Pages: https://wembley003.github.io/credit-risk-portfolio-dashboard/
export default defineConfig({
  base: '/credit-risk-portfolio-dashboard/',
  plugins: [react()],
});
