import pyperclip
import requests
import time
import json
import threading
from datetime import datetime
import os
import sys

class ClipboardMonitor:
    def __init__(self, api_url="http://localhost:5000", check_interval=1):
        self.api_url = api_url
        self.check_interval = check_interval
        self.last_clipboard_content = ""
        self.running = False
        self.config_file = "config.json"
        self.load_config()
        
    def load_config(self):
        """Load configuration from file"""
        default_config = {
            "api_url": self.api_url,
            "check_interval": self.check_interval,
            "enabled": True,
            "auto_start": True,
            "exclude_apps": ["KeePass", "1Password", "Bitwarden"],
            "min_content_length": 1,
            "max_content_length": 10000
        }
        
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
            else:
                config = default_config
                self.save_config(config)
        except Exception as e:
            print(f"Error loading config: {e}")
            config = default_config
            
        self.config = config
        self.api_url = config["api_url"]
        self.check_interval = config["check_interval"]
    
    def save_config(self, config=None):
        """Save configuration to file"""
        if config is None:
            config = self.config
            
        try:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")
    
    def detect_source_app(self):
        """Detect the source application (basic implementation)"""
        try:
            # This is a basic implementation
            # On Windows, you could use win32gui to get active window
            # On macOS, you could use AppKit
            # For now, return None
            return None
        except Exception:
            return None
    
    def should_ignore_content(self, content):
        """Check if content should be ignored"""
        if not content or not content.strip():
            return True
            
        # Check length limits
        if len(content) < self.config["min_content_length"]:
            return True
        if len(content) > self.config["max_content_length"]:
            return True
            
        # Check for sensitive content patterns
        sensitive_patterns = [
            "password", "secret", "token", "key", "auth",
            "credit card", "ssn", "social security"
        ]
        
        content_lower = content.lower()
        for pattern in sensitive_patterns:
            if pattern in content_lower:
                return True
                
        return False
    
    def send_to_api(self, content, source_app=None):
        """Send clipboard content to the Flask API"""
        try:
            data = {
                "content": content,
                "source_app": source_app or "Desktop Monitor"
            }
            
            response = requests.post(
                f"{self.api_url}/api/clipboard",
                json=data,
                timeout=5
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"✅ Sent clipboard content ({len(content)} chars)")
                    return True
                else:
                    print(f"❌ API error: {result.get('error', 'Unknown error')}")
            else:
                print(f"❌ HTTP error: {response.status_code}")
                
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to API server")
        except requests.exceptions.Timeout:
            print("❌ API request timeout")
        except Exception as e:
            print(f"❌ Error sending to API: {e}")
            
        return False
    
    def check_clipboard(self):
        """Check clipboard for new content"""
        try:
            current_content = pyperclip.paste()
            
            # Check if content has changed
            if current_content != self.last_clipboard_content:
                if not self.should_ignore_content(current_content):
                    source_app = self.detect_source_app()
                    
                    # Send to API
                    if self.send_to_api(current_content, source_app):
                        self.last_clipboard_content = current_content
                        
        except Exception as e:
            print(f"Error checking clipboard: {e}")
    
    def start_monitoring(self):
        """Start the clipboard monitoring loop"""
        if self.running:
            print("Monitor already running")
            return
            
        self.running = True
        print(f"Starting clipboard monitor...")
        print(f"API URL: {self.api_url}")
        print(f"Check interval: {self.check_interval}s")
        print("Press Ctrl+C to stop\n")
        
        # Get initial clipboard content
        try:
            self.last_clipboard_content = pyperclip.paste()
        except:
            self.last_clipboard_content = ""
        
        try:
            while self.running:
                if self.config["enabled"]:
                    self.check_clipboard()
                time.sleep(self.check_interval)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping clipboard monitor...")
            self.running = False
        except Exception as e:
            print(f"Monitor error: {e}")
            self.running = False
    
    def stop_monitoring(self):
        """Stop the clipboard monitoring"""
        self.running = False
    
    def test_api_connection(self):
        """Test connection to the API server"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=5)
            if response.status_code == 200:
                print("✅ API server is reachable")
                return True
            else:
                print(f"❌ API server returned {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to API server")
            print("Make sure the Flask backend is running on http://localhost:5000")
            return False
        except Exception as e:
            print(f"❌ API connection error: {e}")
            return False
    
    def get_stats(self):
        """Get clipboard statistics from API"""
        try:
            response = requests.get(f"{self.api_url}/api/clipboard", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    entries = data.get("entries", [])
                    print(f"📊 Total clipboard entries: {len(entries)}")
                    
                    if entries:
                        latest = entries[0]
                        print(f"📝 Latest entry: {latest['content'][:50]}...")
                        print(f"🕐 Timestamp: {latest['timestamp']}")
                    return True
        except Exception as e:
            print(f"Error getting stats: {e}")
        return False

def main():
    """Main function with command line interface"""
    monitor = ClipboardMonitor()
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "test":
            print("Testing API connection...")
            monitor.test_api_connection()
            
        elif command == "stats":
            print("Getting clipboard statistics...")
            monitor.get_stats()
            
        elif command == "config":
            print("Current configuration:")
            print(json.dumps(monitor.config, indent=2))
            
        elif command == "help":
            print("""
📋 Clipboard Monitor Commands:
  
  python clipboard_monitor.py          - Start monitoring
  python clipboard_monitor.py test     - Test API connection
  python clipboard_monitor.py stats    - Show clipboard stats  
  python clipboard_monitor.py config   - Show current config
  python clipboard_monitor.py help     - Show this help
            """)
        else:
            print(f"Unknown command: {command}")
            print("Use 'python clipboard_monitor.py help' for available commands")
    else:
        # Default: start monitoring
        if monitor.test_api_connection():
            monitor.start_monitoring()
        else:
            print("\nTo start anyway, make sure Flask backend is running:")
            print("   cd backend && python app.py")

if __name__ == "__main__":
    main()