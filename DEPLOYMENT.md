# Deployment Guide for Render

This guide will help you deploy your clipboard version app to Render.

## Prerequisites

1. A Render account (free tier available)
2. Your OpenAI API key
3. Git repository with your code

## Step 1: Prepare Your Repository

Your repository should have the following structure:
```
clipboard-version-app/
├── backend/
│   ├── app.py
│   ├── database.py
│   ├── requirements.txt
│   ├── .env (create from env.template)
│   └── uploads/
│       └── projects/
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── assets/
│   ├── clipboard/
│   │   ├── clipboard.html
│   │   └── clipboard.js
│   └── version/
│       ├── version.html
│       ├── version.js
│       └── diff.js
├── desktop/ (for local desktop applications)
│   ├── clipboard_monitor.py
│   ├── key_mapper.py
│   ├── requirements.txt
│   ├── config.json
│   └── clipboard_slots.json
├── docs/
├── render.yaml
└── README.md
```

## Step 2: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Blueprint"
4. Connect your Git repository
5. Render will automatically detect the `render.yaml` file and create both services

### Option B: Manual Deployment

#### Backend Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your Git repository
4. Configure the service:
   - **Name**: `clio-backend`
   - **Environment**: `Python`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120`
   - **Health Check Path**: `/api/health`

#### Frontend Service
1. Click "New" → "Static Site"
2. Connect your Git repository
3. Configure the service:
   - **Name**: `clio-frontend`
   - **Build Command**: Leave empty
   - **Publish Directory**: `frontend`

## Step 3: Configure Environment Variables

### Backend Environment Variables
In your backend service settings, add these environment variables:

1. **OPENAI_API_KEY**: Your OpenAI API key
2. **FLASK_ENV**: `production`
3. **PYTHON_VERSION**: `3.11.4`

### Frontend Configuration
The frontend will automatically detect the deployment environment and use relative URLs.

## Step 4: Update CORS Settings

If you're using a custom domain, update the CORS settings in `backend/app.py`:

```python
allowed_origins = [
    'https://clio-frontend.onrender.com',
    'https://your-custom-domain.com'  # Add your domain here
]
```

## Step 5: Test Your Deployment

1. Wait for both services to deploy (this may take 5-10 minutes)
2. Test the backend health endpoint: `https://your-backend-url.onrender.com/api/health`
3. Test the frontend: `https://your-frontend-url.onrender.com`
4. Test the clipboard page: `https://your-frontend-url.onrender.com/clipboard/clipboard.html`
5. Test the version control page: `https://your-frontend-url.onrender.com/version/version.html`

## Important Notes About Components

### Web Application (Deployed on Render)
- **Backend**: Flask API server with database and file storage
- **Frontend**: Static web application with clipboard and version control interfaces
- **Assets**: Static files (images, icons, etc.)

### Desktop Applications (Local Only)
The `desktop/` folder contains local desktop applications that are **NOT deployed** to Render:
- **clipboard_monitor.py**: Monitors system clipboard and sends data to the web API
- **key_mapper.py**: Provides keyboard shortcuts for clipboard management
- **config.json**: Configuration for desktop applications
- **clipboard_slots.json**: Local clipboard slot storage

These desktop applications are designed to run locally on your computer and communicate with the deployed web application.

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check the build logs in Render dashboard
   - Ensure all dependencies are in `requirements.txt`
   - Verify Python version compatibility

2. **CORS Errors**
   - Check that the frontend URL is in the allowed origins list
   - Verify the backend is running and accessible

3. **Database Issues**
   - Render uses ephemeral storage, so data will be lost on restarts
   - Consider using a persistent database service for production

4. **OpenAI API Key Issues**
   - Ensure the API key is correctly set in environment variables
   - Check that the key has sufficient credits

5. **Missing Frontend Pages**
   - Ensure all frontend files are included in the repository
   - Check that the static site is serving all subdirectories

### Logs and Debugging

- View logs in the Render dashboard under each service
- Use the `/api/health` endpoint to check backend status
- Check browser console for frontend errors

## Production Considerations

1. **Database**: Consider using a persistent database service (PostgreSQL, MongoDB)
2. **File Storage**: Use cloud storage (AWS S3, Google Cloud Storage) for file uploads
3. **Security**: Implement proper authentication and authorization
4. **Monitoring**: Set up monitoring and alerting for production use
5. **Backup**: Implement regular backups of your data

## Support

If you encounter issues:
1. Check the Render documentation
2. Review the application logs
3. Test locally first to isolate issues
4. Consider upgrading to a paid plan for better support 