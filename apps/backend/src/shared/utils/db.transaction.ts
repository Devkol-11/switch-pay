import { Prisma } from '../../generated/prisma/client';
import { getClient } from '../../providers/db';

export type TransactionClient = Prisma.TransactionClient;

type TransactionCallback<T> = (trx: TransactionClient) => Promise<T>;

export async function dbTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const db = getClient();

    return db.$transaction(
        async (trx) => {
            return callback(trx);
        },
        {
            maxWait: 5_000,
            timeout: 15_000,
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
        }
    );
}
