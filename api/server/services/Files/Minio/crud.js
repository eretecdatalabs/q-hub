const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { FileSources } = require('librechat-data-provider');
const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-client');
const { getSignedUrl } = require('@aws-sdk/client-request-presigner');
const { initializeMinio } = require('./initialize');
const { logger } = require('~/config');

const bucketName = process.env.MINIO_BUCKET_NAME || 'q-hub';
const defaultBasePath = 'images';

let minioUrlExpirySeconds = 7 * 24 * 60 * 60;
let minioRefreshExpiryMs = null;

if (process.env.MINIO_URL_EXPIRY_SECONDS !== undefined) {
  const parsed = parseInt(process.env.MINIO_URL_EXPIRY_SECONDS, 10);

  if (!isNaN(parsed) && parsed > 0) {
    minioUrlExpirySeconds = Math.min(parsed, 7 * 24 * 60 * 60);
  } else {
    logger.warn(
      `[Minio] Invalid MINIO_URL_EXPIRY_SECONDS value: "${process.env.MINIO_URL_EXPIRY_SECONDS}". Using 7-day expiry.`,
    );
  }
}

if (process.env.MINIO_REFRESH_EXPIRY_MS !== null && process.env.MINIO_REFRESH_EXPIRY_MS) {
  const parsed = parseInt(process.env.MINIO_REFRESH_EXPIRY_MS, 10);

  if (!isNaN(parsed) && parsed > 0) {
    minioRefreshExpiryMs = parsed;
    logger.info(`[Minio] Using custom refresh expiry time: ${minioRefreshExpiryMs}ms`);
  } else {
    logger.warn(
      `[Minio] Invalid MINIO_REFRESH_EXPIRY_MS value: "${process.env.MINIO_REFRESH_EXPIRY_MS}". Using default refresh logic.`,
    );
  }
}

/**
 * Constructs the Minio key based on the base path, user ID, and file name.
 */
const getMinioKey = (basePath, userId, fileName) => `${basePath}/${userId}/${fileName}`;

/**
 * Uploads a buffer to Minio and returns a signed URL.
 *
 * @param {Object} params
 * @param {string} params.userId - The user's unique identifier.
 * @param {Buffer} params.buffer - The buffer containing file data.
 * @param {string} params.fileName - The file name to use in Minio.
 * @param {string} [params.basePath='images'] - The base path in the bucket.
 * @returns {Promise<string>} Signed URL of the uploaded file.
 */
async function saveBufferToMinio({ userId, buffer, fileName, basePath = defaultBasePath }) {
  const key = getMinioKey(basePath, userId, fileName);
  const params = { Bucket: bucketName, Key: key, Body: buffer };

  try {
    const client = initializeMinio();
    await client.send(new PutObjectCommand(params));
    return await getMinioURL({ userId, fileName, basePath, bucket: bucketName });
  } catch (error) {
    logger.error('[saveBufferToMinio] Error uploading buffer to Minio:', error.message);
    throw error;
  }
}

/**
 * Retrieves a URL for a file stored in Minio.
 * Returns a signed URL with expiration time or a proxy URL based on config
 *
 * @param {Object} params
 * @param {string} params.userId - The user's unique identifier.
 * @param {string} params.fileName - The file name in Minio.
 * @param {string} [params.basePath='images'] - The base path in the bucket.
 * @returns {Promise<string>} A URL to access the Minio object
 */
async function getMinioURL({ userId, fileName, bucket = bucketName, basePath = defaultBasePath }) {
  const key = getMinioKey(basePath, userId, fileName);
  const params = { Bucket: bucket, Key: key };

  try {
    const client = initializeMinio();
    return await getSignedUrl(client, new GetObjectCommand(params), { expiresIn: minioUrlExpirySeconds });
  } catch (error) {
    logger.error('[getMinioURL] Error getting signed URL from Minio:', error.message);
    throw error;
  }
}

