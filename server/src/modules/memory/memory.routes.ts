import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { MemoryController } from './memory.controller';
import {
  contextQuerySchema,
  conversationQuerySchema,
  createConversationMessageSchema,
  createMemorySchema,
  memoryIdParamSchema,
  memoryQuerySchema,
  preferenceKeyParamSchema,
  updateMemorySchema,
  upsertPreferenceSchema,
} from './memory.schema';

const router = Router();
const controller = new MemoryController();

router.use(requireAuth);

router.get('/context', validateRequest({ query: contextQuerySchema }), controller.getContext);

router.get('/preferences', controller.getPreferences);
router.put(
  '/preferences',
  validateRequest({ body: upsertPreferenceSchema }),
  controller.upsertPreference
);
router.delete(
  '/preferences/:key',
  validateRequest({ params: preferenceKeyParamSchema }),
  controller.removePreference
);

router.get(
  '/conversations',
  validateRequest({ query: conversationQuerySchema }),
  controller.getConversations
);
router.post(
  '/conversations',
  validateRequest({ body: createConversationMessageSchema }),
  controller.appendMessage
);
router.delete(
  '/conversations',
  validateRequest({ query: conversationQuerySchema }),
  controller.clearConversations
);

router.get('/', validateRequest({ query: memoryQuerySchema }), controller.getMemories);
router.post('/', validateRequest({ body: createMemorySchema }), controller.createMemory);
router.get('/:id', validateRequest({ params: memoryIdParamSchema }), controller.getMemory);
router.patch(
  '/:id',
  validateRequest({ params: memoryIdParamSchema, body: updateMemorySchema }),
  controller.updateMemory
);
router.delete('/:id', validateRequest({ params: memoryIdParamSchema }), controller.removeMemory);

export const memoryRouter = router;
