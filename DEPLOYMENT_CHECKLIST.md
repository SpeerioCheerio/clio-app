# 🚀 Clio Deployment Checklist

## ✅ Pre-Deployment (Completed)
- [x] Fixed duplicate API_BASE_URL configurations
- [x] Updated CORS settings for production
- [x] Verified render.yaml configuration
- [x] Confirmed environment variables setup
- [x] Updated deployment documentation

## 📋 Your Deployment Tasks

### 1. Commit and Push Changes
```bash
git add .
git commit -m "Prepare Clio for deployment"
git push origin main
```

### 2. Deploy on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Wait for deployment (5-10 minutes)

### 3. Set Environment Variables
1. In Render dashboard, go to your **backend service**
2. Click "Environment"
3. Add: `OPENAI_API_KEY` = `your_actual_api_key_here`

### 4. Update CORS Settings
1. **After deployment**, note your frontend URL (e.g., `https://your-app-name.onrender.com`)
2. Update `backend/app.py` line 27:
   ```python
   allowed_origins = [
       'https://your-actual-frontend-url.onrender.com',  # Your real URL
   ]
   ```
3. Commit and push this change

### 5. Test Your Deployment
Visit your frontend URL and test:
- [ ] Dashboard loads
- [ ] Version control works (upload/view files)
- [ ] Folder manager works (Chrome/Edge/Opera only)
- [ ] API health check: `https://your-backend-name.onrender.com/api/health`

## 🔧 Optional: Local Desktop Integration
If you want clipboard monitoring on your local machine:

1. Update `desktop/config.json`:
   ```json
   {
       "api_url": "https://your-backend-url.onrender.com",
       "check_interval": 2
   }
   ```

2. Run locally:
   ```bash
   cd desktop
   python clipboard_monitor.py
   ```

## ⚠️ Important Notes

### Data Persistence
- **Free Tier**: Data is lost on service restarts
- **Paid Tier**: Consider PostgreSQL for production use

### Components
- **Web App**: Deployed on Render (accessible anywhere)
- **Desktop Apps**: Run locally, communicate with deployed backend

### Browser Support
- **Folder Manager**: Chrome, Edge, Opera only
- **Other Features**: All modern browsers

## 🚨 Troubleshooting

### Common Issues
1. **CORS Error**: Update backend CORS settings with actual frontend URL
2. **API Errors**: Check `OPENAI_API_KEY` is set in Render
3. **Deploy Fails**: Check logs in Render dashboard

### Need Help?
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
- View logs in Render dashboard
- Test backend health endpoint

---

**Ready to deploy? Start with step 1 above!** 🚀 