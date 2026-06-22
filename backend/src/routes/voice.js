import { Router } from 'express';
import { parseVoiceCommand, transcribeAudio } from '../services/voiceParser.js';

const router = Router();

/** 텍스트 음성 명령 파싱 (Web Speech API 결과 또는 직접 입력) */
router.post('/parse', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text 필드가 필요합니다.' });
    const result = await parseVoiceCommand(text);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** 오디오 파일 → Whisper STT → 파싱 */
router.post('/transcribe', async (req, res, next) => {
  try {
    const { audio, mimetype } = req.body;
    if (!audio) return res.status(400).json({ error: 'audio (base64) 필드가 필요합니다.' });
    const buffer = Buffer.from(audio, 'base64');
    const text = await transcribeAudio(buffer, mimetype);
    const result = await parseVoiceCommand(text);
    res.json({ text, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
