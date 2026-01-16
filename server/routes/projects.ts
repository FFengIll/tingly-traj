// API routes for projects
import { Router } from 'express';
import { claudeFsService } from '../services/claude-fs.service.js';

const router = Router();

// GET /api/projects - List all projects
router.get('/', async (req, res) => {
  try {
    const projects = await claudeFsService.getProjectSummaries();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

export default router;
