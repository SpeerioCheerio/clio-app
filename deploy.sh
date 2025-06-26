#!/bin/bash

# Deployment script for Clio Clipboard App
echo "🚀 Preparing Clio for deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: .env file not found in backend directory"
    echo "   Please create backend/.env with your OPENAI_API_KEY"
    echo "   Example:"
    echo "   OPENAI_API_KEY=your_api_key_here"
fi

# Check if all required files exist
echo "📋 Checking required files..."

required_files=(
    "backend/app.py"
    "backend/database.py"
    "backend/requirements.txt"
    "frontend/index.html"
    "frontend/app.js"
    "frontend/style.css"
    "frontend/clipboard/clipboard.html"
    "frontend/clipboard/clipboard.js"
    "frontend/version/version.html"
    "frontend/version/version.js"
    "frontend/version/diff.js"
    "desktop/clipboard_monitor.py"
    "desktop/key_mapper.py"
    "desktop/requirements.txt"
    "render.yaml"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - Missing!"
        exit 1
    fi
done

echo ""
echo "🎯 Deployment Checklist:"
echo "1. ✅ All required files present"
echo "2. ⚠️  Ensure .env file exists with OPENAI_API_KEY"
echo "3. 📝 Push code to Git repository (GitHub, GitLab, etc.)"
echo "4. 🌐 Go to https://dashboard.render.com/"
echo "5. 🔗 Connect your repository"
echo "6. 📋 Use the render.yaml blueprint or create services manually"
echo "7. 🔑 Set environment variables in Render dashboard:"
echo "   - OPENAI_API_KEY: your_openai_api_key"
echo "   - FLASK_ENV: production"
echo "8. ⏳ Wait for deployment (5-10 minutes)"
echo "9. 🧪 Test your deployment"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
echo ""
echo "🔗 Useful URLs after deployment:"
echo "   Backend: https://your-backend-name.onrender.com"
echo "   Frontend: https://your-frontend-name.onrender.com"
echo "   Health Check: https://your-backend-name.onrender.com/api/health"
echo "   Clipboard: https://your-frontend-name.onrender.com/clipboard/clipboard.html"
echo "   Version Control: https://your-frontend-name.onrender.com/version/version.html"
echo ""
echo "💻 Desktop Applications (Local Only):"
echo "   These are NOT deployed - run locally for enhanced functionality"
echo "   - clipboard_monitor.py: Monitor system clipboard"
echo "   - key_mapper.py: Keyboard shortcuts (F6-F9)" 