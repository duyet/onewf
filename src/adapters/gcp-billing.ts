import type { MetricsAdapter, FetchParams, MetricData, SourceType } from "./types";
import { BaseMetricsAdapter } from "./base";
import type { Env } from "../index";

export interface GcpBillingConfig extends Record<string, unknown> {
  projectId: string;
  serviceAccountJson: string;
  billingAccountId?: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  private_key_id: string;
}

export class GcpBillingAdapter extends BaseMetricsAdapter<GcpBillingConfig> {
  readonly name = "gcp-billing";
  readonly type: SourceType = "gcp-billing";
  readonly priority = 30;

  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private serviceAccount: ServiceAccount | null = null;

  constructor(config: GcpBillingConfig, private env: Env) {
    super(config);
    this.parseServiceAccount(config.serviceAccountJson);
  }

  private parseServiceAccount(json: string) {
    try {
      const parsed = JSON.parse(json);
      this.serviceAccount = {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        private_key_id: parsed.private_key_id,
      };
    } catch {
      throw new Error("Invalid service account JSON");
    }
  }

  validateConfig(config: GcpBillingConfig): boolean {
    return !!config.projectId && !!config.serviceAccountJson;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    if (!this.serviceAccount) {
      throw new Error("Service account not initialized");
    }

    const jwt = await this.generateJWT();
    const tokenResponse = await this.fetchWithRetry<{ access_token: string; expires_in: number }>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      }
    );

    this.accessToken = tokenResponse.access_token;
    this.tokenExpiry = Date.now() + tokenResponse.expires_in * 1000;

    return this.accessToken;
  }

  private async generateJWT(): Promise<string> {
    if (!this.serviceAccount) throw new Error("Service account not initialized");

    const header = { alg: "RS256", typ: "JWT", kid: this.serviceAccount.private_key_id };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-billing.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const privateKey = await this.importPrivateKey(this.serviceAccount.private_key);
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    const encodedSignature = this.base64UrlEncode(new Uint8Array(signature));
    return `${signingInput}.${encodedSignature}`;
  }

  private async importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/-----BEGIN RSA PRIVATE KEY-----/, "")
      .replace(/-----END RSA PRIVATE KEY-----/, "")
      .replace(/\s/g, "");

    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    return crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }

  private base64UrlEncode(input: string | Uint8Array): string {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  async fetchMetrics(params: FetchParams): Promise<MetricData[]> {
    const accessToken = await this.getAccessToken();
    const { projectId, billingAccountId } = this.config;

    const url = billingAccountId
      ? `https://cloudbilling.googleapis.com/v1/billingAccounts/${billingAccountId}/projects/${projectId}/billingInfo`
      : `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`;

    const response = await this.fetchWithRetry<any>(
      url,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
      3,
      2000
    );

    if (!response) {
      return [];
    }

    return this.normalize(response);
  }

  normalize(data: unknown): MetricData[] {
    const billingInfo = data as {
      billingEnabled?: boolean;
      billingAccountName?: string;
      projectId?: string;
    };

    const metrics: MetricData[] = [
      {
        name: "billing_enabled",
        value: billingInfo.billingEnabled ? 1 : 0,
        unit: "boolean",
        timestamp: Date.now(),
      },
    ];

    if (billingInfo.billingAccountName) {
      metrics.push({
        name: "billing_account",
        value: 1,
        unit: "count",
        timestamp: Date.now(),
        labels: { account: billingInfo.billingAccountName },
      });
    }

    return metrics;
  }
}