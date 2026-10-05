const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { fromFile } = require('file-type');
const { config } = require('../config/env');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];

/**
 * Builds a configured multer instance that stores files under
 * server/uploads/<subfolder>/ with a collision-proof filename, and rejects
 * anything outside the allowed size/mimetype per spec §23 (file upload
 * validation, file size limits). The chosen allowedTypes is stashed on the
 * returned instance so handleUpload/handleFieldsUpload can reuse it for
 * the magic-byte check below, without every route having to pass it twice.
 *
 * @param {string} subfolder - e.g. 'houses', 'tenants', 'families'
 * @param {string[]} allowedTypes - defaults to image types only
 */
function makeUploader(subfolder, allowedTypes = ALLOWED_IMAGE_TYPES) {
  const uploadPath = path.join(__dirname, '..', config.uploadDir, subfolder);
  fs.mkdirSync(uploadPath, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });

  const fileFilter = (req, file, cb) => {
    // First-pass check: the browser-reported MIME type. This is trivially
    // spoofable by a client, so it only filters out obviously-wrong
    // uploads early — the real check is verifyFileSignatures below, which
    // reads the file's actual magic bytes after multer has saved it.
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type. Allowed: ${allowedTypes.join(', ')}`));
    }
    cb(null, true);
  };

  const uploader = multer({
    storage,
    fileFilter,
    limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  });

  uploader._allowedTypes = allowedTypes;
  return uploader;
}

/**
 * Verifies each uploaded file's ACTUAL content type by reading its magic
 * bytes, not just the Content-Type header the client claimed (spec §23:
 * "file upload validation" — for a system that stores identity documents,
 * trusting a client-supplied header alone isn't meaningful validation).
 * Returns the list of rejected original filenames (empty if everything
 * passed). Does NOT delete files itself — see cleanupFiles below, which
 * the caller uses to remove the *entire* batch if any file fails, so a
 * partially-valid upload never leaves orphaned files with no DB record
 * pointing at them.
 */
async function verifyFileSignatures(files, allowedTypes) {
  const rejected = [];

  for (const file of files) {
    try {
      const detected = await fromFile(file.path);
      const isValid = detected && allowedTypes.includes(detected.mime);
      if (!isValid) {
        rejected.push(file.originalname);
      }
    } catch {
      rejected.push(file.originalname);
    }
  }

  return rejected;
}

function cleanupFiles(files) {
  for (const file of files) {
    fs.unlink(file.path, () => {}); // best-effort, don't block the response on it
  }
}

// Wraps a multer single-file middleware so its errors go through the
// standard { success:false, message } shape instead of multer's default
// error format, matching spec §29 (never show raw backend errors), and
// runs the magic-byte check on whatever was saved.
function handleUpload(uploader, fieldName) {
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File is too large. Maximum size is ${config.maxFileSizeMb}MB.`,
          });
        }
        return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
      }

      if (req.file) {
        const rejected = await verifyFileSignatures([req.file], uploader._allowedTypes);
        if (rejected.length > 0) {
          cleanupFiles([req.file]);
          req.file = undefined;
          return res.status(400).json({
            success: false,
            message: `"${rejected[0]}" does not look like a valid file of an allowed type. Please upload a genuine JPEG, PNG, WEBP, or PDF file.`,
          });
        }
      }

      next();
    });
  };
}

// Wraps a multer .fields() middleware (for forms that submit both a single
// photo AND multiple document files in one request, e.g. tenant/family
// registration) with the same standardized error handling and magic-byte
// verification as handleUpload.
function handleFieldsUpload(uploader, fieldsConfig) {
  return (req, res, next) => {
    uploader.fields(fieldsConfig)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File is too large. Maximum size is ${config.maxFileSizeMb}MB.`,
          });
        }
        return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
      }

      if (req.files) {
        const allFiles = Object.values(req.files).flat();
        const rejected = await verifyFileSignatures(allFiles, uploader._allowedTypes);
        if (rejected.length > 0) {
          cleanupFiles(allFiles);
          req.files = undefined;
          return res.status(400).json({
            success: false,
            message: `${rejected.length > 1 ? 'Some files do' : `"${rejected[0]}" does`} not look like a valid file of an allowed type. Please upload genuine JPEG, PNG, WEBP, or PDF files.`,
          });
        }
      }

      next();
    });
  };
}

module.exports = {
  makeUploader,
  handleUpload,
  handleFieldsUpload,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
};
