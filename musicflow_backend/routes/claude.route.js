// routes/claude.route.js
import { Router } from 'express';
import { askClaude } from '../services/claude.service.js';

const router = Router();

/**
 * POST /ask
 * Body: { prompt: string } hoặc { messages: array }
 * Trả về: { result: string }
 */
router.post('/ask', async (req, res) => {
  try {
    const { prompt, messages } = req.body;

    if (!prompt && !messages) {
      return res.status(400).json({ error: 'Missing prompt or messages' });
    }

    // Ưu tiên messages nếu có, nếu không dùng prompt
    const input = messages || prompt;

    const result = await askClaude(input);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
