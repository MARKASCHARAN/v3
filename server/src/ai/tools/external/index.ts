import { V3ToolContract } from '../tool.types';
import { COMMUNICATION_EXTERNAL_TOOLS } from './communication.tools';
import { DEVELOPER_EXTERNAL_TOOLS } from './developer.tools';

export const EXTERNAL_TOOLS: V3ToolContract[] = [
  ...COMMUNICATION_EXTERNAL_TOOLS,
  ...DEVELOPER_EXTERNAL_TOOLS,
];
