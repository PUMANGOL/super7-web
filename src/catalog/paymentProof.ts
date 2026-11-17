/** Comprovativo da transferência (IBAN): os mesmos limites que a API (`POST /order/{id}/payment-proof`). */
export const PROOF_MAX_MB = 10;
export const PROOF_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const PROOF_TYPES = PROOF_ACCEPT.split(',');
/** Os formatos e o tamanho já aparecem na zona do ficheiro (ProofFileInput). */
export const PROOF_HELP = 'Uma fotografia nítida do talão também serve.';
export const PROOF_FORMATS = `PDF, JPG, PNG ou WebP · até ${PROOF_MAX_MB} MB`;

/** Mensagem de erro para um comprovativo que a API recusaria; null se o ficheiro serve. */
export function checkProofFile(file: File): string | null {
  if (!PROOF_TYPES.includes(file.type) && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
    return 'Escolha um PDF ou uma imagem (JPG, PNG ou WebP).';
  }
  if (file.size > PROOF_MAX_MB * 1024 * 1024) {
    return `O ficheiro tem mais de ${PROOF_MAX_MB} MB. Envie uma versão mais pequena.`;
  }
  return null;
}
