import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { loginSchema, registerSchema, updateProfileSchema } from './auth.schema';
import { AppError } from '../../middleware/error.middleware';

describe('Auth Module', () => {
  describe('Schemas', () => {
    it('validates registerSchema', () => {
      const parsed = registerSchema.parse({
        email: '  user@example.com ',
        password: 'password123',
        name: 'Sai',
      });
      expect(parsed.email).toBe('user@example.com');
      expect(parsed.name).toBe('Sai');
    });

    it('rejects short password in registerSchema', () => {
      expect(() => registerSchema.parse({ email: 'user@example.com', password: '123' })).toThrow();
    });

    it('validates loginSchema and updateProfileSchema', () => {
      expect(loginSchema.parse({ email: 'u@example.com', password: 'secret' }).email).toBe(
        'u@example.com'
      );
      expect(updateProfileSchema.parse({ name: '  Updated Name ' }).name).toBe('Updated Name');
    });
  });

  describe('AuthService', () => {
    it('throws USER_NOT_FOUND when profile does not exist', async () => {
      const mockRepo = {
        findUserById: vi.fn().mockResolvedValue(null),
      } as unknown as AuthRepository;
      const service = new AuthService(mockRepo);

      await expect(service.getProfile('missing-user')).rejects.toBeInstanceOf(AppError);
    });

    it('updates profile when user exists', async () => {
      const updated = { id: 'user-1', email: 'u@example.com', name: 'New Name' };
      const mockRepo = {
        findUserById: vi.fn().mockResolvedValue({ id: 'user-1', email: 'u@example.com' }),
        updateUserName: vi.fn().mockResolvedValue(updated),
      } as unknown as AuthRepository;
      const service = new AuthService(mockRepo);

      const result = await service.updateProfile('user-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });

  describe('HTTP Routes', () => {
    it('POST /api/v1/auth/register returns 400 on invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'invalid', password: 'password123' });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/v1/auth/me requires authentication', async () => {
      const response = await request(app).get('/api/v1/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/v1/auth/logout requires authentication', async () => {
      const response = await request(app).post('/api/v1/auth/logout');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
