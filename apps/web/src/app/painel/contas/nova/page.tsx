import { todayInSaoPaulo } from '@finlens/domain';
import { AccountForm } from '../account-form';

export default function NovaContaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold tracking-tight">Nova conta</h1>
      <AccountForm today={todayInSaoPaulo()} />
    </div>
  );
}
