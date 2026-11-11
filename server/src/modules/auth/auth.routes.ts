import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { AuthController } from './auth.controller';
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();
const controller = new AuthController();

router.post('/register', validateRequest({ body: registerSchema }), controller.register);
router.post('/login', validateRequest({ body: loginSchema }), controller.login);
router.post('/refresh', validateRequest({ body: refreshTokenSchema }), controller.refresh);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.patch(
  '/me',
  requireAuth,
  validateRequest({ body: updateProfileSchema }),
  controller.updateMe
);

export const authRouter = router;
