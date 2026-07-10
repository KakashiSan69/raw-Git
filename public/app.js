// GitShare Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filePreview = document.getElementById('filePreview');
  const previewIcon = document.getElementById('previewIcon');
  const previewName = document.getElementById('previewName');
  const previewSize = document.getElementById('previewSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  
  const uploadStatus = document.getElementById('uploadStatus');
  const statusTitle = document.getElementById('statusTitle');
  const statusPercent = document.getElementById('statusPercent');
  const progressBarFill = document.getElementById('progressBarFill');
  
  const resultPanel = document.getElementById('resultPanel');
  const rawUrlInput = document.getElementById('rawUrlInput');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const viewRawBtn = document.getElementById('viewRawBtn');
  const uploadMoreBtn = document.getElementById('uploadMoreBtn');
  
  const historyEmpty = document.getElementById('historyEmpty');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastContainer = document.getElementById('toastContainer');

  // App State
  let selectedFile = null;

  // Initialize
  loadHistory();

  // --- Drag & Drop Event Listeners ---
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // Remove selected file
  removeFileBtn.addEventListener('click', () => {
    resetUploader();
  });

  // --- File Upload ---
  uploadBtn.addEventListener('click', () => {
    if (!selectedFile) return;
    uploadFile(selectedFile);
  });

  // --- Copy URLs ---
  copyUrlBtn.addEventListener('click', () => {
    copyToClipboard(rawUrlInput.value, copyUrlBtn);
  });

  // --- Reset/Upload More ---
  uploadMoreBtn.addEventListener('click', () => {
    resetUploader();
  });

  // --- History Cleans ---
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your upload history?')) {
      localStorage.removeItem('gitshare_history');
      loadHistory();
      showToast('History cleared successfully', 'success');
    }
  });

  // --- Helper Functions ---

  // Handle File Selection
  function handleFileSelection(file) {
    // 25 MB Limit check
    const limit = 25 * 1024 * 1024;
    if (file.size > limit) {
      showToast('File is too large. Maximum size is 25 MB.', 'error');
      return;
    }

    selectedFile = file;
    
    // Set preview name & size
    previewName.textContent = file.name;
    previewSize.textContent = formatBytes(file.size);
    
    // Set appropriate file icon
    previewIcon.className = `fa-regular ${getFileIconClass(file.name)} file-type-icon`;

    // Toggle views
    dropzone.classList.add('hidden');
    filePreview.classList.remove('hidden');
    showToast(`Selected file: ${file.name}`, 'info');
  }

  // Reset Uploader state
  function resetUploader() {
    selectedFile = null;
    fileInput.value = '';
    
    // Visibility toggle
    dropzone.classList.remove('hidden');
    filePreview.classList.add('hidden');
    uploadStatus.classList.add('hidden');
    resultPanel.classList.add('hidden');
    
    // Reset progress
    statusPercent.textContent = '0%';
    progressBarFill.style.width = '0%';
  }

  // Upload File using XMLHttpRequest to track actual progress
  function uploadFile(file) {
    // Hide preview, show progress
    filePreview.classList.add('hidden');
    uploadStatus.classList.remove('hidden');
    statusTitle.textContent = 'Uploading file...';
    
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        statusPercent.textContent = `${percent}%`;
        progressBarFill.style.width = `${percent}%`;
        
        if (percent === 100) {
          statusTitle.textContent = 'Finalizing upload on GitHub...';
        }
      }
    });

    // Handle complete
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          showUploadSuccess(response);
        } catch (e) {
          showUploadError('Invalid response from server.');
        }
      } else {
        let errMsg = 'Upload failed';
        try {
          const response = JSON.parse(xhr.responseText);
          errMsg = response.error || errMsg;
        } catch (e) {}
        showUploadError(errMsg);
      }
    };

    // Handle error
    xhr.onerror = () => {
      showUploadError('A network error occurred during upload.');
    };

    // Send request to server
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  // Show upload success
  function showUploadSuccess(data) {
    uploadStatus.classList.add('hidden');
    resultPanel.classList.remove('hidden');
    
    rawUrlInput.value = data.rawUrl;
    viewRawBtn.href = data.rawUrl;
    
    // Save to history
    saveToHistory({
      id: Date.now().toString(),
      originalName: data.originalName,
      filename: data.filename,
      rawUrl: data.rawUrl,
      size: data.size,
      timestamp: Date.now()
    });

    showToast('File uploaded successfully!', 'success');
  }

  // Show upload error
  function showUploadError(message) {
    showToast(message, 'error');
    
    // Re-enable file preview
    uploadStatus.classList.add('hidden');
    filePreview.classList.remove('hidden');
  }

  // Save item to LocalStorage history
  function saveToHistory(item) {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('gitshare_history')) || [];
    } catch (e) {
      history = [];
    }
    
    // Add to beginning of array
    history.unshift(item);
    
    // Limit to 20 items
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    localStorage.setItem('gitshare_history', JSON.stringify(history));
    loadHistory();
  }

  // Load history from LocalStorage
  function loadHistory() {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('gitshare_history')) || [];
    } catch (e) {
      history = [];
    }

    if (history.length === 0) {
      historyEmpty.classList.remove('hidden');
      historyList.classList.add('hidden');
      historyList.innerHTML = '';
      return;
    }

    historyEmpty.classList.add('hidden');
    historyList.classList.remove('hidden');
    
    historyList.innerHTML = '';
    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      
      const fileIcon = getFileIconClass(item.originalName);
      const formattedSize = formatBytes(item.size);
      const timeStr = formatTimeAgo(item.timestamp);
      
      li.innerHTML = `
        <div class="item-left">
          <i class="fa-regular ${fileIcon}"></i>
          <div class="item-info">
            <span class="item-name" title="${item.originalName}">${item.originalName}</span>
            <span class="item-meta">${formattedSize} &bull; ${timeStr}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="item-action-btn copy" title="Copy raw URL">
            <i class="fa-regular fa-copy"></i>
          </button>
          <a href="${item.rawUrl}" target="_blank" class="item-action-btn open" title="Open raw file">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      `;

      // Copy listener
      const copyBtn = li.querySelector('.copy');
      copyBtn.addEventListener('click', () => {
        copyToClipboard(item.rawUrl, copyBtn);
      });
      
      historyList.appendChild(li);
    });
  }

  // Copy to clipboard helper
  function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('URL copied to clipboard!', 'success');
      
      // Update button icon briefly
      const icon = button.querySelector('i');
      const originalClass = icon.className;
      
      icon.className = 'fa-solid fa-check';
      button.style.background = 'rgba(16, 185, 129, 0.15)';
      button.style.color = 'var(--success)';
      
      setTimeout(() => {
        icon.className = originalClass;
        button.style.background = '';
        button.style.color = '';
      }, 1500);
    }).catch(err => {
      showToast('Failed to copy text.', 'error');
    });
  }

  // Toast notifications helper
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    
    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // Helper: Format bytes to human readable string
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Helper: Get FontAwesome file icon based on extension
  function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const iconMap = {
      'pdf': 'fa-file-pdf',
      'doc': 'fa-file-word',
      'docx': 'fa-file-word',
      'xls': 'fa-file-excel',
      'xlsx': 'fa-file-excel',
      'ppt': 'fa-file-powerpoint',
      'pptx': 'fa-file-powerpoint',
      'png': 'fa-file-image',
      'jpg': 'fa-file-image',
      'jpeg': 'fa-file-image',
      'gif': 'fa-file-image',
      'svg': 'fa-file-image',
      'webp': 'fa-file-image',
      'zip': 'fa-file-zipper',
      'rar': 'fa-file-zipper',
      'tar': 'fa-file-zipper',
      'gz': 'fa-file-zipper',
      'txt': 'fa-file-lines',
      'md': 'fa-file-lines',
      'js': 'fa-file-code',
      'ts': 'fa-file-code',
      'html': 'fa-file-code',
      'css': 'fa-file-code',
      'json': 'fa-file-code',
      'py': 'fa-file-code',
      'mp3': 'fa-file-audio',
      'wav': 'fa-file-audio',
      'mp4': 'fa-file-video',
      'mkv': 'fa-file-video',
      'avi': 'fa-file-video'
    };

    return iconMap[ext] || 'fa-file';
  }

  // Helper: Format timestamp to "X time ago"
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }
});