/**
 * Saves a file from a given URL to Minio.
 *
 * @param {Object} params
 * @param {string} params.userId - The user's unique identifier.
 * @param {string} params.URL - The source URL of the file.
 * @param {string} params.fileName - The file name to use in Minio.
 * @param {string} [params.basePath='images'] - The base path in the bucket.
 * @returns {Promise<string>} Signed URL of the uploaded file.
 */
async function saveURLToMinio({ userId, URL, fileName, basePath = defaultBasePath }) {
  try {
    const response = await fetch(URL);
    const buffer = await response.buffer();
    // Optionally you can call getBufferMetadata(buffer) if needed.
    return await saveBufferToMinio({ userId, buffer, fileName, basePath });
  } catch (error) {
    logger.error('[saveURLToMinio] Error uploading file from URL to Minio:', error.message);
    throw error;
  }
}

/**
 * Deletes a file from Minio.
 *
 * @param {Object} params
 * @param {ServerRequest} params.req
 * @param {MongoFile} params.file - The file object to delete.
 * @returns {Promise<void>}
 */
async function deleteFileFromMinio(req, file) {
  const key = extractKeyFromMinioUrl(file.filepath);
  const params = { Bucket: bucketName, Key: key };
  if (!key.includes(req.user.id)) {
    const message = `[deleteFileFromMinio] User ID mismatch: ${req.user.id} vs ${key}`;
    logger.error(message);
    throw new Error(message);
  }

  try {
    const client = initializeMinio();

    try {
      const headCommand = new HeadObjectCommand(params);
      await client.send(headCommand);
      logger.debug('[deleteFileFromMinio] File exists, proceeding with deletion');
    } catch (headErr) {
      if (headErr.name === 'NotFound') {
        logger.warn(`[deleteFileFromMinio] File does not exist: ${key}`);
        return;
      }
    }

    const deleteResult = await client.send(new DeleteObjectCommand(params));
    logger.debug('[deleteFileFromMinio] Delete command response:', JSON.stringify(deleteResult));
    try {
      await client.send(new HeadObjectCommand(params));
      logger.error('[deleteFileFromMinio] File still exists after deletion!');
    } catch (verifyErr) {
      if (verifyErr.name === 'NotFound') {
        logger.debug(`[deleteFileFromMinio] Verified file is deleted: ${key}`);
      } else {
        logger.error('[deleteFileFromMinio] Error verifying deletion:', verifyErr);
      }
    }

    logger.debug('[deleteFileFromMinio] Minio File deletion completed');
  } catch (error) {
    logger.error(`[deleteFileFromMinio] Error deleting file from Minio: ${error.message}`);
    logger.error(error.stack);

    // If the file is not found, we can safely return.
    if (error.code === 'NoSuchKey') {
      return;
    }
    throw error;
  }
}

/**
 * Uploads a local file to Minio by streaming it directly without loading into memory.
 *
 * @param {Object} params
 * @param {import('express').Request} params.req - The Express request (must include user).
 * @param {Express.Multer.File} params.file - The file object from Multer.
 * @param {string} params.file_id - Unique file identifier.
 * @param {string} [params.basePath='images'] - The base path in the bucket.
 * @returns {Promise<{ filepath: string, bytes: number }>}
 */
async function uploadFileToMinio({ req, file, file_id, bucket = bucketName, basePath = defaultBasePath }) {
  try {
    const inputFilePath = file.path;
    const userId = req.user.id;
    const fileName = `${file_id}__${path.basename(inputFilePath)}`;
    const key = getMinioKey(basePath, userId, fileName);

    const stats = await fs.promises.stat(inputFilePath);
    const bytes = stats.size;
    const fileStream = fs.createReadStream(inputFilePath);

    const client = initializeMinio();
    const uploadParams = {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
    };

    await client.send(new PutObjectCommand(uploadParams));
    const fileURL = await getMinioURL({ userId, fileName, basePath, bucket });
    return { filepath: fileURL, bytes };
  } catch (error) {
    logger.error('[uploadFileToMinio] Error streaming file to Minio:', error);
    try {
      if (file && file.path) {
        await fs.promises.unlink(file.path);
      }
    } catch (unlinkError) {
      logger.error(
        '[uploadFileToMinio] Error deleting temporary file, likely already deleted:',
        unlinkError.message,
      );
    }
    throw error;
  }
}

