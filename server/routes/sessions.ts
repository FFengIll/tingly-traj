// API routes for sessions
import { Router } from 'express';
import { claudeFsService } from '../services/claude-fs.service.js';

const router = Router();

// GET /api/sessions - List sessions with optional filters
router.get('/', async (req, res) => {
  try {
    const { project, search, limit, offset } = req.query;

    const sessions = await claudeFsService.getSessionInfos({
      project: project as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:id - Get session detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { project } = req.query;

    if (!project) {
      return res.status(400).json({ error: 'Project query parameter is required' });
    }

    console.log(`Fetching session: ${id}, project: ${project}`);

    const session = await claudeFsService.getSessionDetail(id, project as string);

    console.log(`Session result:`, session ? 'found' : 'not found');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
