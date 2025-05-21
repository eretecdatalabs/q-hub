const { S3Client } = require('@aws-sdk/client-s3');
const { logger } = require('~/config');

let minio = null;

/**
 * Initializes and returns an instance of the AWS S3 client.
 *
 * If AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are provided, they will be used.
 * Otherwise, the AWS SDK's default credentials chain (including IRSA) is used.
 *
 * If AWS_ENDPOINT_URL is provided, it will be used as the endpoint.
 *
 * @returns {S3Client|null} An instance of S3Client if the region is provided; otherwise, null.
 */
const initializeMinio = () => {
  if (minio) {
    return minio;
  }

  const region = process.env.MINIO_REGION;
  const endpoint = process.env.MINIO_ENDPOINT;
  if (!region || !endpoint) {
    logger.error('[initializeMinio] MINIO_REGION or MINIO_ENDPOINT not set.');
    return null;
  }

  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;

  const config = {
    region,
    endpoint,
    forcePathStyle: true,
  };

  if (accessKeyId && secretAccessKey) {
    minio = new S3Client({
      ...config,
      credentials: { accessKeyId, secretAccessKey },
    });
    logger.info('[initializeMinio] client initialized with provided credentials.');
  } else {
    minio = new S3Client(config);
    logger.info('[initializeMinio] client initialized without credentials.');
  }

  return minio;
};

module.exports = { initializeMinio };
