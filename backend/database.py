import sqlite3
import os
from datetime import datetime, timedelta

# Use environment variable for database path, fallback to local file
DATABASE_FILE = os.environ.get('DATABASE_URL', 'clipboard.db')

def init_database():
    """Initialize the SQLite database with required tables."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    # Create versions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            content TEXT NOT NULL,
            comment TEXT,
            timestamp TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            group_name TEXT
        )
    ''')
    
    # Create clipboard table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clipboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'text',
            source_app TEXT
        )
    ''')
    
    # Create folder projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folder_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Create folder versions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folder_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            folder_name TEXT NOT NULL,
            folder_structure TEXT NOT NULL,
            file_contents TEXT,
            comment TEXT,
            file_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_name) REFERENCES folder_projects (name)
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"Database initialized successfully at: {DATABASE_FILE}")

    # Add group_name column to versions table if it doesn't exist for project grouping
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(versions)")
        columns = [col['name'] for col in cursor.fetchall()]
        
        if 'group_name' not in columns:
            cursor.execute('ALTER TABLE versions ADD COLUMN group_name TEXT')
            conn.commit()
            print("[INFO] Added 'group_name' column to 'versions' table for project grouping.")
            
    except Exception as e:
        print(f"[ERROR] Failed to update versions schema for grouping: {e}")
    finally:
        if conn:
            conn.close()

    # Add file_contents column to folder_versions table if it doesn't exist
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(folder_versions)")
        columns = [col['name'] for col in cursor.fetchall()]
        
        if 'file_contents' not in columns:
            cursor.execute('ALTER TABLE folder_versions ADD COLUMN file_contents TEXT')
            conn.commit()
            print("[INFO] Added 'file_contents' column to 'folder_versions' table for full file storage.")
            
    except Exception as e:
        print(f"[ERROR] Failed to update folder_versions schema: {e}")
    finally:
        if conn:
            conn.close()

def get_db_connection():
    """Get a connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row  # This allows dict-like access to columns
    return conn

def cleanup_old_clipboard_entries():
    """Remove clipboard entries older than 24 hours."""
    cutoff_time = datetime.now() - timedelta(hours=24)
    cutoff_str = cutoff_time.isoformat()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM clipboard WHERE timestamp < ?', (cutoff_str,))
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    
    if deleted_count > 0:
        print(f"Cleaned up {deleted_count} old clipboard entries")
    return deleted_count

def create_uploads_directory():
    """Create the uploads directory structure if it doesn't exist."""
    uploads_dir = 'uploads'
    projects_dir = os.path.join(uploads_dir, 'projects')
    
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
        print(f"Created {uploads_dir} directory")
    
    if not os.path.exists(projects_dir):
        os.makedirs(projects_dir)
        print(f"Created {projects_dir} directory")

# Initialize everything when this module is imported
if __name__ == "__main__":
    init_database()
    create_uploads_directory()
    cleanup_old_clipboard_entries()