import keyboard
import pyperclip
import json
import os
import sys
import time
import threading
from datetime import datetime

class ClipboardKeyMapper:
    def __init__(self):
        self.slots = {"A": None, "B": None}
        self.config_file = "clipboard_slots.json"
        self.running = False
        self.hotkeys_registered = False
        
        # Load saved slots
        self.load_slots()
        
        # Default key mappings
        self.key_mappings = {
            "copy_slot_a": "f6",
            "copy_slot_b": "f7", 
            "paste_slot_a": "f8",
            "paste_slot_b": "f9"
        }
        
        print("Clipboard Key Mapper initialized")
        print("Slots loaded from:", self.config_file)
    
    def load_slots(self):
        """Load clipboard slots from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.slots = data.get("slots", {"A": None, "B": None})
                    print(f"Loaded slots: A={bool(self.slots['A'])}, B={bool(self.slots['B'])}")
            else:
                print("No saved slots found, starting fresh")
        except Exception as e:
            print(f"Error loading slots: {e}")
            self.slots = {"A": None, "B": None}
    
    def save_slots(self):
        """Save clipboard slots to file"""
        try:
            data = {
                "slots": self.slots,
                "last_updated": datetime.now().isoformat()
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving slots: {e}")
    
    def copy_to_slot(self, slot):
        """Copy current clipboard content to a slot"""
        try:
            content = pyperclip.paste()
            if content:
                self.slots[slot] = content
                self.save_slots()
                print(f"Copied to Slot {slot}: {content[:50]}{'...' if len(content) > 50 else ''}")
                self.show_notification(f"Copied to Slot {slot}", content[:100])
            else:
                print(f"No content to copy to Slot {slot}")
        except Exception as e:
            print(f"Error copying to Slot {slot}: {e}")
    
    def paste_from_slot(self, slot):
        """Paste content from a slot to clipboard"""
        try:
            content = self.slots[slot]
            if content:
                pyperclip.copy(content)
                print(f"Pasted from Slot {slot}: {content[:50]}{'...' if len(content) > 50 else ''}")
                self.show_notification(f"Pasted from Slot {slot}", content[:100])
                
                # Auto-paste simulation (send Ctrl+V)
                time.sleep(0.1)  # Small delay
                keyboard.send('ctrl+v')
            else:
                print(f"Slot {slot} is empty")
                self.show_notification(f"Slot {slot} is empty", "")
        except Exception as e:
            print(f"Error pasting from Slot {slot}: {e}")
    
    def show_notification(self, title, content):
        """Show a simple console notification"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {title}")
        if content:
            preview = content.replace('\n', ' ').strip()
            if len(preview) > 60:
                preview = preview[:60] + "..."
            print(f"   {preview}")
    
    def register_hotkeys(self):
        """Register global hotkeys"""
        if self.hotkeys_registered:
            return
            
        try:
            # Copy hotkeys
            keyboard.add_hotkey(self.key_mappings["copy_slot_a"], 
                              lambda: self.copy_to_slot("A"))
            keyboard.add_hotkey(self.key_mappings["copy_slot_b"], 
                              lambda: self.copy_to_slot("B"))
            
            # Paste hotkeys  
            keyboard.add_hotkey(self.key_mappings["paste_slot_a"], 
                              lambda: self.paste_from_slot("A"))
            keyboard.add_hotkey(self.key_mappings["paste_slot_b"], 
                              lambda: self.paste_from_slot("B"))
            
            self.hotkeys_registered = True
            print("Hotkeys registered:")
            print(f"   F6: Copy to Slot A")
            print(f"   F7: Copy to Slot B") 
            print(f"   F8: Paste Slot A")
            print(f"   F9: Paste Slot B")
            
        except Exception as e:
            print(f"Error registering hotkeys: {e}")
            return False
        
        return True
    
    def unregister_hotkeys(self):
        """Unregister all hotkeys"""
        try:
            keyboard.unhook_all_hotkeys()
            self.hotkeys_registered = False
            print("Hotkeys unregistered")
        except Exception as e:
            print(f"Error unregistering hotkeys: {e}")
    
    def start(self):
        """Start the key mapper"""
        if self.running:
            print("Key mapper already running")
            return
        
        print("Starting Clipboard Key Mapper...")
        print("Registering global hotkeys...")
        
        if not self.register_hotkeys():
            print("Failed to register hotkeys")
            return False
        
        self.running = True
        print("Key mapper is running!")
        print("Current slots:")
        self.show_slot_status()
        print("\nPress Ctrl+C to stop\n")
        
        try:
            # Keep the program running
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping key mapper...")
            self.stop()
        
        return True
    
    def stop(self):
        """Stop the key mapper"""
        self.running = False
        self.unregister_hotkeys()
        print("Key mapper stopped")
    
    def show_slot_status(self):
        """Display current slot contents"""
        for slot in ["A", "B"]:
            content = self.slots[slot]
            if content:
                preview = content.replace('\n', ' ').strip()
                if len(preview) > 60:
                    preview = preview[:60] + "..."
                print(f"   Slot {slot}: {preview}")
            else:
                print(f"   Slot {slot}: (empty)")
    
    def clear_slot(self, slot):
        """Clear a specific slot"""
        self.slots[slot] = None
        self.save_slots()
        print(f"Cleared Slot {slot}")
    
    def clear_all_slots(self):
        """Clear all slots"""
        self.slots = {"A": None, "B": None}
        self.save_slots()
        print("Cleared all slots")
    
    def interactive_mode(self):
        """Interactive command line interface"""
        print("\nClipboard Key Mapper - Interactive Mode")
        print("Commands: status, clear <slot>, clear-all, test, quit")
        
        while True:
            try:
                command = input("\n> ").strip().lower()
                
                if command == "quit" or command == "exit":
                    break
                elif command == "status":
                    self.show_slot_status()
                elif command.startswith("clear "):
                    slot = command.split()[1].upper()
                    if slot in ["A", "B"]:
                        self.clear_slot(slot)
                    else:
                        print("Invalid slot. Use A or B")
                elif command == "clear-all":
                    self.clear_all_slots()
                elif command == "test":
                    print("Testing slots...")
                    for slot in ["A", "B"]:
                        content = self.slots[slot]
                        print(f"Slot {slot}: {'OK' if content else 'Empty'} ({len(content) if content else 0} chars)")
                elif command == "help":
                    print("Available commands:\n  status      - Show current slot contents\n  clear A/B   - Clear specific slot\n  clear-all   - Clear all slots\n  test        - Test slot status  \n  quit        - Exit interactive mode\n                    ")
                else:
                    print("Unknown command. Type 'help' for available commands")
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")