/**
 * Extracts the Minio key from a URL or returns the key if already properly formatted
 *
 * @param {string} fileUrlOrKey - The file URL or key
 * @returns {string} The Minio key
 */
function extractKeyFromMinioUrl(fileUrlOrKey) {
  if (!fileUrlOrKey) {
    throw new Error('Invalid input: URL or key is empty');
  }

  try {
    const url = new URL(fileUrlOrKey);
    return url.pathname.substring(1);
  } catch (error) {
    const parts = fileUrlOrKey.split('/');

    if (parts.length >= 3 && !fileUrlOrKey.startsWith('http') && !fileUrlOrKey.startsWith('/')) {
      return fileUrlOrKey;
    }

    return fileUrlOrKey.startsWith('/') ? fileUrlOrKey.substring(1) : fileUrlOrKey;
  }
}

/**
 * Retrieves a readable stream for a file stored in Minio.
 *
 * @param {ServerRequest} req - Server request object.
 * @param {string} filePath - The Minio key of the file.
 * @returns {Promise<NodeJS.ReadableStream>}
 */
async function getMinioFileStream(_req, filePath) {
  try {
    const Key = extractKeyFromMinioUrl(filePath);
    const params = { Bucket: bucketName, Key };
    const client = initializeMinio();
    const data = await client.send(new GetObjectCommand(params));
    return data.Body; // Returns a Node.js ReadableStream.
  } catch (error) {
    logger.error('[getMinioFileStream] Error retrieving Minio file stream:', error);
    throw error;
  }
}

/**
 * Determines if a signed Minio URL is close to expiration
 *
 * @param {string} signedUrl - The signed Minio URL
 * @param {number} bufferSeconds - Buffer time in seconds
 * @returns {boolean} True if the URL needs refreshing
 */
function needsRefresh(signedUrl, bufferSeconds) {
  try {
    // Parse the URL
    const url = new URL(signedUrl);

    // Check if it has the signature parameters that indicate it's a signed URL
    // X-Amz-Signature is the most reliable indicator for AWS signed URLs
    if (!url.searchParams.has('X-Amz-Signature')) {
      // Not a signed URL, so no expiration to check (or it's already a proxy URL)
      return false;
    }

    // Extract the expiration time from the URL
    const expiresParam = url.searchParams.get('X-Amz-Expires');
    const dateParam = url.searchParams.get('X-Amz-Date');

    if (!expiresParam || !dateParam) {
      // Missing expiration information, assume it needs refresh to be safe
      return true;
    }

    // Parse the AWS date format (YYYYMMDDTHHMMSSZ)
    const year = dateParam.substring(0, 4);
    const month = dateParam.substring(4, 6);
    const day = dateParam.substring(6, 8);
    const hour = dateParam.substring(9, 11);
    const minute = dateParam.substring(11, 13);
    const second = dateParam.substring(13, 15);

    const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    const expiresAtDate = new Date(dateObj.getTime() + parseInt(expiresParam) * 1000);

    // Check if it's close to expiration
    const now = new Date();

    // If MINIO_REFRESH_EXPIRY_MS is set, use it to determine if URL is expired
    if (minioRefreshExpiryMs !== null) {
      const urlCreationTime = dateObj.getTime();
      const urlAge = now.getTime() - urlCreationTime;
      return urlAge >= minioRefreshExpiryMs;
    }

    // Otherwise use the default buffer-based logic
    const bufferTime = new Date(now.getTime() + bufferSeconds * 1000);
    return expiresAtDate <= bufferTime;
  } catch (error) {
    logger.error('Error checking URL expiration:', error);
    // If we can't determine, assume it needs refresh to be safe
    return true;
  }
}

