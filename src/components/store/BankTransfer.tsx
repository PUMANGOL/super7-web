import { useState } from 'react';
import type { BankTransferDetails } from '../../config/store';
import { formatKz } from '../../utils/format';

interface BankTransferListProps {
  bank: BankTransferDetails;
  amount: number;
  /** Referência da compra, para a descrição da transferência (só existe depois de confirmar a encomenda). */
  reference?: string | null;
}

/** Dados da transferência (definições da loja): montante, IBAN com botão de copiar, destinatário e banco. */
export function BankTransferList({ bank, amount, reference }: BankTransferListProps) {
  const [copied, setCopied] = useState(false);

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(bank.iban.replace(/\s/g, ''));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dl className="s7-referencia s7-transferencia">
      <dt>Montante</dt>
      <dd>{formatKz(amount)}</dd>
      <dt>IBAN</dt>
      <dd className="s7-iban">
        <span>{bank.iban}</span>
        <button type="button" className="s7-ligacao" onClick={copyIban}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </dd>
      {bank.holder && (
        <>
          <dt>Destinatário</dt>
          <dd>{bank.holder}</dd>
        </>
      )}
      {bank.bank && (
        <>
          <dt>Banco</dt>
          <dd>{bank.bank}</dd>
        </>
      )}
      {reference && (
        <>
          <dt>Descrição</dt>
          <dd>{reference}</dd>
        </>
      )}
    </dl>
  );
}
