import { BlobServiceClient, BlockBlobUploadOptions } from '@azure/storage-blob';
import { env } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

let blobServiceClient: BlobServiceClient | null = null;

function getClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!env.AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error('Azure Storage connection string not configured');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(
      env.AZURE_STORAGE_CONNECTION_STRING,
    );
  }
  return blobServiceClient;
}

export async function uploadPdfToBlob(
  buffer: Buffer,
  originalFilename: string,
): Promise<string> {
  const client = getClient();
  const containerClient = client.getContainerClient(env.AZURE_STORAGE_CONTAINER);

  // Ensure container exists
  await containerClient.createIfNotExists();

  const ext = '.pdf';
  const blobName = `${uuidv4()}${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const options: BlockBlobUploadOptions = {
    blobHTTPHeaders: {
      blobContentType: 'application/pdf',
      blobContentDisposition: `inline; filename="${encodeURIComponent(originalFilename)}"`,
    },
    metadata: { originalFilename },
  };

  await blockBlobClient.upload(buffer, buffer.length, options);
  return blockBlobClient.url;
}

export async function downloadPdfFromBlob(blobUrl: string): Promise<Buffer> {
  const client = getClient();
  const containerClient = client.getContainerClient(env.AZURE_STORAGE_CONTAINER);
  
  // Extract blob name from URL
  const urlParts = blobUrl.split('/');
  const blobName = urlParts[urlParts.length - 1];
  
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  return await blockBlobClient.downloadToBuffer();
}
