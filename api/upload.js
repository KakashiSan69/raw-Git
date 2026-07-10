const multer = require('multer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure multer for in-memory storage (max 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
}).single('file');

// Helper middleware runner for Vercel
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

function sanitizeFilename(name) {
  const dotIndex = name.lastIndexOf('.');
  const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
  const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
  
  const cleanBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')       // collapse consecutive hyphens
    .replace(/^-|-$/g, '');    // trim starting/trailing hyphens
    
  return (cleanBase || 'file') + ext;
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Run Multer upload parsing middleware
    await runMiddleware(req, res, upload);
    
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const repoPath = process.env.GITHUB_PATH || 'uploads';

    if (!token || !owner || !repo) {
      return res.status(500).json({ 
        error: 'Server configuration error: GitHub token, owner, or repo is missing in environment variables.' 
      });
    }

    // Sanitize filename and append unique timestamp to avoid collisions
    const sanitized = sanitizeFilename(file.originalname);
    const timestamp = Date.now();
    const finalFilename = `${timestamp}-${sanitized}`;
    
    // Construct the path within the GitHub repo
    const githubFilePath = repoPath ? `${repoPath}/${finalFilename}` : finalFilename;

    // Convert file buffer to base64 encoding
    const contentBase64 = file.buffer.toString('base64');

    // GitHub API URL to write a file
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${githubFilePath}`;

    // Call GitHub REST API using fetch
    const response = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload ${file.originalname} via GitShare Vercel API`,
        content: contentBase64
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: responseData.message || 'GitHub API upload failed' 
      });
    }

    return res.status(200).json({
      success: true,
      filename: finalFilename,
      originalName: file.originalname,
      size: file.size,
      rawUrl: responseData.content.download_url,
      repoPath: githubFilePath,
      htmlUrl: responseData.content.html_url
    });

  } catch (error) {
    console.error('Vercel upload API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error occurred' });
  }
};

// CRITICAL: Disable Vercel default body parsing so Multer can parse multi-part/form-data
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
