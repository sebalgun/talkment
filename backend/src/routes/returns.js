import { Router } from 'express';
import { searchUnreturned, processReturn } from '../services/returnService.js';

const router = Router();

router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q 쿼리 파라미터가 필요합니다.' });
    const items = await searchUnreturned(q);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { item } = req.body;
    if (!item) return res.status(400).json({ error: 'item 필드가 필요합니다.' });
    const result = await processReturn(item);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
