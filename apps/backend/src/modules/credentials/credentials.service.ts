import {
  PrismaClient,
  Provider,
  Mode,
  CredentialStatus,
} from "../../generated/prisma/client";
import { CredentialRepository } from "./credentials.repository";
import { CredentialEncryption } from "./credentials.encryption";
import {
  CreateCredentialInput,
  UpdateCredentialInput,
  CredentialResponseDTO,
  CredentialWithDecryptedSecret,
  ValidationResult,
  CredentialFilters,
  ProviderSecretsMap,
} from "./credentials.types";
import { AppError } from "../../shared/errors/app-error";
import { ErrorCode } from "../../shared/errors/error-codes";
import {
  dbTransaction,
  TransactionClient,
} from "../../shared/utils/db.transaction";

export class CredentialService {
  private repository: CredentialRepository;
  private encryption: CredentialEncryption;

  constructor(
    private prisma: PrismaClient,
    private encryptionMasterKey: string
  ) {
    this.repository = new CredentialRepository(prisma);
    this.encryption = new CredentialEncryption(encryptionMasterKey);
  }

  /**
   * Create a new credential
   */
  async createCredential(
    merchantId: string,
    data: CreateCredentialInput
  ): Promise<CredentialResponseDTO> {
    // Check if credential already exists
    const exists = await this.repository.exists(
      merchantId,
      data.provider,
      data.mode
    );
    if (exists) {
      throw new AppError({
        code: ErrorCode.RES_ALREADY_EXISTS,
        message: `Credential for ${data.provider} (${data.mode} mode) already exists`,
        metadata: { merchantId, provider: data.provider, mode: data.mode },
      });
    }

    // Encrypt the secret
    const encryptedData = this.encryption.encryptSecret(data.secret);

    // Create the credential in a transaction
    return await dbTransaction(async (trx: TransactionClient) => {
      const credential = await this.repository.create(
        {
          merchantId,
          provider: data.provider,
          mode: data.mode,
          encryptedSecret: encryptedData.ciphertext,
          encryptionKeyId: encryptedData.keyId,
          publicKey: data.publicKey,
          status: CredentialStatus.pending,
        },
        trx
      );

      // Validate the credential (async, don't block creation)
      // This will be handled by a background job or called separately
      // For now, we'll return the credential with pending status

      return this.toResponseDTO(credential);
    });
  }

  /**
   * Get all credentials for a merchant
   */
  async getCredentials(
    merchantId: string,
    filters?: CredentialFilters
  ): Promise<CredentialResponseDTO[]> {
    const credentials = await this.repository.findByMerchantId(
      merchantId,
      filters
    );
    return credentials.map((c) => this.toResponseDTO(c));
  }

