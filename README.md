# GitShare - GitHub File Uploader

A premium, glassmorphic dark-themed web interface and API that allows users to upload files and get their direct `raw.githubusercontent.com` CDN URLs instantly.

## Features
- **Modern Dark UI**: Glowing gradients, glassmorphism card panels, and smooth CSS transitions.
- **Drag & Drop**: Easily drag files into the browser to upload them.
- **Upload Progress**: Real-time progress bar powered by native XMLHttpRequest tracking.
- **Upload History**: Keeps a record of your last 20 uploaded files in local storage with one-click copy links.
- **Collision Safe**: Filenames are sanitized and prefixed with a unique timestamp to prevent overwriting existing files in the repository.

---

## Configuration & Environment Variables

Create a `.env` file at the root of the project (already configured locally):

```env
PORT=3000
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=username_or_organization
GITHUB_REPO=repository_name
GITHUB_PATH=uploads
```

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the local server**:
   ```bash
   npm start
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Endpoints

### `POST /api/upload`
Uploads a file directly to the configured GitHub repository.

- **Request Format**: `multipart/form-data`
- **Fields**:
  - `file`: The binary file to upload (maximum size 25MB).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "filename": "1783682487996-gitshare-verify.txt",
    "originalName": "gitshare-verify.txt",
    "size": 83,
    "rawUrl": "https://raw.githubusercontent.com/KakashiSan69/ss/master/uploads/1783682487996-gitshare-verify.txt",
    "repoPath": "uploads/1783682487996-gitshare-verify.txt",
    "htmlUrl": "https://github.com/KakashiSan69/ss/blob/master/uploads/1783682487996-gitshare-verify.txt"
  }
  ```

---

## Deploy to Vercel

This repository is optimized for Vercel Serverless Functions out-of-the-box:

1. Push this code to your GitHub repository (e.g., `raw-Git`).
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. In the Vercel project settings, configure the following **Environment Variables**:
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PATH` (optional)
4. Deploy! Vercel will automatically serve the frontend at the root `/` and route the API calls through `/api/upload`.
