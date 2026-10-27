// Keep this direct import: Vercel uses it to detect the Express framework.
import express from 'express';
import { createApp } from './server/app.js';

// Vercel recognizes this file as the single Express Function entry point.
void express;
export default createApp();
