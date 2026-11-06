import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { syncFilterDoc } from '../src/app/api/ai/spec/instructions/filterDoc';

const DOC_PATH = join(
  process.cwd(),
  'src/app/api/ai/spec/instructions/endpointsDocumentation.json'
);

const current = JSON.parse(readFileSync(DOC_PATH, 'utf-8')) as Array<
  Record<string, unknown>
>;
writeFileSync(DOC_PATH, `${JSON.stringify(syncFilterDoc(current), null, 2)}\n`);
process.stdout.write(`endpointsDocumentation.json sincronizado: ${DOC_PATH}\n`);
