from flask import Flask, request, jsonify, send_from_directory
import hashlib
import json
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import sqlite3
import openai
import pathlib

from dotenv import load_dotenv

# Load environment variables from .env file with override
# This will override any existing environment variables with values from .env
load_dotenv(override=True)

import sys

from database import init_database, get_db_connection, cleanup_old_clipboard_entries, create_uploads_directory

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize database and directories on startup
init_database()
create_uploads_directory()

# Initialize OpenAI API with better error handling
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("[ERROR] FATAL: No OpenAI API key found in environment variables!")
    print("[ERROR] Please ensure a .env file exists in the 'backend' directory with your OPENAI_API_KEY.")
else:
    print(f"[INFO] OpenAI API key loaded successfully. Length: {len(api_key)} characters")
    print(f"[INFO] API key preview: {api_key[:20]}...{api_key[-4:]}")
    openai.api_key = api_key

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

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get list of all unique projects, organized by group."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT project_name, group_name FROM versions ORDER BY group_name, project_name')
        
        projects_by_group = {}
        for row in cursor.fetchall():
            group = row['group_name'] if row['group_name'] else 'Uncategorized'
            project = row['project_name']
            if group not in projects_by_group:
                projects_by_group[group] = []
            projects_by_group[group].append(project)
        
        # Format for frontend
        grouped_projects = []
        for group_name, projects in sorted(projects_by_group.items()):
            grouped_projects.append({'group_name': group_name, 'projects': sorted(projects)})

        conn.close()
        return jsonify({
            'success': True,
            'projects': grouped_projects
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
        group_name = request.form.get('group_name', '').strip() or None
        
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
            INSERT INTO versions (project_name, filename, content, comment, timestamp, file_hash, group_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (project_name, filename, content, comment, timestamp, file_hash, group_name))
        
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
    print("[DEBUG] /api/analyze-diff called")
    try:
        data = request.get_json()
        if not data:
            print("[DEBUG] No JSON data received")
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
            
        print("[DEBUG] Received data keys:", list(data.keys()))
        old_content = data.get('old_content', '')
        new_content = data.get('new_content', '')
        print("[DEBUG] old_content length:", len(old_content))
        print("[DEBUG] new_content length:", len(new_content))

        if not old_content or not new_content:
            print("[DEBUG] Missing old_content or new_content")
            return jsonify({
                'success': False,
                'error': 'Both old and new content are required'
            }), 400

        # Check content size limits (approximately 150,000 characters to stay under token limits)
        MAX_CONTENT_SIZE = 150000
        
        if len(old_content) > MAX_CONTENT_SIZE or len(new_content) > MAX_CONTENT_SIZE:
            print(f"[DEBUG] Content too large - truncating to {MAX_CONTENT_SIZE} characters")
            
            # Truncate content and add notice
            old_content_truncated = old_content[:MAX_CONTENT_SIZE] + "\n\n[Content truncated due to size limits]"
            new_content_truncated = new_content[:MAX_CONTENT_SIZE] + "\n\n[Content truncated due to size limits]"
            
            analysis = {
                'summary': f"File is very large ({len(new_content):,} characters). Analysis is based on the first {MAX_CONTENT_SIZE:,} characters only.",
                'insights': [
                    f"Original file size: {len(new_content):,} characters",
                    f"Analysis limited to first {MAX_CONTENT_SIZE:,} characters",
                    "For large files, consider comparing specific sections manually"
                ]
            }
            
            return jsonify({
                'success': True,
                'analysis': analysis
            })

        # Get the API key and verify it's correct
        api_key = os.environ.get("OPENAI_API_KEY")
        print(f"[DEBUG] Using OpenAI key: {api_key[:20]}...{api_key[-4:] if len(api_key) > 24 else api_key}")
        print(f"[DEBUG] API key length: {len(api_key)}")
        
        if not api_key or len(api_key) < 50:
            print("[DEBUG] API key is too short or missing")
            return jsonify({
                'success': False,
                'error': 'Invalid API key configuration'
            }), 500

        # Compose a prompt for OpenAI
        prompt = (
            "Summarize the main differences between these two versions of text/code. "
            "Highlight key changes, additions, and removals in a concise way.\n\n"
            f"Old version:\n{old_content}\n\nNew version:\n{new_content}\n\nSummary:"
        )
        print("[DEBUG] Prompt for OpenAI:", prompt[:200], "...")

        print("[DEBUG] Creating OpenAI client...")
        client = openai.OpenAI(api_key=api_key)
        print("[DEBUG] OpenAI client created")
        
        print("[DEBUG] Making OpenAI API call...")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Changed to gpt-3.5-turbo for better compatibility
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes diffs between two versions of text or code."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.3,
        )
        print("[DEBUG] OpenAI response received")
        summary = response.choices[0].message.content.strip()
        print("[DEBUG] Summary:", summary)

        analysis = {
            'summary': summary,
            'insights': []
        }

        return jsonify({
            'success': True,
            'analysis': analysis
        })

    except Exception as e:
        print(f"[DEBUG] AI analysis error: {e}")
        import traceback
        print(f"[DEBUG] Full traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/project/<project_name>', methods=['DELETE'])
def delete_project(project_name):
    """Delete a project and all its associated versions and files."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First, delete all versions for the project from the database
        cursor.execute('DELETE FROM versions WHERE project_name = ?', (project_name,))
        deleted_rows = cursor.rowcount
        conn.commit()
        conn.close()

        if deleted_rows == 0:
            return jsonify({'success': False, 'error': 'Project not found or already empty'}), 404

        # Then, delete the project's directory from the filesystem
        project_dir = os.path.join('uploads', 'projects', secure_filename(project_name))
        if os.path.exists(project_dir):
            import shutil
            shutil.rmtree(project_dir)
        
        return jsonify({
            'success': True,
            'message': f'Project "{project_name}" and {deleted_rows} versions deleted successfully.'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/group/<group_name>', methods=['DELETE'])
def delete_group(group_name):
    """Delete all projects within a specific group."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Find all projects in the group
        cursor.execute('SELECT DISTINCT project_name FROM versions WHERE group_name = ?', (group_name,))
        projects_to_delete = [row['project_name'] for row in cursor.fetchall()]

        if not projects_to_delete:
            return jsonify({'success': False, 'error': 'Group not found or is empty'}), 404

        # Delete all versions for these projects
        placeholders = ','.join('?' for project in projects_to_delete)
        cursor.execute(f'DELETE FROM versions WHERE project_name IN ({placeholders})', projects_to_delete)
        deleted_rows = cursor.rowcount
        conn.commit()

        # Delete project directories from filesystem
        for project in projects_to_delete:
            project_dir = os.path.join('uploads', 'projects', secure_filename(project))
            if os.path.exists(project_dir):
                import shutil
                shutil.rmtree(project_dir)

        conn.close()
        return jsonify({
            'success': True,
            'message': f'Group "{group_name}" and {deleted_rows} versions deleted successfully.'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/project/<old_name>', methods=['PUT'])
def rename_project(old_name):
    """Rename a project."""
    try:
        data = request.get_json()
        new_name = data.get('new_name', '').strip()

        if not new_name:
            return jsonify({'success': False, 'error': 'New project name is required'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update project name in the database
        cursor.execute('UPDATE versions SET project_name = ? WHERE project_name = ?', (new_name, old_name))
        updated_rows = cursor.rowcount
        conn.commit()
        conn.close()

        if updated_rows == 0:
            return jsonify({'success': False, 'error': 'Project not found or no versions to update'}), 404

        # Rename the project's directory
        old_dir = os.path.join('uploads', 'projects', secure_filename(old_name))
        new_dir = os.path.join('uploads', 'projects', secure_filename(new_name))
        
        if os.path.exists(old_dir):
            os.rename(old_dir, new_dir)
            
        return jsonify({
            'success': True,
            'message': f'Project "{old_name}" renamed to "{new_name}" successfully.'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/project/<project_name>/group', methods=['PUT'])
def move_project_to_group(project_name):
    """Move a project to a new group."""
    try:
        data = request.get_json()
        new_group = data.get('group_name', '').strip() or None

        if not new_group:
            return jsonify({'success': False, 'error': 'Group name is required'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('UPDATE versions SET group_name = ? WHERE project_name = ?', (new_group, project_name))
        updated_rows = cursor.rowcount
        conn.commit()
        conn.close()

        if updated_rows > 0:
            return jsonify({'success': True, 'message': f'Project "{project_name}" moved to group "{new_group}".'})
        else:
            return jsonify({'success': False, 'error': 'Project not found.'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Serve static files for development
@app.route('/')
def index():
    return "Clipboard + Version Control API Server is running!"

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)