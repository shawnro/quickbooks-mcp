import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Configuration from environment variables with sensible defaults
const REGION = process.env.AWS_REGION || "us-east-2";
const SECRET_NAME = process.env.QBO_SECRET_NAME || "prod/qbo";
const COMPANY_ID_PARAM = process.env.QBO_COMPANY_ID_PARAM || "/prod/qbo/company_id";

export interface QBCredentials {
  client_id: string;
  client_secret: string;
  redirect_url: string;
  access_token: string;
  refresh_token: string;
}

const secretsClient = new SecretsManagerClient({ region: REGION });
const ssmClient = new SSMClient({ region: REGION });

export async function getSecret(): Promise<QBCredentials> {
  const command = new GetSecretValueCommand({ SecretId: SECRET_NAME });
  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error("Secret value is empty");
  }

  return JSON.parse(response.SecretString) as QBCredentials;
}

export async function putSecret(credentials: QBCredentials): Promise<void> {
  const command = new PutSecretValueCommand({
    SecretId: SECRET_NAME,
    SecretString: JSON.stringify(credentials),
  });
  await secretsClient.send(command);
}

export async function getCompanyId(): Promise<string> {
  const command = new GetParameterCommand({
    Name: COMPANY_ID_PARAM,
    WithDecryption: true,
  });
  const response = await ssmClient.send(command);

  if (!response.Parameter?.Value) {
    throw new Error("Company ID parameter not found");
  }

  return response.Parameter.Value;
}
