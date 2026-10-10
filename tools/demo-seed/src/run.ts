import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_PASSWORD,
  type DemoAccountName,
  type DemoPlan,
} from './generate';

export type DemoClient = (
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
) => Promise<{ status: number; json: unknown }>;

type Node = { id: string; name: string; children: Node[] };

async function expectOk(
  client: DemoClient,
  method: 'POST' | 'PUT',
  path: string,
  body: unknown,
): Promise<unknown> {
  const res = await client(method, path, body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${method} ${path} respondeu ${res.status}: ${JSON.stringify(res.json)}`);
  }
  return res.json;
}

/** Cria a conta demo pela API (classificação e aprendizado de verdade). Não faz nada se já existir. */
export async function runDemoSeed(
  client: DemoClient,
  plan: DemoPlan,
): Promise<{ created: boolean }> {
  const credentials = { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  const signIn = await client('POST', '/api/auth/sign-in/email', credentials);
  if (signIn.status === 200) return { created: false };
  await expectOk(client, 'POST', '/api/auth/sign-up/email', { ...credentials, name: DEMO_NAME });

  const tree = (await client('GET', '/v1/categories')).json as Node[];
  const categories = new Map<string, string>();
  for (const root of tree) {
    categories.set(root.name, root.id);
    for (const child of root.children) categories.set(`${root.name} › ${child.name}`, child.id);
  }
  const categoryId = (label: string) => {
    const id = categories.get(label);
    if (!id) throw new Error(`Categoria inexistente na demo: ${label}`);
    return id;
  };

  const accounts = new Map<DemoAccountName, string>();
  for (const { name, ...rest } of plan.accounts) {
    const created = (await expectOk(client, 'POST', '/v1/accounts', { name, ...rest })) as {
      id: string;
    };
    accounts.set(name, created.id);
  }

  for (const r of plan.rules) {
    await expectOk(client, 'POST', '/v1/classification-rules', {
      pattern: r.pattern,
      categoryId: categoryId(r.category),
    });
  }

  for (const t of plan.transactions) {
    await expectOk(client, 'POST', '/v1/transactions', {
      accountId: accounts.get(t.account),
      postedDate: t.postedDate,
      amountCents: t.amountCents,
      description: t.description,
      categoryId:
        t.category === 'auto' || t.category === null ? t.category : categoryId(t.category),
    });
  }

  for (const b of plan.budgets) {
    await expectOk(client, 'PUT', `/v1/budgets/${categoryId(b.category)}`, {
      amountCents: b.amountCents,
    });
  }
  for (const { account, ...goal } of plan.goals) {
    await expectOk(client, 'POST', '/v1/goals', { ...goal, accountId: accounts.get(account) });
  }
  return { created: true };
}

/** Cliente HTTP com cookie de sessão; `origin` é exigido pelo Better Auth nas rotas de auth. */
export function httpClient(baseUrl: string, origin: string): DemoClient {
  let cookie = '';
  return async (method, path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        origin,
        ...(cookie && { cookie }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.getSetCookie();
    if (set.length > 0) cookie = set.map((c) => c.split(';')[0]).join('; ');
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null };
  };
}
