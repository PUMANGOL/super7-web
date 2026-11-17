import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { PROOF_ACCEPT, PROOF_FORMATS } from '../../catalog/paymentProof';
import type { IconName } from '../../catalog/types';
import type { BankTransferDetails } from '../../config/store';
import { formatKz } from '../../utils/format';
import { Icon } from './Icon';

interface CopyButtonProps {
  /** Texto copiado (o IBAN sem espaços, o montante só com algarismos). */
  text: string;
  /** "Copiar o IBAN": nome do botão para leitores de ecrã. */
  label: string;
  /** "IBAN copiado": aviso depois de copiar. */
  done: string;
}

/** Copia um dado da conta para colar na aplicação do banco; mostra "Copiado" durante 2 segundos. */
function CopyButton({ text, label, done }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button type="button" className={copied ? 's7-copiar s7-copiar--feito' : 's7-copiar'} aria-label={label} onClick={copy}>
        <Icon name={copied ? 'check' : 'copiar'} />
        <span aria-hidden="true">{copied ? 'Copiado' : 'Copiar'}</span>
      </button>
      <span className="s7-sr" role="status">
        {copied ? done : ''}
      </span>
    </>
  );
}

interface BankTransferListProps {
  bank: BankTransferDetails;
  amount: number;
  /** Referência da compra, para a descrição da transferência (só existe depois de confirmar a encomenda). */
  reference?: string | null;
}

/**
 * Dados da transferência (definições da loja), em blocos: o IBAN em destaque, destinatário e banco lado a lado e o
 * montante (com a descrição, quando já há referência). Cada dado que se escreve no banco tem botão de copiar.
 */
export function BankTransferList({ bank, amount, reference }: BankTransferListProps) {
  const holderAndBank = Boolean(bank.holder && bank.bank);
  const item = (wide: boolean) => (wide ? 's7-transferencia__item s7-transferencia__item--largo' : 's7-transferencia__item');

  return (
    <dl className="s7-transferencia">
      <div className={`${item(true)} s7-transferencia__item--iban`}>
        <dt>IBAN</dt>
        <dd>
          <span className="s7-transferencia__iban">{bank.iban}</span>
          <CopyButton text={bank.iban.replace(/\s/g, '')} label="Copiar o IBAN" done="IBAN copiado" />
        </dd>
      </div>
      {bank.holder && (
        <div className={item(!holderAndBank)}>
          <dt>Destinatário</dt>
          <dd>
            <span>{bank.holder}</span>
            <CopyButton text={bank.holder} label="Copiar o destinatário" done="Destinatário copiado" />
          </dd>
        </div>
      )}
      {bank.bank && (
        <div className={item(!holderAndBank)}>
          <dt>Banco</dt>
          <dd>
            <span>{bank.bank}</span>
          </dd>
        </div>
      )}
      <div className={`${item(!reference)} s7-transferencia__item--montante`}>
        <dt>Montante a transferir</dt>
        <dd>
          <span>{formatKz(amount)}</span>
          <CopyButton text={String(amount)} label="Copiar o montante" done="Montante copiado" />
        </dd>
      </div>
      {reference && (
        <div className={item(false)}>
          <dt>Descrição da transferência</dt>
          <dd>
            <span>{reference}</span>
            <CopyButton text={reference} label="Copiar a descrição" done="Descrição copiada" />
          </dd>
        </div>
      )}
    </dl>
  );
}

/** PDF, imagem ou outro tipo (recusado: mostra a extensão, ex. "TXT", com um ícone de alerta). */
function fileKind(file: File): { label: string; icon: IconName } {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return { label: 'PDF', icon: 'recibo' };
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)) return { label: 'Imagem', icon: 'imagem' };
  const extension = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1];
  return { label: extension ? extension.toUpperCase() : 'Ficheiro', icon: 'alerta' };
}

/** 245 KB, 1,4 MB. */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

interface ProofFileInputProps {
  /** id do input (o rótulo do campo aponta para ele). */
  id: string;
  file: File | null;
  invalid?: boolean;
  describedBy?: string;
  onChange: (file: File | null) => void;
}

/**
 * Comprovativo da transferência: zona para escolher ou largar o ficheiro (o input nativo fica escondido, mas é ele
 * que recebe o foco do teclado). Com ficheiro escolhido mostra o nome, o tipo e o tamanho, e deixa trocar ou remover.
 */
export function ProofFileInput({ id, file, invalid = false, describedBy, onChange }: ProofFileInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Ficheiro recusado ou removido: o input volta a vazio, para se poder escolher o mesmo ficheiro outra vez.
  useEffect(() => {
    if (!file && input.current) input.current.value = '';
  }, [file]);

  const pick = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0] ?? null);

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onChange(dropped);
  };

  const leave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };

  const remove = () => {
    onChange(null);
    input.current?.focus();
  };

  const classes = ['s7-ficheiro'];
  if (dragging) classes.push('s7-ficheiro--arrastar');
  if (invalid) classes.push('s7-ficheiro--erro');
  if (file) classes.push('s7-ficheiro--escolhido');

  return (
    <div
      className={classes.join(' ')}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={leave}
      onDrop={drop}
    >
      <input
        ref={input}
        id={id}
        className="s7-ficheiro__input"
        type="file"
        accept={PROOF_ACCEPT}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={pick}
      />
      {file ? (
        <div className="s7-ficheiro__zona">
          <span className="s7-ficheiro__ico">
            <Icon name={fileKind(file).icon} />
          </span>
          <span className="s7-ficheiro__texto">
            <strong>{file.name}</strong>
            <small>
              {fileKind(file).label} · {formatSize(file.size)}
            </small>
          </span>
          <span className="s7-ficheiro__accoes">
            <label htmlFor={id} className="s7-copiar">
              Trocar
            </label>
            <button type="button" className="s7-copiar s7-copiar--remover" onClick={remove}>
              Remover
            </button>
          </span>
        </div>
      ) : (
        <label htmlFor={id} className="s7-ficheiro__zona">
          <span className="s7-ficheiro__ico">
            <Icon name="upload" />
          </span>
          <span className="s7-ficheiro__texto">
            <strong>
              <span className="s7-ficheiro__link">Escolher ficheiro</span> ou arrastar para aqui
            </strong>
            <small>{PROOF_FORMATS}</small>
          </span>
        </label>
      )}
    </div>
  );
}
