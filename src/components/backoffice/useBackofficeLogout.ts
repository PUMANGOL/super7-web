import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';

/**
 * Termina a sessão e volta ao login (e não à loja): num computador partilhado, a pessoa seguinte entra logo.
 * `replace` impede que o botão "Retroceder" reabra a página do back-office.
 */
export function useBackofficeLogout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();

  return useCallback(() => {
    logout();
    showToast('Sessão terminada.');
    navigate('/login', { replace: true });
  }, [logout, showToast, navigate]);
}
