import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { EncryptedData } from './credentials.types';

export class CredentialEncryption {
    private readonly algorithm = 'aes-256-gcm';
    private readonly keyLength = 32; // 256 bits
    private readonly ivLength = 16;
    private readonly authTagLength = 16;

    constructor(private masterKey: string) {}

    generateDEK(): Buffer {
        return randomBytes(this.keyLength);
    }

    generateIV(): Buffer {
        return randomBytes(this.ivLength);
    }
    encryptSecret(plaintext: string): EncryptedData {
        try {
            const dek = this.generateDEK();

            const iv = this.generateIV();
            const cipher = createCipheriv(this.algorithm, dek, iv);

            let ciphertext = cipher.update(plaintext, 'utf8');
            ciphertext = Buffer.concat([ciphertext, cipher.final()]);
            const authTag = cipher.getAuthTag();

            const masterIv = this.generateIV();
            const masterCipher = createCipheriv(
                this.algorithm,
                Buffer.from(this.masterKey, 'base64'),
                masterIv
            );

            let encryptedDek = masterCipher.update(dek);
            encryptedDek = Buffer.concat([encryptedDek, masterCipher.final()]);
            const masterAuthTag = masterCipher.getAuthTag();

            const encryptedPayload = Buffer.concat([
                masterIv,
                masterAuthTag,
                encryptedDek,
                iv,
                authTag,
                ciphertext
            ]);

            return {
                ciphertext: encryptedPayload,
                iv,
                authTag,
                keyId: 'v1'
            };
        } catch (error) {
            throw new AppError({
                code: ErrorCode.SYS_INTERNAL_ERROR,
                message: 'Failed to encrypt secret',
                cause: error
            });
        }
    }

    decryptSecret(encryptedData: EncryptedData): string {
        try {
            const { ciphertext, iv, authTag, keyId } = encryptedData;

            const masterIv = ciphertext.subarray(0, this.ivLength);
            const masterAuthTag = ciphertext.subarray(
                this.ivLength,
                this.ivLength + this.authTagLength
            );
            const encryptedDek = ciphertext.subarray(
                this.ivLength + this.authTagLength,
                this.ivLength + this.authTagLength + this.keyLength
            );
            const dataIv = ciphertext.subarray(
                this.ivLength + this.authTagLength + this.keyLength,
                this.ivLength + this.authTagLength + this.keyLength + this.ivLength
            );
            const dataAuthTag = ciphertext.subarray(
                this.ivLength + this.authTagLength + this.keyLength + this.ivLength,
                this.ivLength +
                    this.authTagLength +
                    this.keyLength +
                    this.ivLength +
                    this.authTagLength
            );
            const encryptedDataPayload = ciphertext.subarray(
                this.ivLength +
                    this.authTagLength +
                    this.keyLength +
                    this.ivLength +
                    this.authTagLength
            );

            const masterDecipher = createDecipheriv(
                this.algorithm,
                Buffer.from(this.masterKey, 'base64'),
                masterIv
            );
            masterDecipher.setAuthTag(masterAuthTag);

            let dek = masterDecipher.update(encryptedDek);
            dek = Buffer.concat([dek, masterDecipher.final()]);

            const decipher = createDecipheriv(this.algorithm, dek, dataIv);
            decipher.setAuthTag(dataAuthTag);

            let decrypted = decipher.update(encryptedDataPayload);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString('utf8');
        } catch (error) {
            throw new AppError({
                code: ErrorCode.SYS_INTERNAL_ERROR,
                message: 'Failed to decrypt secret',
                cause: error
            });
        }
    }

    /**
     * Rotate the master KEK
     *
     * Note: This would require re-encrypting all DEKs with the new KEK
     * This is a placeholder for future implementation
     */
    // async rotateMasterKey(newMasterKey: string): Promise<void> {
    //   // 1. Get all credentials
    //   // 2. For each credential, decrypt DEK with old key
    //   // 3. Re-encrypt DEK with new key
    //   // 4. Update the credential
    // }
}

export function createCredentialEncryption(): CredentialEncryption {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
        throw new AppError({
            code: ErrorCode.SYS_CONFIGURATION_ERROR,
            message: 'ENCRYPTION_MASTER_KEY environment variable is not set'
        });
    }

    // Validate master key is valid base64
    try {
        Buffer.from(masterKey, 'base64');
    } catch {
        throw new AppError({
            code: ErrorCode.SYS_CONFIGURATION_ERROR,
            message: 'ENCRYPTION_MASTER_KEY must be valid base64 encoded'
        });
    }

    return new CredentialEncryption(masterKey);
}
