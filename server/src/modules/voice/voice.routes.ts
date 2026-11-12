import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { VoiceController } from './voice.controller';
import {
  startVoiceSessionSchema,
  synthesizeVoiceSchema,
  telephonyWebhookSchema,
  transcribeVoiceSchema,
  translateVoiceSchema,
  voiceCommandSchema,
  voiceSessionIdParamSchema,
  voiceSessionsQuerySchema,
} from './voice.schema';

const router = Router();
const controller = new VoiceController();

router.use(requireAuth);

router.get(
  '/sessions',
  validateRequest({ query: voiceSessionsQuerySchema }),
  controller.listSessions
);
router.post(
  '/sessions',
  validateRequest({ body: startVoiceSessionSchema }),
  controller.startSession
);
router.get(
  '/sessions/:id',
  validateRequest({ params: voiceSessionIdParamSchema }),
  controller.getSession
);
router.post('/transcribe', validateRequest({ body: transcribeVoiceSchema }), controller.transcribe);
router.post('/translate', validateRequest({ body: translateVoiceSchema }), controller.translate);
router.post('/synthesize', validateRequest({ body: synthesizeVoiceSchema }), controller.synthesize);
router.post('/command', validateRequest({ body: voiceCommandSchema }), controller.processCommand);
router.post(
  '/telephony/webhook',
  validateRequest({ body: telephonyWebhookSchema }),
  controller.telephonyWebhook
);

export const voiceRouter = router;
