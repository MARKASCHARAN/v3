import { RunnableConfig } from '@langchain/core/runnables';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';
import { aiConfig } from '../../config/ai.config';
import { env } from '../../config/env';

const { Pool } = pg;

let checkpointPool: pg.Pool | null = null;
let checkpointSaver: PostgresSaver | null = null;
let setupPromise: Promise<void> | null = null;

export const getCheckpointConnectionString = (): string => env.DIRECT_URL ?? env.DATABASE_URL;

export const getOrCreateCheckpointerInstance = (): PostgresSaver => {
  if (!checkpointPool) {
    checkpointPool = new Pool({
      connectionString: getCheckpointConnectionString(),
      max: 5,
    });
  }

  if (!checkpointSaver) {
    checkpointSaver = new PostgresSaver(checkpointPool, undefined, {
      schema: aiConfig.langgraphSchema,
    });
  }

  return checkpointSaver;
};

export const ensurePostgresCheckpointer = async (): Promise<PostgresSaver> => {
  const saver = getOrCreateCheckpointerInstance();
  if (!setupPromise) {
    setupPromise = saver.setup().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
  return saver;
};

export const checkCheckpointerHealth = async (): Promise<{
  ready: boolean;
  schema: string;
}> => {
  await ensurePostgresCheckpointer();
  return {
    ready: true,
    schema: aiConfig.langgraphSchema,
  };
};

export const closeCheckpointerPool = async (): Promise<void> => {
  if (checkpointPool) {
    const poolToClose = checkpointPool;
    checkpointPool = null;
    checkpointSaver = null;
    setupPromise = null;
    await poolToClose.end();
  }
};

export const buildCheckpointConfig = (
  threadId: string,
  checkpointNamespace?: string,
  runId?: string
): RunnableConfig => ({
  configurable: {
    thread_id: threadId,
    ...(checkpointNamespace ? { checkpoint_ns: checkpointNamespace } : {}),
  },
  ...(runId ? { runId } : {}),
});
