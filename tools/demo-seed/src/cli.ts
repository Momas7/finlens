import { todayInSaoPaulo } from '@finlens/domain';
import { DEMO_EMAIL, DEMO_PASSWORD, generateDemo } from './generate';
import { httpClient, runDemoSeed } from './run';

const apiUrl = process.env.DEMO_API_URL ?? process.env.API_URL ?? 'http://localhost:3333';
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

const result = await runDemoSeed(httpClient(apiUrl, origin), generateDemo(todayInSaoPaulo()));
console.log(
  result.created
    ? `Conta demo criada: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (dados fictícios, só para uso local).`
    : `Conta demo já existe: ${DEMO_EMAIL}.`,
);
