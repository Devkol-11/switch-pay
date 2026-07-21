// modules/credentials/credentials.controller.ts
import { Context } from "hono";
import { CredentialService } from "./credentials.service";
import {
  CreateCredentialInput,
  UpdateCredentialInput,
  ListCredentialsQuery,
  ValidateCredentialInput,
} from "./credentials.types";
import { ResponseHelper } from "../../shared/utils/response";
import { AppErrorFactory } from "../../shared/errors/app-error";
import { ErrorCode } from "../../shared/errors/error-codes";

export class CredentialController {
  constructor(private credentialService: CredentialService) {}

  /**
   * Create a new credential
   */
  async createCredential(c: Context) {
    const merchantId = c.get("merchantId") as string;
    const body = await c.req.json<CreateCredentialInput>();

    const result = await this.credentialService.createCredential(
      merchantId,
      body
    );

    return ResponseHelper.created(
      c,
      result,
      `${body.provider} credential (${body.mode} mode) created successfully`
    );
  }

  /**
   * Get all credentials
   */
  async getCredentials(c: Context) {
    const merchantId = c.get("merchantId") as string;
    const query = c.req.query() as ListCredentialsQuery;

    const result = await this.credentialService.getCredentials(merchantId, {
      provider: query.provider,
      mode: query.mode,
      status: query.status,
    });

    return ResponseHelper.success(
      c,
      {
        credentials: result,
        count: result.length,
      },
      "Credentials retrieved successfully"
    );
  }

  /**
   * Get a single credential
   */
  async getCredential(c: Context) {
    const merchantId = c.get("merchantId") as string;
    const credentialId = c.req.param("id");

    if (!credentialId) {
      const error = AppErrorFactory.validation(
        ErrorCode.VAL_MISSING_FIELD,
        "credentialId needs to be provided"
      );
      return ResponseHelper.error(c, error);
    }

    const result = await this.credentialService.getCredentialById(
      merchantId,
      credentialId
    );

    return ResponseHelper.success(
      c,
      result,
      "Credential retrieved successfully"
    );
  }

  /**
   * Update a credential
   */
  async updateCredential(c: Context) {
    const merchantId = c.get("merchantId") as string;
    const credentialId = c.req.param("id");
    const body = await c.req.json<UpdateCredentialInput>();

    if (!credentialId) {
      const error = AppErrorFactory.validation(
        ErrorCode.VAL_MISSING_FIELD,
        "credentialId needs to be provided"
      );
      return ResponseHelper.error(c, error);
    }

    const result = await this.credentialService.updateCredential(
      merchantId,
      credentialId,
      body
    );

    return ResponseHelper.success(c, result, "Credential updated successfully");
  }

  /**
   * Delete a credential
   */
  async deleteCredential(c: Context) {
    const merchantId = c.get("merchantId") as string;
    const credentialId = c.req.param("id");

    if (!credentialId) {
      const error = AppErrorFactory.validation(
        ErrorCode.VAL_MISSING_FIELD,
        "credentialId needs to be provided"
      );
      return ResponseHelper.error(c, error);
    }

    await this.credentialService.deleteCredential(merchantId, credentialId);

    return ResponseHelper.success(
      c,
      undefined,
      "Credential deleted successfully"
    );
  }

  /**
   * Validate a credential
   */
  async validateCredential(c: Context) {
    const merchantId = c.get("merchantId") as string;
    const credentialId = c.req.param("id");

    const result = await this.credentialService.validateCredentials();
  }
}
