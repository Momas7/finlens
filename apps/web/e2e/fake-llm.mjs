// LLM falso para o e2e: responde no formato do /chat/completions da OpenAI.
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_LLM_PORT ?? 4040);

createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    if (req.url === '/health') {
      res.writeHead(200).end('ok');
      return;
    }
    const user = JSON.parse(body || '{"messages":[]}').messages?.at(-1)?.content ?? '';
    const answer = user.includes('LOJA COM IA')
      ? { category: 'Compras › Outras compras', confidence: 0.7 }
      : { category: null };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
  });
}).listen(port, '127.0.0.1');
