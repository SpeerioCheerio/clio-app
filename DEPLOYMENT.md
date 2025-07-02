# Deployment Guide for Clio on Render

This guide will help you deploy your Clio clipboard and version control app to Render with separate backend and frontend services.

## 🚀 Quick Deployment (Recommended)

### Prerequisites
- A Render account (free tier available)
- Your OpenAI API key
- Git repository with your code pushed to GitHub/GitLab

### Step 1: Deploy Using Blueprint (render.yaml)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy on Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` file and create both services

3. **Set Environment Variables**
   - In the Render dashboard, go to your backend service
   - Go to "Environment"
   - Add your `OPENAI_API_KEY` (this will be automatically added to the clio-secrets group)

4. **Update CORS Settings**
   - After deployment, note your frontend URL (e.g., `https://your-frontend-name.onrender.com`)
   - Update `backend/app.py` line 27 with your actual frontend URL:
   ```python
   allowed_origins = [
       'https://your-actual-frontend-url.onrender.com',  # Replace with your URL
   ]
   ```
   - Commit and push this change

### Step 2: Test Your Deployment

Your app will be available at:
- **Frontend**: `https://your-frontend-name.onrender.com`
- **Backend API**: `https://your-backend-name.onrender.com/api/health`

Test all functionality:
- ✅ Dashboard loads
- ✅ Clipboard history (if using local desktop components)
- ✅ Version control (upload/view versions)
- ✅ Folder manager (Chrome/Edge/Opera only)

## 📋 Pre-Deployment Changes Summary

The following changes have been made to prepare for deployment:

### ✅ Fixed Issues
1. **API URL Configuration**: Removed duplicate API_BASE_URL definitions
2. **CORS Configuration**: Updated for production URLs
3. **Environment Variables**: Configured for production
4. **File Structure**: Verified all necessary files are included

### ⚠️ Important Notes

#### Data Persistence
- **SQLite Database**: Your data will be lost on service restarts (Render free tier limitation)
- **File Uploads**: Uploaded files are stored temporarily and will be lost on restart
- **Recommendation**: For production use, consider upgrading to PostgreSQL

#### Desktop Components (Local Only)
The `desktop/` folder contains local applications that are **NOT deployed**:
- `clipboard_monitor.py` - Must run locally to monitor clipboard
- `key_mapper.py` - Must run locally for keyboard shortcuts
- These communicate with your deployed web application

#### Browser Compatibility
- **Folder Manager**: Requires Chrome, Edge, or Opera (version 86+)
- **Other features**: Work in all modern browsers

## 🔧 Manual Deployment (Alternative)

If you prefer to deploy manually:

### Backend Service
1. **Create Web Service**
   - Type: Web Service
   - Name: `clio-backend`
   - Environment: Python
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120`
   - Health Check Path: `/api/health`

### Frontend Service
1. **Create Static Site**
   - Type: Static Site
   - Name: `clio-frontend`
   - Build Command: (leave empty)
   - Publish Directory: `frontend`

## 🚨 Post-Deployment Tasks

### 1. Update CORS Settings
After deployment, update `backend/app.py` with your actual frontend URL:

```python
# Line ~27 in backend/app.py
allowed_origins = [
    'https://your-actual-frontend-url.onrender.com',  # Your real URL here
]
```

### 2. Set Up Local Desktop Components (Optional)
If you want clipboard monitoring:

1. **Update desktop configuration**
   ```json
   // desktop/config.json
   {
       "api_url": "https://your-backend-url.onrender.com",
       "check_interval": 2
   }
   ```

2. **Run locally**
   ```bash
   cd desktop
   python clipboard_monitor.py  # Terminal 1
   python key_mapper.py         # Terminal 2
   ```

### 3. Test All Features
- **Home Dashboard**: Should load and show statistics
- **Clipboard History**: Works with desktop component or manual entries
- **Version Control**: Upload files, view versions, compare diffs
- **Folder Manager**: Browse local folders (Chrome/Edge/Opera only)

## 🛠️ Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify frontend URL is in backend CORS settings
   - Check that both services are running

2. **API Connection Issues**
   - Test backend health: `https://your-backend-url.onrender.com/api/health`
   - Check environment variables are set

3. **File Upload Issues**
   - Files are stored temporarily on Render free tier
   - Consider cloud storage for production

4. **OpenAI Features Not Working**
   - Verify `OPENAI_API_KEY` is set in Render dashboard
   - Check API key has sufficient credits

5. **Data Loss on Restart**
   - Normal behavior on Render free tier
   - Upgrade to paid plan or use external database for persistence

### Logs and Debugging
- View service logs in Render dashboard
- Use `/api/health` endpoint to check backend status
- Check browser console for frontend errors

## 🎯 Production Recommendations

### For Serious Use
1. **Database**: Upgrade to PostgreSQL for data persistence
2. **File Storage**: Use AWS S3 or Google Cloud Storage
3. **Monitoring**: Set up uptime monitoring
4. **Backup**: Regular database backups
5. **Security**: Implement authentication if handling sensitive data

### Performance Optimization
1. **Render Plan**: Consider upgrading from free tier for better performance
2. **CDN**: Use a CDN for static assets if you have many users
3. **Caching**: Implement appropriate caching strategies

## 📞 Support

- **Render Documentation**: [https://render.com/docs](https://render.com/docs)
- **Check Service Status**: Use the health check endpoint
- **Logs**: Available in Render dashboard for each service

---

**Note**: This deployment uses Render's free tier by default. While perfect for testing and personal use, consider upgrading to paid plans for production applications that require guaranteed uptime and data persistence. 