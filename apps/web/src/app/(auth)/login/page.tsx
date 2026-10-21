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
  const [secondStep, setSecondStep] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    if (secondStep) {
      const code = String(form.get('code') ?? '').trim();
      const { error: codeError } = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code });
      setPending(false);
      if (codeError) {
        // Desafio vencido (10 min) ou esgotado (5 erros): o código certo também falharia.
        if (/TWO_FACTOR_COOKIE|TOO_MANY_ATTEMPTS/.test(String(codeError.code))) {
          setSecondStep(false);
          setUseBackup(false);
          setError('Sua verificação expirou. Entre de novo.');
          return;
        }
        setError(
          codeError.status === 429
            ? 'Muitas tentativas. Tente novamente em instantes.'
            : 'Código inválido.',
        );
        return;
      }
      router.replace('/painel');
      router.refresh();
      return;
    }
    const { data, error: signInError } = await authClient.signIn.email({
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
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      setSecondStep(true);
      return;
    }
    router.replace('/painel');
    router.refresh();
  }

  if (secondStep) {
    return (
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Confirme que é você</h1>
        <p className="mt-1 text-ink-soft">
          {useBackup
            ? 'Digite um dos seus códigos de reserva. Cada um vale uma vez.'
            : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'}
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <Field
            key={useBackup ? 'backup' : 'totp'}
            label={useBackup ? 'Código de reserva' : 'Código do aplicativo'}
            name="code"
            autoComplete="one-time-code"
            inputMode={useBackup ? 'text' : 'numeric'}
            autoFocus
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
        <button
          type="button"
          onClick={() => {
            setSecondStep(false);
            setUseBackup(false);
            setError(null);
          }}
          className="mt-6 mr-6 text-[13px] text-ink-soft underline underline-offset-4"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => {
            setUseBackup(!useBackup);
            setError(null);
          }}
          className="mt-6 text-[13px] font-medium text-ink underline underline-offset-4"
        >
          {useBackup ? 'Usar o código do aplicativo' : 'Usar código de reserva'}
        </button>
      </div>
    );
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
