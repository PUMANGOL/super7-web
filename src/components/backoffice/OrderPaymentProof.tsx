import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, XCircle } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { fetchPaymentProof, getOrderTotal } from '../../api/orders';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useUpdatePaymentStatus } from '../../hooks/useUpdatePaymentStatus';
import type { ApiOrder } from '../../types/api';
import { formatDate, formatPrice } from '../../utils/helpers';
import { ConfirmModal } from '../ui/ConfirmModal';

interface OrderPaymentProofProps {
  order: ApiOrder;
  onUpdated: (order: ApiOrder) => void;
}

/**
 * Pagamento por IBAN no detalhe da encomenda: ver o comprovativo enviado pelo cliente (PDF ou imagem, pedido com o
 * token e mostrado a partir de um blob) e confirmar ou recusar o pagamento (ADMIN, MANAGER, FINANCE).
 */
export function OrderPaymentProof({ order, onUpdated }: OrderPaymentProofProps) {
  const { can } = useAuth();
  const { showToast } = useToast();
  const { mutate, isPending, variables } = useUpdatePaymentStatus();
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofType, setProofType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const payment = order.payment;
  const pending = payment?.status === 'PENDING';
  const canDecide = can('confirmPayments') && pending;

  // Liberta o blob quando o comprovativo muda ou o painel fecha.
  useEffect(
    () => () => {
      if (proofUrl) URL.revokeObjectURL(proofUrl);
    },
    [proofUrl],
  );

  // Outro comprovativo enviado entretanto: o detalhe da encomenda muda a key e o painel recomeça.
  const uploadedAt = payment?.proofUploadedAt ?? null;

  if (!payment || payment.method !== 'IBAN') return null;
  if (!pending && !uploadedAt) return null;

  const openProof = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const blob = await fetchPaymentProof(order.id);
      setProofType(blob.type || payment.proofContentType || null);
      setProofUrl(URL.createObjectURL(blob));
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível abrir o comprovativo.'));
    } finally {
      setLoading(false);
    }
  };

  const decide = (status: 'PAID' | 'FAILED') =>
    mutate(
      { order, status },
      {
        onSuccess: (updated) => {
          setConfirmReject(false);
          onUpdated(updated);
          showToast(
            status === 'PAID'
              ? `Pagamento da encomenda ${updated.compraRef ?? ''} confirmado. O cliente recebe um e-mail.`
              : `Pagamento recusado: a encomenda ${updated.compraRef ?? ''} foi cancelada e o stock devolvido.`,
          );
        },
        onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível actualizar o pagamento.'), 'error'),
      },
    );

  const deciding = isPending && variables?.order.id === order.id;
  const isImage = proofType?.startsWith('image/');

  return (
    <div className="encomenda-comprovativo">
      <div className="encomenda-comprovativo__cabeca">
        <FileText size={16} />
        <div>
          <span className="encomenda-comprovativo__rotulo">Comprovativo da transferência</span>
          {uploadedAt ? (
            <span className="encomenda-comprovativo__valor">
              {payment.proofFileName ?? 'Comprovativo'} · enviado {formatDate(uploadedAt)}
            </span>
          ) : (
            <span className="encomenda-comprovativo__valor">Ainda não foi enviado pelo cliente</span>
          )}
          {pending && order.compraRef && (
            <span className="encomenda-sub">
              Confira no banco a transferência de {formatPrice(getOrderTotal(order))} com a descrição {order.compraRef}.
            </span>
          )}
        </div>
      </div>

      {uploadedAt && !proofUrl && (
        <button type="button" className="btn btn-outline btn-sm" onClick={openProof} disabled={loading}>
          {loading ? 'A abrir…' : 'Ver comprovativo'}
        </button>
      )}
      {loadError && <p className="encomenda-erro">{loadError}</p>}

      {proofUrl && (
        <div className="encomenda-comprovativo__ver">
          {isImage ? (
            <img src={proofUrl} alt={`Comprovativo da encomenda ${order.compraRef ?? ''}`} />
          ) : (
            <iframe src={proofUrl} title={`Comprovativo da encomenda ${order.compraRef ?? ''}`} />
          )}
          <a href={proofUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
            <ExternalLink size={14} /> Abrir num separador
          </a>
        </div>
      )}

      {canDecide && (
        <div className="encomenda-comprovativo__accoes">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => decide('PAID')} disabled={deciding}>
            <CheckCircle2 size={16} /> {deciding && variables?.status === 'PAID' ? 'A confirmar…' : 'Confirmar pagamento'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmReject(true)} disabled={deciding}>
            <XCircle size={16} /> Recusar
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmReject}
        onClose={() => !deciding && setConfirmReject(false)}
        onConfirm={() => decide('FAILED')}
        title="Recusar o pagamento"
        message={`Recusar o pagamento da encomenda ${order.compraRef ?? ''}? A encomenda é cancelada, o stock volta a ficar disponível e o cliente recebe um e-mail.`}
        confirmLabel="Recusar e cancelar"
        cancelLabel="Voltar"
        isPending={deciding}
        variant="danger"
      />
    </div>
  );
}
