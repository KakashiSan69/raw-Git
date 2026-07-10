const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve frontend static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for in-memory storage (max 25MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB limit
});

/**
 * Sanitizes a filename to be URL-friendly, replacing spaces and special characters.
 */
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

// Endpoint to handle file upload and push to GitHub
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
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

    console.log(`Uploading file ${file.originalname} as ${finalFilename} to GitHub...`);

    // Call GitHub REST API using global fetch (Node.js 18+ has fetch built-in)
    const response = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload ${file.originalname} via GitHub Web Uploader`,
        content: contentBase64
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('GitHub API error:', responseData);
      return res.status(response.status).json({ 
        error: responseData.message || 'GitHub API upload failed' 
      });
    }

    console.log(`Successfully uploaded ${finalFilename} to GitHub!`);

    // The download_url returned by the API is the raw githubusercontent URL
    const rawUrl = responseData.content.download_url;

    return res.json({
      success: true,
      filename: finalFilename,
      originalName: file.originalname,
      size: file.size,
      rawUrl: rawUrl,
      repoPath: githubFilePath,
      htmlUrl: responseData.content.html_url
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error occurred' });
  }
});

// Fallback to serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
