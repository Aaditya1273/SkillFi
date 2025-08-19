import daoAbi from '@/lib/abi/SkillFiDAO.json';
import tokenAbi from '@/lib/abi/SkillToken.json';
import escrowAbi from '@/lib/abi/SkillFiEscrow.json';

export type Address = `0x${string}`;

export const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS as Address | undefined;
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as Address | undefined;
export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as Address | undefined;

if (typeof window !== 'undefined') {
  if (!DAO_ADDRESS) {
    // eslint-disable-next-line no-console
    console.warn('NEXT_PUBLIC_DAO_ADDRESS not set');
  }
  if (!TOKEN_ADDRESS) {
    // eslint-disable-next-line no-console
    console.warn('NEXT_PUBLIC_TOKEN_ADDRESS not set');
  }
  if (!ESCROW_ADDRESS) {
    // eslint-disable-next-line no-console
    console.warn('NEXT_PUBLIC_ESCROW_ADDRESS not set');
  }
}

export const DAO_ABI = daoAbi;
export const TOKEN_ABI = tokenAbi;
export const ESCROW_ABI = escrowAbi;

export const DAO_CONTRACT: { address?: Address; abi: typeof daoAbi } = {
  address: DAO_ADDRESS,
  abi: DAO_ABI,
};

export const TOKEN_CONTRACT: { address?: Address; abi: typeof tokenAbi } = {
  address: TOKEN_ADDRESS,
  abi: TOKEN_ABI,
};

export const ESCROW_CONTRACT: { address?: Address; abi: typeof escrowAbi } = {
  address: ESCROW_ADDRESS,
  abi: ESCROW_ABI,
};