  /**
   * Get a single credential by ID
   */
  async getCredentialById(
    merchantId: string,
    credentialId: string
  ): Promise<CredentialResponseDTO> {
    const credential = await this.repository.findById(credentialId);

    if (!credential) {
      throw new AppError({
        code: ErrorCode.RES_NOT_FOUND,
        message: "Credential not found",
        metadata: { credentialId },
      });
    }

    // Verify merchant owns this credential
    if (credential.merchantId !== merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: "You do not have permission to access this credential",
        metadata: { credentialId },
      });
    }

    return this.toResponseDTO(credential);
  }

  /**
   * Get a credential with decrypted secret (for internal use only)
   */
  async getCredentialWithSecret(
    merchantId: string,
    provider: Provider,
    mode: Mode
  ): Promise<CredentialWithDecryptedSecret> {
    const credential = await this.repository.findByMerchantProviderAndMode(
      merchantId,
      provider,
      mode
    );

    if (!credential) {
      throw new AppError({
        code: ErrorCode.RES_NOT_FOUND,
        message: `Credential for ${provider} (${mode} mode) not found`,
        metadata: { merchantId, provider, mode },
      });
    }

    if (credential.status !== CredentialStatus.active) {
      throw new AppError({
        code: ErrorCode.PROV_CREDENTIAL_INVALID,
        message: `Credential for ${provider} (${mode} mode) is not active (status: ${credential.status})`,
        metadata: { merchantId, provider, mode, status: credential.status },
      });
    }

    // Decrypt the secret
    const decryptedSecret = this.encryption.decryptSecret({
      ciphertext: credential.encryptedSecret,
      iv: Buffer.alloc(0), // IV is embedded in the ciphertext
      authTag: Buffer.alloc(0), // Auth tag is embedded in the ciphertext
      keyId: credential.encryptionKeyId,
    });

    return {
      ...credential,
      decryptedSecret,
    };
  }

  /**
   * Update a credential
   */
  async updateCredential(
    merchantId: string,
    credentialId: string,
    data: UpdateCredentialInput
  ): Promise<CredentialResponseDTO> {
    // Get the credential
    const credential = await this.repository.findById(credentialId);

    if (!credential) {
      throw new AppError({
        code: ErrorCode.RES_NOT_FOUND,
        message: "Credential not found",
        metadata: { credentialId },
      });
    }

    // Verify merchant owns this credential
    if (credential.merchantId !== merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: "You do not have permission to update this credential",
        metadata: { credentialId },
      });
    }

    // Prepare update data
    const updateData: {
      encryptedSecret?: Buffer;
      encryptionKeyId?: string;
      publicKey?: string | null;
      status?: CredentialStatus;
    } = {};

    // If secret is provided, re-encrypt it
    if (data.secret) {
      const encryptedData = this.encryption.encryptSecret(data.secret);
      updateData.encryptedSecret = encryptedData.ciphertext;
      updateData.encryptionKeyId = encryptedData.keyId;
    }

    if (data.publicKey !== undefined) {
      updateData.publicKey = data.publicKey || null;
    }

    if (data.status) {
      updateData.status = data.status;
    }

    // Update the credential
    const updated = await this.repository.update(credentialId, updateData);

    return this.toResponseDTO(updated);
  }

  /**
   * Delete a credential
   */
  async deleteCredential(
    merchantId: string,
    credentialId: string
  ): Promise<void> {
    const credential = await this.repository.findById(credentialId);

    if (!credential) {
      throw new AppError({
        code: ErrorCode.RES_NOT_FOUND,
        message: "Credential not found",
        metadata: { credentialId },
      });
    }

    // Verify merchant owns this credential
    if (credential.merchantId !== merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: "You do not have permission to delete this credential",
        metadata: { credentialId },
      });
    }

    await this.repository.delete(credentialId);
  }

  /**
   * Validate credentials against the provider
   */
  async validateCredentials(
    merchantId: string,
    credentialId: string
  ): Promise<ValidationResult> {
    const credential = await this.repository.findById(credentialId);

    if (!credential) {
      throw new AppError({
        code: ErrorCode.RES_NOT_FOUND,
        message: "Credential not found",
        metadata: { credentialId },
      });
    }

    // Verify merchant owns this credential
    if (credential.merchantId !== merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: "You do not have permission to validate this credential",
        metadata: { credentialId },
      });
    }

    // Decrypt the secret
    const decryptedSecret = this.encryption.decryptSecret({
      ciphertext: credential.encryptedSecret,
      iv: Buffer.alloc(0),
      authTag: Buffer.alloc(0),
      keyId: credential.encryptionKeyId,
    });

    // Validate with the provider
    // This will be implemented when we have provider adapters
    // For now, we'll just mark it as active
    try {
      // TODO: Call provider validation API
      // const isValid = await this.validateWithProvider(credential.provider, decryptedSecret, credential.publicKey);

      // For now, assume it's valid
      await this.repository.update(credentialId, {
        status: CredentialStatus.active,
      });

      return {
        valid: true,
        message: "Credential validated successfully",
      };
    } catch (error) {
      // Mark as invalid
      await this.repository.update(credentialId, {
        status: CredentialStatus.invalid,
      });

      return {
        valid: false,
        message: error instanceof Error ? error.message : "Validation failed",
      };
    }
  }

  /**
   * Toggle credential status (active/disabled)
   */
  async toggleCredential(
    merchantId: string,
    credentialId: string,
    active: boolean
  ): Promise<CredentialResponseDTO> {
    const credential = await this.repository.findById(credentialId);

    if (!credential) {
      throw new AppError({
        code: ErrorCode.RES_NOT_FOUND,
        message: "Credential not found",
        metadata: { credentialId },
      });
    }

    // Verify merchant owns this credential
    if (credential.merchantId !== merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: "You do not have permission to update this credential",
        metadata: { credentialId },
      });
    }

    const newStatus = active
      ? CredentialStatus.active
      : CredentialStatus.disabled;

    const updated = await this.repository.update(credentialId, {
      status: newStatus,
    });

    return this.toResponseDTO(updated);
  }

  /**
   * Get active credentials for a merchant and provider
   */
  async getActiveCredential(
    merchantId: string,
    provider: Provider
  ): Promise<CredentialWithDecryptedSecret[]> {
    const credentials = await this.repository.findActiveByMerchantAndProvider(
      merchantId,
      provider
    );

    const result: CredentialWithDecryptedSecret[] = [];

    for (const credential of credentials) {
      const decryptedSecret = this.encryption.decryptSecret({
        ciphertext: credential.encryptedSecret,
        iv: Buffer.alloc(0),
        authTag: Buffer.alloc(0),
        keyId: credential.encryptionKeyId,
      });

      result.push({
        ...credential,
        decryptedSecret,
      });
    }

    return result;
  }

  /**
   * Parse provider-specific secrets from a JSON string
   */
  parseProviderSecrets(
    provider: Provider,
    secretString: string
  ): ProviderSecretsMap[typeof provider] {
    try {
      const secrets = JSON.parse(secretString);

      // TODO: Validate based on provider type
      // This will be implemented with proper validation for each provider

      return secrets as ProviderSecretsMap[typeof provider];
    } catch (error) {
      throw new AppError({
        code: ErrorCode.VAL_INVALID_FORMAT,
        message: "Invalid secret format. Must be valid JSON.",
        cause: error,
        metadata: { provider },
      });
    }
  }

  /**
   * Convert to response DTO (never includes decrypted secret)
   */
  private toResponseDTO(credential: any): CredentialResponseDTO {
    return {
      id: credential.id,
      provider: credential.provider,
      mode: credential.mode,
      publicKey: credential.publicKey,
      status: credential.status,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}

/**
 * Factory to create credential service
 */
export function createCredentialService(
  prisma: PrismaClient
): CredentialService {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new AppError({
      code: ErrorCode.SYS_CONFIGURATION_ERROR,
      message: "ENCRYPTION_MASTER_KEY environment variable is not set",
    });
  }
  return new CredentialService(prisma, masterKey);
}
