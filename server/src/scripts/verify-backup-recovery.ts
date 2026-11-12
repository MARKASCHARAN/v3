import { prisma } from '../database/prisma';

const REQUIRED_PUBLIC_TABLES = [
  'users',
  'goals',
  'milestones',
  'tasks',
  'time_blocks',
  'reminders',
  'accountability_logs',
  'memories',
  'user_preferences',
  'conversation_messages',
  'plans',
  'ai_executions',
  'ai_tool_approvals',
  'research_items',
  'domain_events',
  'background_jobs',
  'integration_accounts',
  'notification_preferences',
  'notification_deliveries',
  'voice_sessions',
];

const REQUIRED_LANGGRAPH_TABLES = [
  'checkpoints',
  'checkpoint_blobs',
  'checkpoint_writes',
  'checkpoint_migrations',
];

const REQUIRED_CUSTOM_INDEXES = ['memories_embedding_hnsw_idx', 'memories_fts_gin_idx'];

export interface BackupRecoveryVerificationReport {
  databaseConnected: boolean;
  missingPublicTables: string[];
  langgraphTablesPresent: string[];
  missingLanggraphTables: string[];
  customMemoryIndexesPresent: string[];
  missingCustomIndexes: string[];
  appliedMigrationsCount: number;
  verifiedAt: string;
}

export const runBackupRecoveryVerification =
  async (): Promise<BackupRecoveryVerificationReport> => {
    await prisma.$queryRawUnsafe('SELECT 1');

    const publicTableRows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const publicSet = new Set(publicTableRows.map((row) => row.tablename));
    const missingPublicTables = REQUIRED_PUBLIC_TABLES.filter((table) => !publicSet.has(table));

    const lgTableRows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'langgraph'`
    );
    const lgSet = new Set(lgTableRows.map((row) => row.tablename));
    const langgraphTablesPresent = REQUIRED_LANGGRAPH_TABLES.filter((table) => lgSet.has(table));
    const missingLanggraphTables = REQUIRED_LANGGRAPH_TABLES.filter((table) => !lgSet.has(table));

    const indexRows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'memories'`
    );
    const indexSet = new Set(indexRows.map((row) => row.indexname));
    const customMemoryIndexesPresent = REQUIRED_CUSTOM_INDEXES.filter((idx) => indexSet.has(idx));
    const missingCustomIndexes = REQUIRED_CUSTOM_INDEXES.filter((idx) => !indexSet.has(idx));

    const migrationRows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`
    );

    return {
      databaseConnected: true,
      missingPublicTables,
      langgraphTablesPresent,
      missingLanggraphTables,
      customMemoryIndexesPresent,
      missingCustomIndexes,
      appliedMigrationsCount: migrationRows.length,
      verifiedAt: new Date().toISOString(),
    };
  };

const isDirectExecution =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;

if (isDirectExecution) {
  runBackupRecoveryVerification()
    .then(async (report) => {
      console.log(JSON.stringify(report, null, 2));
      const hasMissing =
        report.missingPublicTables.length > 0 ||
        report.missingLanggraphTables.length > 0 ||
        report.missingCustomIndexes.length > 0;
      await prisma.$disconnect();
      process.exit(hasMissing ? 1 : 0);
    })
    .catch(async (error) => {
      console.error('Backup recovery verification failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
