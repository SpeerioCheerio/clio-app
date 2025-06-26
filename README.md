# Clio - Clipboard & Version Control System

A modern web application for managing clipboard history and file version control with AI-powered diff analysis, plus local desktop applications for enhanced functionality.

## Features

- **Clipboard History**: Track and manage your clipboard entries with smart content detection
- **Version Control**: Save and track file versions with comments and visual diffs
- **AI-Powered Analysis**: Use OpenAI to analyze differences between file versions
- **Project Organization**: Group projects and manage them efficiently
- **Modern UI**: Clean, responsive interface built with vanilla JavaScript
- **Desktop Integration**: Local desktop applications for clipboard monitoring and keyboard shortcuts

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd clipboard-version-app
   ```

2. **Set up the backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp env.template .env
   # Edit .env and add your OpenAI API key
   python app.py
   ```

3. **Open the frontend**
   - Open `frontend/index.html` in your browser
   - Or serve it with a local server: `python -m http.server 8000`

4. **Optional: Run desktop applications**
   ```bash
   cd desktop
   pip install -r requirements.txt
   python clipboard_monitor.py  # Monitor clipboard
   python key_mapper.py         # Keyboard shortcuts
   ```

### Deployment

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

Quick deployment steps:
1. Push your code to a Git repository
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Create a new Blueprint and connect your repository
4. Set your `OPENAI_API_KEY` in the environment variables
5. Wait for deployment (5-10 minutes)

## Project Structure

```
clipboard-version-app/
├── backend/                 # Flask API server
│   ├── app.py              # Main Flask application
│   ├── database.py         # Database operations
│   ├── requirements.txt    # Python dependencies
│   ├── .env               # Environment variables (create from env.template)
│   └── uploads/            # File uploads directory
│       └── projects/       # Project files
├── frontend/               # Static web application
│   ├── index.html          # Main dashboard
│   ├── app.js              # Shared utilities
│   ├── style.css           # Main styles
│   ├── assets/             # Static assets (images, icons)
│   ├── clipboard/          # Clipboard management interface
│   │   ├── clipboard.html  # Clipboard history page
│   │   └── clipboard.js    # Clipboard functionality
│   └── version/            # Version control interface
│       ├── version.html    # Version control page
│       ├── version.js      # Version management
│       └── diff.js         # Diff visualization
├── desktop/                # Local desktop applications (NOT deployed)
│   ├── clipboard_monitor.py # System clipboard monitor
│   ├── key_mapper.py       # Keyboard shortcut manager
│   ├── requirements.txt    # Desktop app dependencies
│   ├── config.json         # Desktop app configuration
│   └── clipboard_slots.json # Local clipboard slots
├── docs/                   # Documentation
├── render.yaml             # Render deployment config
└── README.md               # This file
```

## Components

### Web Application (Deployed)
- **Backend API**: Flask server providing REST API endpoints
- **Frontend**: Static web application with clipboard and version control interfaces
- **Database**: SQLite database for storing clipboard entries and file versions

### Desktop Applications (Local Only)
- **Clipboard Monitor**: Monitors system clipboard and sends data to the web API
- **Key Mapper**: Provides keyboard shortcuts (F6-F9) for clipboard slot management
- **Configuration**: Local settings and clipboard slot storage

## API Endpoints

### Health Check
- `GET /api/health` - Check backend status

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/upload` - Upload new version
- `GET /api/versions/<project>` - Get project versions
- `DELETE /api/project/<name>` - Delete project

### Clipboard
- `GET /api/clipboard` - Get clipboard history
- `POST /api/clipboard` - Save clipboard entry
- `DELETE /api/clipboard/<id>` - Delete clipboard entry

### Analysis
- `POST /api/analyze-diff` - Analyze differences with AI

## Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
FLASK_ENV=development
```

### Desktop Configuration

The desktop applications use local configuration files:
- `desktop/config.json` - Monitor settings
- `desktop/clipboard_slots.json` - Clipboard slot storage

## Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API will be available at `http://localhost:5000`

### Frontend Development

The frontend is a static application. You can:
- Open `frontend/index.html` directly in a browser
- Use a local server: `python -m http.server 8000`
- Use any static file server

### Desktop Applications

```bash
cd desktop
pip install -r requirements.txt

# Run clipboard monitor
python clipboard_monitor.py

# Run key mapper (in separate terminal)
python key_mapper.py
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the frontend and backend URLs are properly configured
2. **OpenAI API Errors**: Check your API key and credits
3. **Database Issues**: Ensure the database file is writable
4. **File Upload Issues**: Check the uploads directory permissions
5. **Desktop App Issues**: Ensure required Python packages are installed

### Logs

- Backend logs are printed to the console
- Check browser console for frontend errors
- Use the `/api/health` endpoint to check backend status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to use and modify as needed.

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review the deployment guide
3. Check the application logs
4. Create an issue in the repository 