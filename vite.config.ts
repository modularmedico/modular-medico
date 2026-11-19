import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' works on Vercel, GitHub Pages and any static host
export default defineConfig({ base: './', plugins: [react()], test: { include: ['tests/**/*.test.ts'] } });