def main():
    """Main function with command line interface"""
    mapper = ClipboardKeyMapper()
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "start":
            mapper.start()
            
        elif command == "status":
            print("Current clipboard slots:")
            mapper.show_slot_status()
            
        elif command == "clear":
            if len(sys.argv) > 2:
                slot = sys.argv[2].upper()
                if slot in ["A", "B"]:
                    mapper.clear_slot(slot)
                elif slot == "ALL":
                    mapper.clear_all_slots()
                else:
                    print("Invalid slot. Use A, B, or ALL")
            else:
                print("Specify slot to clear: A, B, or ALL")
                
        elif command == "interactive":
            mapper.interactive_mode()
            
        elif command == "test":
            print("Testing key mapper functionality...")
            print("Current slots:")
            mapper.show_slot_status()
            
            # Test clipboard access
            try:
                current = pyperclip.paste()
                print(f"Clipboard access: OK ({len(current)} chars)")
            except Exception as e:
                print(f"Clipboard access: {e}")
                
        elif command == "help":
            print("Clipboard Key Mapper Commands:\n\n  python key_mapper.py start        - Start with hotkeys (F6-F9)\n  python key_mapper.py status       - Show current slot contents\n  python key_mapper.py clear <A|B>  - Clear specific slot\n  python key_mapper.py clear ALL    - Clear all slots\n  python key_mapper.py interactive  - Interactive mode\n  python key_mapper.py test         - Test functionality\n  python key_mapper.py help         - Show this help\n\nHotkeys (when running):\n  F6 - Copy current clipboard to Slot A\n  F7 - Copy current clipboard to Slot B  \n  F8 - Paste Slot A content\n  F9 - Paste Slot B content\n            ")
        else:
            print(f"Unknown command: {command}")
            print("Use 'python key_mapper.py help' for available commands")
    else:
        # Default: start the key mapper
        mapper.start()

if __name__ == "__main__":
    main()