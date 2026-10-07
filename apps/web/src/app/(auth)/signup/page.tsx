'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setPending(false);
    if (signUpError) {
      setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-1 text-ink-soft">Seus dados ficam na sua própria instância.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field label="Nome" name="name" autoComplete="name" required />
        <Field label="E-mail" name="email" type="email" autoComplete="email" required />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          hint="Mínimo de 10 caracteres."
          required
        />
        {error && (
          <p role="alert" className="text-[13px] text-mark">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-[13px] text-ink-soft">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </div>
  );
}
