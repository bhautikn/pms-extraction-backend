import { app, HttpRequest, InvocationContext, HttpResponseInit } from '@azure/functions';
import serverless from 'serverless-http';
import expressApp from './app';
import { connectDB } from './config/db';

let dbConnected = false;

// Create the serverless handler using the Azure v3 provider natively provided by serverless-http
const expressHandler = serverless(expressApp, { provider: 'azure' });

// Register the HTTP trigger using the v4 model
app.http('api', {
  route: '{*segments}',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Ensure DB is connected before processing the request
    if (!dbConnected) {
      await connectDB();
      dbConnected = true;
    }

    // Convert v4 headers to plain object
    const headers: Record<string, string> = {};
    for (const [key, value] of request.headers.entries()) {
      headers[key] = value;
    }

    // Convert v4 query params to plain object
    const query: Record<string, string> = {};
    for (const [key, value] of request.query.entries()) {
      query[key] = value;
    }

    // Read the raw body as an ArrayBuffer, then convert to Node Buffer
    const arrayBuffer = await request.arrayBuffer();
    const rawBody = Buffer.from(arrayBuffer);

    // Create a mock Azure Functions v3 request object expected by serverless-http 'azure' provider
    const reqV3 = {
      method: request.method,
      url: new URL(request.url).pathname, // Just the pathname, e.g. /api/extractions
      headers,
      query,
      rawBody,
    };

    // Create a mock Azure Functions v3 context object
    const contextV3 = {
      log: () => {}, // Disable serverless-http's noisy response logging
      invocationId: context.invocationId,
    };

    try {
      // Delegate to the express handler, which returns { status, headers, isBase64Encoded, body }
      const responseV3 = await expressHandler(contextV3, reqV3) as any;

      const isNoBodyStatus = responseV3.status === 204 || responseV3.status === 304;

      return {
        status: responseV3.status,
        headers: responseV3.headers,
        body: isNoBodyStatus
          ? undefined
          : responseV3.isBase64Encoded
          ? Buffer.from(responseV3.body || '', 'base64')
          : responseV3.body,
      };
    } catch (error) {
      context.log('Error executing serverless-http handler:', error);
      return {
        status: 500,
        body: 'Internal Server Error from Azure Function wrapper',
      };
    }
  },
});
