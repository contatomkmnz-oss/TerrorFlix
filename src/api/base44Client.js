/**
 * Cliente de dados local (substitui @base44/sdk).
 * Todo o app usa `base44` como antes; a implementação é 100% mock + localStorage.
 */
import { localMockClient } from '@/api/localMockClient';

export const base44 = localMockClient;