/**
 * Generates a new URL for an expired Minio URL
 * @param {string} currentURL - The current file URL
 * @returns {Promise<string | undefined>}
 */
async function getNewMinioURL(currentURL) {
  try {
    const minioKey = extractKeyFromMinioUrl(currentURL);
    if (!minioKey) {
      return;
    }
    const keyParts = minioKey.split('/');
    if (keyParts.length < 3) {
      return;
    }

    const basePath = keyParts[0];
    const userId = keyParts[1];
    const fileName = keyParts.slice(2).join('/');

    return await getMinioURL({
      userId,
      fileName,
      basePath,
      bucket: bucketName,
    });
  } catch (error) {
    logger.error('Error getting new Minio URL:', error);
  }
}

/**
 * Refreshes Minio URLs for an array of files if they're expired or close to expiring
 *
 * @param {MongoFile[]} files - Array of file documents
 * @param {(files: MongoFile[]) => Promise<void>} batchUpdateFiles - Function to update files in the database
 * @param {number} [bufferSeconds=3600] - Buffer time in seconds to check for expiration
 * @returns {Promise<MongoFile[]>} The files with refreshed URLs if needed
 */
async function refreshMinioFileUrls(files, batchUpdateFiles, bufferSeconds = 3600) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return files;
  }

  const filesToUpdate = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file?.file_id) {
      continue;
    }
    if (file.source !== FileSources.client) {
      continue;
    }
    if (!file.filepath) {
      continue;
    }
    if (!needsRefresh(file.filepath, bufferSeconds)) {
      continue;
    }
    try {
      const newURL = await getNewMinioURL(file.filepath);
      if (!newURL) {
        continue;
      }
      filesToUpdate.push({
        file_id: file.file_id,
        filepath: newURL,
      });
      files[i].filepath = newURL;
    } catch (error) {
      logger.error(`Error refreshing Minio URL for file ${file.file_id}:`, error);
    }
  }

  if (filesToUpdate.length > 0) {
    await batchUpdateFiles(filesToUpdate);
  }

  return files;
}

/**
 * Refreshes a single Minio URL if it's expired or close to expiring
 *
 * @param {{ filepath: string, source: string }} fileObj - Simple file object containing filepath and source
 * @param {number} [bufferSeconds=3600] - Buffer time in seconds to check for expiration
 * @returns {Promise<string>} The refreshed URL or the original URL if no refresh needed
 */
async function refreshMinioUrl(fileObj, bufferSeconds = 3600) {
  if (!fileObj || fileObj.source !== FileSources.client || !fileObj.filepath) {
    return fileObj?.filepath || '';
  }

  if (!needsRefresh(fileObj.filepath, bufferSeconds)) {
    return fileObj.filepath;
  }

  try {
    const minioKey = extractKeyFromMinioUrl(fileObj.filepath);
    if (!minioKey) {
      logger.warn(`Unable to extract Minio key from URL: ${fileObj.filepath}`);
      return fileObj.filepath;
    }

    const keyParts = minioKey.split('/');
    if (keyParts.length < 3) {
      logger.warn(`Invalid Minio key format: ${minioKey}`);
      return fileObj.filepath;
    }

    const basePath = keyParts[0];
    const userId = keyParts[1];
    const fileName = keyParts.slice(2).join('/');

    const newUrl = await getMinioURL({
      userId,
      fileName,
      basePath,
      bucket: bucketName,
    });

    logger.debug(`Refreshed Minio URL for key: ${minioKey}`);
    return newUrl;
  } catch (error) {
    logger.error(`Error refreshing Minio URL: ${error.message}`);
    return fileObj.filepath;
  }
}

module.exports = {
  saveBufferToMinio,
  saveURLToMinio,
  getMinioURL,
  deleteFileFromMinio,
  uploadFileToMinio,
  getMinioFileStream,
  refreshMinioFileUrls,
  refreshMinioUrl,
  needsRefresh,
  getNewMinioURL,
};
