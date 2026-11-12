import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { SchedulingService, findAvailableSlots } from './scheduling.service';
import { SchedulingRepository } from './scheduling.repository';
import { createTimeBlockSchema, suggestSlotsQuerySchema } from './scheduling.schema';

describe('Scheduling Module', () => {
  describe('Schemas', () => {
    it('validates createTimeBlockSchema and rejects inverted ranges', () => {
      const valid = createTimeBlockSchema.parse({
        title: 'Deep Work',
        startTime: '2026-11-12T09:00:00.000Z',
        endTime: '2026-11-12T10:30:00.000Z',
      });
      expect(valid.category).toBe('WORK');

      expect(() =>
        createTimeBlockSchema.parse({
          title: 'Invalid',
          startTime: '2026-11-12T11:00:00.000Z',
          endTime: '2026-11-12T10:00:00.000Z',
        })
      ).toThrow();
    });

    it('validates suggestSlotsQuerySchema', () => {
      const query = suggestSlotsQuerySchema.parse({
        date: '2026-11-12',
        durationMinutes: '45',
        tzOffsetMinutes: '-330',
      });
      expect(query.durationMinutes).toBe(45);
      expect(query.dayStartHour).toBe(8);
      expect(query.dayEndHour).toBe(20);
      expect(query.tzOffsetMinutes).toBe(-330);
    });
  });

  describe('SchedulingService', () => {
    it('throws SCHEDULING_CONFLICT when overlapping block exists', async () => {
      const mockRepo = {
        findOverlapping: vi.fn().mockResolvedValue([{ id: 'existing-1' }]),
      } as unknown as SchedulingRepository;
      const service = new SchedulingService(mockRepo);

      await expect(
        service.createTimeBlock('user-1', {
          title: 'Meeting',
          startTime: new Date('2026-11-12T09:00:00.000Z'),
          endTime: new Date('2026-11-12T10:00:00.000Z'),
          category: 'MEETING',
          status: 'SCHEDULED',
          isRecurring: false,
          allowOverlap: false,
        })
      ).rejects.toThrow('Time block conflicts with an existing scheduled block');
    });

    it('finds available non-overlapping slots in a day window', () => {
      const windowStart = new Date('2026-11-12T08:00:00.000Z');
      const windowEnd = new Date('2026-11-12T14:00:00.000Z');
      const slots = findAvailableSlots(
        [
          {
            startTime: new Date('2026-11-12T09:00:00.000Z'),
            endTime: new Date('2026-11-12T11:00:00.000Z'),
          },
          {
            startTime: new Date('2026-11-12T11:30:00.000Z'),
            endTime: new Date('2026-11-12T12:00:00.000Z'),
          },
        ],
        windowStart,
        windowEnd,
        60
      );

      expect(slots).toHaveLength(2);
      expect(slots[0]?.durationMinutes).toBe(60);
      expect(slots[1]?.durationMinutes).toBe(120);
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/scheduling/blocks requires authentication', async () => {
      const response = await request(app).get('/api/v1/scheduling/blocks');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
