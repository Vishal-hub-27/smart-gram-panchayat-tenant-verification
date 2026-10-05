const path = require('path');

/**
 * Converts a Multer file object into the public URL path the frontend can
 * use to display it (served statically from server/app.js). Centralized
 * here so houseController/tenantController/familyController all build
 * URLs the same way instead of each re-deriving it from file.destination.
 */
function buildFileUrl(file) {
  if (!file) return null;
  const serverRoot = path.join(__dirname, '..');
  const relative = path.relative(serverRoot, file.path).split(path.sep).join('/');
  return `/${relative}`;
}

/**
 * Cleans up a client-supplied original filename before it's stored as a
 * document's display label. Strips control characters and caps length —
 * defensive hygiene for data coming straight from an upload, not a
 * security-critical escape (React already escapes text when rendering it).
 */
function sanitizeFileLabel(originalname) {
  if (!originalname) return 'Document';
  // eslint-disable-next-line no-control-regex
  const stripped = originalname.replace(/[\x00-\x1f\x7f]/g, '').trim();
  return stripped.slice(0, 150) || 'Document';
}

module.exports = { buildFileUrl, sanitizeFileLabel };
