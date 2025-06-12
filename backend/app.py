from flask import Flask, request, jsonify, send_from_directory
import hashlib
import json
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import sqlite3
from transformers import pipeline

from database import init_database, get_db_connection, cleanup_old_clipboard_entries, create_uploads_directory

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize database and directories on startup
init_database()
create_uploads_directory()

# Initialize AI model
try:
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
except Exception as e:
    print(f"Warning: Could not load AI model: {e}")
    summarizer = None

def generate_file_hash(content):
    """Generate MD5 hash of file content."""
    return hashlib.md5(content.encode('utf-8')).hexdigest()

def detect_content_type(content):
    """Simple content type detection based on content patterns."""
    content_lower = content.lower().strip()
    
    if content_lower.startswith(('http://', 'https://', 'www.')):
        return 'url'
    elif '@' in content and '.' in content.split('@')[-1]:
        return 'email'
    elif any(keyword in content_lower for keyword in ['def ', 'function', 'class ', 'import ', 'const ', 'var ']):
        return 'code'
    elif content.isdigit() or (content.replace('.', '').replace('-', '').isdigit()):
        return 'number'
    else:
        return 'text'

# CORS headers for local development
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get list of all unique project names."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT project_name FROM versions ORDER BY project_name')
        projects = [row['project_name'] for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'projects': projects
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_version():
    """Save a new version (file upload or text content)."""
    try:
        project_name = request.form.get('project_name', '').strip()
        filename = request.form.get('filename', '').strip()
        comment = request.form.get('comment', '').strip()
        
        if not project_name:
            return jsonify({'success': False, 'error': 'Project name is required'}), 400
        
        # Handle file upload
        if 'file' in request.files and request.files['file'].filename:
            file = request.files['file']
            filename = secure_filename(file.filename) if filename == '' else secure_filename(filename)
            content = file.read().decode('utf-8', errors='ignore')
        
        # Handle text content
        elif 'content' in request.form:
            content = request.form.get('content', '')
            if not filename:
                filename = f"text_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        else:
            return jsonify({'success': False, 'error': 'No file or content provided'}), 400
        
        if not content.strip():
            return jsonify({'success': False, 'error': 'Content cannot be empty'}), 400
        
        # Generate file hash and timestamp
        file_hash = generate_file_hash(content)
        timestamp = datetime.now().isoformat()
        
        # Save to database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO versions (project_name, filename, content, comment, timestamp, file_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (project_name, filename, content, comment, timestamp, file_hash))
        
        version_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Create project directory and save file
        project_dir = os.path.join('uploads', 'projects', secure_filename(project_name))
        os.makedirs(project_dir, exist_ok=True)
        
        file_path = os.path.join(project_dir, f"{version_id}_{filename}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'success': True,
            'version_id': version_id,
            'message': f'Version saved successfully for project "{project_name}"'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/versions/<project>', methods=['GET'])
def get_versions(project):
    """Get all versions for a specific project."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, filename, comment, timestamp, file_hash 
            FROM versions 
            WHERE project_name = ? 
            ORDER BY timestamp DESC
        ''', (project,))
        
        versions = []
        for row in cursor.fetchall():
            versions.append({
                'id': row['id'],
                'filename': row['filename'],
                'comment': row['comment'],
                'timestamp': row['timestamp'],
                'file_hash': row['file_hash']
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'project': project,
            'versions': versions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/version/<int:version_id>/content', methods=['GET'])
def get_version_content(version_id):
    """Get the content of a specific version."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT content, filename FROM versions WHERE id = ?', (version_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'error': 'Version not found'}), 404
        
        return jsonify({
            'success': True,
            'content': row['content'],
            'filename': row['filename']
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/clipboard', methods=['GET'])
def get_clipboard():
    """Get clipboard entries from the last 24 hours."""
    try:
        # Clean up old entries first
        cleanup_old_clipboard_entries()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, content, timestamp, content_type, source_app 
            FROM clipboard 
            ORDER BY timestamp DESC
        ''')
        
        entries = []
        for row in cursor.fetchall():
            entries.append({
                'id': row['id'],
                'content': row['content'],
                'timestamp': row['timestamp'],
                'content_type': row['content_type'],
                'source_app': row['source_app']
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'entries': entries
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
    

@app.route('/api/clipboard', methods=['POST'])
def save_clipboard():
    """Save a new clipboard entry."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        content = data.get('content', '').strip()
        source_app = data.get('source_app', '')
        
        if not content:
            return jsonify({'success': False, 'error': 'Content cannot be empty'}), 400
        
        # Detect content type
        content_type = detect_content_type(content)
        timestamp = datetime.now().isoformat()
        
        # Check if this exact content was already saved recently (within last minute)
        conn = get_db_connection()
        cursor = conn.cursor()
        recent_time = (datetime.now() - timedelta(minutes=1)).isoformat()
        cursor.execute('''
            SELECT id FROM clipboard 
            WHERE content = ? AND timestamp > ?
        ''', (content, recent_time))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({
                'success': True,
                'message': 'Duplicate content ignored (too recent)'
            })
        
        # Save new entry
        cursor.execute('''
            INSERT INTO clipboard (content, timestamp, content_type, source_app)
            VALUES (?, ?, ?, ?)
        ''', (content, timestamp, content_type, source_app))
        
        entry_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'entry_id': entry_id,
            'content_type': content_type,
            'message': 'Clipboard entry saved successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/clipboard/<int:entry_id>', methods=['DELETE'])
def delete_clipboard_entry(entry_id):
    """Delete a specific clipboard entry."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM clipboard WHERE id = ?', (entry_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Clipboard entry deleted successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze-diff', methods=['POST'])
def analyze_diff():
    """Analyze the differences between two versions using AI."""
    try:
        data = request.get_json()
        old_content = data.get('old_content', '')
        new_content = data.get('new_content', '')
        
        if not old_content or not new_content:
            return jsonify({
                'success': False,
                'error': 'Both old and new content are required'
            }), 400
        
        # Generate diff summary
        analysis = {
            'summary': '',
            'insights': []
        }
        
        if summarizer:
            # Prepare text for analysis
            diff_text = f"Changes made:\nOld version: {old_content}\nNew version: {new_content}"
            
            # Generate summary
            summary = summarizer(diff_text, max_length=130, min_length=30, do_sample=False)
            analysis['summary'] = summary[0]['summary_text']
            
            # Generate insights
            if len(old_content) > len(new_content):
                analysis['insights'].append("Content was reduced in length")
            elif len(new_content) > len(old_content):
                analysis['insights'].append("Content was expanded")
            
            # Check for code changes
            if 'def ' in new_content or 'function' in new_content or 'class ' in new_content:
                analysis['insights'].append("Code structure was modified")
            
            # Check for formatting changes
            if old_content.count('\n') != new_content.count('\n'):
                analysis['insights'].append("Formatting was changed")
        
        return jsonify({
            'success': True,
            'analysis': analysis
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Serve static files for development
@app.route('/')
def index():
    return "Clipboard + Version Control API Server is running!"

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)