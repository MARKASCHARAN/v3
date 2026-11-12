import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { V3ToolContract } from '../ai/tools/tool.types';
import { executeGuardedTool } from './permission-guard';
import { deriveToolPolicyLabel, evaluateToolPermission } from './risk-policy';

describe('Permissions & Risk Policy Framework (M2.2)', () => {
  describe('Risk Policy Matrix', () => {
    it('evaluates all 5 risk levels and specialist role boundaries accurately', () => {
      expect(
        evaluateToolPermission({
          role: 'MAIN_ORCHESTRATOR',
          toolName: 'listTasks',
          riskLevel: 'READ',
        }).decision
      ).toBe('ALLOW');

      expect(
        evaluateToolPermission({
          role: 'MAIN_ORCHESTRATOR',
          toolName: 'createTask',
          riskLevel: 'INTERNAL_WRITE',
          allowAutoApproveWrites: false,
        }).decision
      ).toBe('REQUIRE_APPROVAL');

      expect(
        evaluateToolPermission({
          role: 'MAIN_ORCHESTRATOR',
          toolName: 'createTask',
          riskLevel: 'INTERNAL_WRITE',
          allowAutoApproveWrites: true,
        }).decision
      ).toBe('ALLOW');

      expect(
        evaluateToolPermission({
          role: 'MAIN_ORCHESTRATOR',
          toolName: 'sendExternalEmail',
          riskLevel: 'EXTERNAL_REVERSIBLE',
          allowAutoApproveWrites: true,
        }).decision
      ).toBe('REQUIRE_APPROVAL');

      expect(
        evaluateToolPermission({
          role: 'MAIN_ORCHESTRATOR',
          toolName: 'mergePullRequest',
          riskLevel: 'EXTERNAL_CONSEQUENTIAL',
          allowAutoApproveWrites: true,
        }).decision
      ).toBe('REQUIRE_APPROVAL');

      expect(
        evaluateToolPermission({
          role: 'MAIN_ORCHESTRATOR',
          toolName: 'deleteAccount',
          riskLevel: 'RESTRICTED',
          allowAutoApproveWrites: true,
        }).decision
      ).toBe('DENY');

      expect(
        evaluateToolPermission({
          role: 'MEMORY',
          toolName: 'createTask',
          riskLevel: 'INTERNAL_WRITE',
        }).decision
      ).toBe('DENY');

      expect(deriveToolPolicyLabel('READ')).toBe('AUTO_EXECUTE');
      expect(deriveToolPolicyLabel('EXTERNAL_CONSEQUENTIAL')).toBe('REQUIRE_APPROVAL');
    });
  });

  describe('Permission Guard Enforcement', () => {
    const sampleContract: V3ToolContract = {
      name: 'createTask',
      domain: 'tasks',
      description: 'Create task',
      riskLevel: 'INTERNAL_WRITE',
      idempotent: true,
      inputSchema: z.object({ title: z.string().min(1) }),
      outputSchema: z.object({ id: z.string(), title: z.string() }),
      execute: async (_ctx, input) => ({ id: 'task-1', title: (input as { title: string }).title }),
    };

    it('rejects unauthenticated contexts and cross-user target tampering', async () => {
      await expect(
        executeGuardedTool(
          sampleContract,
          { title: 'Test' },
          {
            userId: '',
            executionId: 'exec-1',
            agentRole: 'MAIN_ORCHESTRATOR',
          }
        )
      ).rejects.toThrow('Authenticated user context is required');

      await expect(
        executeGuardedTool(
          sampleContract,
          { title: 'Test', userId: 'user-2' },
          {
            userId: 'user-1',
            executionId: 'exec-1',
            agentRole: 'MAIN_ORCHESTRATOR',
          },
          { allowAutoApproveWrites: true }
        )
      ).rejects.toThrow('Tool arguments cannot target a different user');
    });

    it('rejects invalid input schemas and unapproved internal writes', async () => {
      await expect(
        executeGuardedTool(
          sampleContract,
          { title: 'Test' },
          {
            userId: 'user-1',
            executionId: 'exec-1',
            agentRole: 'MAIN_ORCHESTRATOR',
          },
          { allowAutoApproveWrites: false }
        )
      ).rejects.toThrow('requires human approval');

      await expect(
        executeGuardedTool(
          sampleContract,
          { title: '' },
          {
            userId: 'user-1',
            executionId: 'exec-1',
            agentRole: 'MAIN_ORCHESTRATOR',
          },
          { allowAutoApproveWrites: true }
        )
      ).rejects.toThrow();
    });

    it('returns cached output when idempotency key already executed', async () => {
      const executeSpy = vi.fn().mockResolvedValue({ id: 'task-new', title: 'Fresh' });
      const guardedContract: V3ToolContract = {
        ...sampleContract,
        execute: executeSpy,
      };

      const idempotencyStore = {
        findCompletedResult: vi
          .fn()
          .mockResolvedValue({ found: true, data: { id: 'task-cached', title: 'Cached' } }),
      };

      const result = await executeGuardedTool(
        guardedContract,
        { title: 'Fresh' },
        {
          userId: 'user-1',
          executionId: 'exec-1',
          agentRole: 'MAIN_ORCHESTRATOR',
          idempotencyKey: 'exec-1:tc-1',
        },
        { allowAutoApproveWrites: true, idempotencyStore }
      );

      expect(result).toEqual({ id: 'task-cached', title: 'Cached' });
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
