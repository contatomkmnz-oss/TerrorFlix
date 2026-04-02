/**
 * Cliente de dados: mock local ou API real (Neon/Prisma) quando VITE_USE_REAL_API=true.
 */
import { localMockClient } from '@/api/localMockClient';
import { realApiClient } from '@/api/realApiClient';

const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';

export const base44 = useRealApi ? realApiClient : localMockClient;
