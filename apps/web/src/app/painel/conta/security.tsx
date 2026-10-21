'use client';

import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';

type Setup = { uri: string; secret: string; qr: string; codes: string[] };
type Mode = 'idle' | 'enable' | 'codes' | 'disable';

function Codes({ codes }: { codes: string[] }) {
  const text = codes.join('\n');
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finlens-codigos-de-reserva.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Guarde estes códigos de reserva num lugar seguro. Cada um vale uma vez e eles não aparecem
        de novo.
      </p>
      <ul className="figure grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 text-[15px]">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={download}>
          Baixar códigos
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigator.clipboard?.writeText(text)}
        >
          Copiar códigos
        </Button>
      </div>
    </div>
  );
}

export function SecuritySection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [fresh, setFresh] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const password = (form: HTMLFormElement) => String(new FormData(form).get('password') ?? '');

  async function startEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { data, error: err } = await authClient.twoFactor.enable({
      password: password(event.currentTarget),
    });
    setPending(false);
    if (err || !data || !('totpURI' in data) || !data.totpURI) {
      setError('Senha incorreta.');
      return;
    }
    const secret = new URL(data.totpURI).searchParams.get('secret') ?? '';
    setSetup({
      uri: data.totpURI,
      secret,
      qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }),
      codes: data.backupCodes ?? [],
    });
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) {
      setError('Código inválido.');
      return;
    }
    setSetup(null);
    setMode('idle');
    setDone('2FA ativado. Da próxima vez, o login pede o código do aplicativo.');
    router.refresh();
  }

  async function regenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { data, error: err } = await authClient.twoFactor.generateBackupCodes({
      password: password(event.currentTarget),
    });
    setPending(false);
    if (err || !data) {
      setError('Senha incorreta.');
      return;
    }
    setFresh(data.backupCodes);
    setMode('idle');
    router.refresh();
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.disable({
      password: password(event.currentTarget),
    });
    setPending(false);
    if (err) {
      setError('Senha incorreta.');
      return;
    }
    setMode('idle');
    setDone('2FA desativado.');
    router.refresh();
  }

  const cancel = () => {
    setMode('idle');
    setSetup(null);
    setError(null);
  };
  const passwordField = (
    <Field
      label="Senha atual"
      name="password"
      type="password"
      autoComplete="current-password"
      error={error ?? undefined}
      required
    />
  );

  return (
    <div className="space-y-4">
      <p role="status">
        <strong>{enabled ? 'Ativado' : 'Desativado'}</strong>
        {done && <span className="ml-2 text-ink-soft">{done}</span>}
      </p>

      {fresh && <Codes codes={fresh} />}

      {setup ? (
        <div className="space-y-5">
          <ol className="list-decimal space-y-4 pl-5 text-[15px]">
            <li className="space-y-2">
              Abra seu aplicativo autenticador e escaneie o QR code, ou digite a chave.
              {/* biome-ignore lint/performance/noImgElement: data URL gerada no navegador */}
              <img
                src={setup.qr}
                alt="QR code para o aplicativo autenticador"
                width={192}
                height={192}
              />
              <p>
                Chave: <code className="figure break-all">{setup.secret}</code>
              </p>
            </li>
            <li>
              <Codes codes={setup.codes} />
            </li>
            <li>
              <form onSubmit={confirmCode} className="max-w-xs space-y-3" noValidate>
                <Field
                  label="Código do aplicativo"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  error={error ?? undefined}
                />
                <div className="flex gap-3">
                  <Button type="submit" disabled={pending}>
                    Confirmar e ativar
                  </Button>
                  <Button type="button" variant="ghost" onClick={cancel}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </li>
          </ol>
        </div>
      ) : mode === 'idle' ? (
        <div className="flex flex-wrap gap-3">
          {enabled ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setMode('codes')}>
                Gerar novos códigos de reserva
              </Button>
              <Button type="button" variant="secondary" onClick={() => setMode('disable')}>
                Desativar 2FA
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => setMode('enable')}>
              Ativar 2FA
            </Button>
          )}
        </div>
      ) : (
        <form
          onSubmit={mode === 'enable' ? startEnable : mode === 'codes' ? regenerate : disable}
          className="max-w-xs space-y-3"
          noValidate
        >
          <p className="text-[13px] text-ink-soft">
            {mode === 'enable'
              ? 'Confirme sua senha para começar.'
              : mode === 'codes'
                ? 'Os códigos antigos deixam de valer.'
                : 'Sem o 2FA, a senha passa a ser o único fator.'}
          </p>
          {passwordField}
          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {mode === 'enable' ? 'Continuar' : mode === 'codes' ? 'Gerar códigos' : 'Desativar'}
            </Button>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
