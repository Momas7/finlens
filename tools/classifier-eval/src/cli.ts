import { writeFileSync } from 'node:fs';
import { DATASET } from './dataset';
import { run, toMarkdown } from './run';

const MIN_AUTO_PRECISION = 0.95;
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out =
  outIndex >= 0 ? args[outIndex + 1] : new URL('../../../docs/classifier-eval.md', import.meta.url);

const report = run(DATASET);
writeFileSync(out as string | URL, toMarkdown(report, new Date().toISOString().slice(0, 10)));
console.log(
  `auto ${report.auto}/${report.total} (precisão ${report.autoPrecision}), provável ${report.likely} (precisão ${report.likelyPrecision}), sugestão ${report.suggested}, nada ${report.none}`,
);

if (args.includes('--check') && report.autoPrecision < MIN_AUTO_PRECISION) {
  console.error(`Precisão do automático ${report.autoPrecision} abaixo de ${MIN_AUTO_PRECISION}.`);
  process.exit(1);
}
