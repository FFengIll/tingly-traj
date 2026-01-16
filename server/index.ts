// Express server for cc-pick
import express from 'express';
import cors from 'cors';
import sessionRoutes from './routes/sessions.js';
import projectRoutes from './routes/projects.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/projects', projectRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`cc-pick server running on http://localhost:${PORT}`);
});
