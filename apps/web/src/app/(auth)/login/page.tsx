'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setPending(false);
    if (signInError) {
      setError(
        signInError.status === 429
          ? 'Muitas tentativas. Tente novamente em instantes.'
          : 'E-mail ou senha inválidos.',
      );
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-ink-soft">Continue de onde parou.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p role="alert" className="text-[13px] text-mark">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-[13px] text-ink-soft">
        Ainda não tem conta?{' '}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
