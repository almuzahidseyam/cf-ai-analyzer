import { createHandler } from '../../../lib/analysis.ts';
import { reserve } from '../../../lib/quota.ts';
import { source, model } from '../../../lib/providers.ts';

export const runtime = 'nodejs';
export const POST = createHandler({reserve,source,model,config:()=>({
  accessKey:process.env.ANALYZE_API_KEY || '', apiKey:process.env.GEMINI_API_KEY || '',
  model:process.env.GEMINI_MODEL || '', databasePath:process.env.ANALYZE_DB_PATH || '',
  dailyLimit:Number(process.env.ANALYZE_DAILY_LIMIT || '10')
})});
