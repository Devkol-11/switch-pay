import { Provider, Mode, CredentialStatus } from '../../generated/prisma/client';

// ============== DOMAIN TYPES ==============

export interface Credential {
    id: string;
    merchantId: string;
    provider: Provider;
    mode: Mode;
    encryptedSecret: Buffer;
    encryptionKeyId: string;
    publicKey: string | null;
    status: CredentialStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CredentialWithDecryptedSecret extends Credential {
    decryptedSecret: string;
}

export interface CreateCredentialInput {
    provider: Provider;
    mode: Mode;
    secret: string; // JSON string of provider-specific secrets
    publicKey?: string;
}

export interface UpdateCredentialInput {
    secret?: string;
    publicKey?: string;
    status?: CredentialStatus;
}

// ============== PROVIDER-SPECIFIC SECRETS ==============

export interface PaystackSecrets {
    publicKey: string;
    secretKey: string;
}

export interface FlutterwaveSecrets {
    publicKey: string;
    secretKey: string;
    encryptionKey: string;
}

export interface MonnifySecrets {
    clientId: string;
    clientSecret: string;
    apiKey: string;
}

export type ProviderSecretsMap = {
    [Provider.paystack]: PaystackSecrets;
    [Provider.flutterwave]: FlutterwaveSecrets;
    [Provider.monnify]: MonnifySecrets;
};

// ============== DTOs ==============

export interface CredentialResponseDTO {
    id: string;
    provider: Provider;
    mode: Mode;
    publicKey: string | null;
    status: CredentialStatus;
    createdAt: Date;
    updatedAt: Date;
    // NEVER return decrypted secret!
}

export interface ValidateCredentialsInput {
    provider: Provider;
    mode: Mode;
    secret: string;
    publicKey?: string;
}

// ============== ENCRYPTION TYPES ==============

export interface EncryptedData {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    keyId: string;
}

export interface EncryptionKey {
    id: string;
    key: Buffer;
    version: string;
    createdAt: Date;
    isActive: boolean;
}

// ============== VALIDATION RESULTS ==============

export interface ValidationResult {
    valid: boolean;
    message?: string;
    details?: Record<string, unknown>;
}

// ============== LIST FILTERS ==============

export interface CredentialFilters {
    provider?: Provider;
    mode?: Mode;
    status?: CredentialStatus;
}
