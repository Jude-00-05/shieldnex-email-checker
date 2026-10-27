import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('public', { recursive: true });
await writeFile(
  'public/server.ts',
  "import express from 'express';\nimport { createApp } from '../src/server/app.js';\n\n// Vercel scans the build output directory for the Express entry point.\nvoid express;\nexport default createApp();\n",
  'utf8'
);
