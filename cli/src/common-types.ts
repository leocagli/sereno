// common-types.ts — shared type aliases for the Sereno CLI.

import { Sereno, type SerenoPrivateState } from 'sereno-contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js/contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';

export type SerenoCircuits = ProvableCircuitId<Sereno.Contract<SerenoPrivateState>>;

export const SerenoPrivateStateId = 'serenoPrivateState';

export type SerenoProviders = MidnightProviders<SerenoCircuits, typeof SerenoPrivateStateId, SerenoPrivateState>;

export type SerenoContract = Sereno.Contract<SerenoPrivateState>;

export type DeployedSerenoContract = DeployedContract<SerenoContract> | FoundContract<SerenoContract>;
