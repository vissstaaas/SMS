import sqlite3
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sms.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        # SMS records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sms_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                content TEXT NOT NULL,
                code TEXT,
                received_at TEXT NOT NULL,
                device TEXT DEFAULT ''
            )
        """)
        # Tokens table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS access_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                name TEXT DEFAULT '',
                is_enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                last_used_at TEXT
            )
        """)
        # Insert a default token if table is empty
        cursor.execute("SELECT COUNT(*) FROM access_tokens")
        if cursor.fetchone()[0] == 0:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute(
                "INSERT INTO access_tokens (token, name, is_enabled, created_at) VALUES (?, ?, 1, ?)",
                ("default_secret_token", "默认令牌", now)
            )
        conn.commit()

def extract_code(text: str) -> Optional[str]:
    """
    Smart verification code extractor:
    1. Looks for patterns like '验证码: 123456' or 'code is 1234'
    2. Fallback to first 4-8 digit continuous numbers
    """
    if not text:
        return None
    
    # Priority patterns with keywords
    kw_patterns = [
        r'(?:验证码|校验码|动态码|code|otp|PIN)[^\d]*?([0-9]{4,8})',
        r'([0-9]{4,8})[^\d]*?(?:为您的验证码|是您的验证码|为本次验证码)',
        r'【.*?】.*?([0-9]{4,8})'
    ]
    for p in kw_patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            return match.group(1)
            
    # Generic fallback: 4 to 8 continuous digits
    match = re.search(r'\b\d{4,8}\b', text)
    if match:
        return match.group(0)
    match = re.search(r'\d{4,8}', text)
    if match:
        return match.group(0)
    return None

def normalize_time(time_val: Any) -> str:
    if not time_val:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    t_str = str(time_val).strip()
    if t_str.isdigit():
        ts = int(t_str)
        if ts > 2000000000: # Milliseconds
            ts = ts // 1000
        try:
            return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return t_str or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def validate_token(token: str) -> bool:
    if not token:
        return False
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM access_tokens WHERE token = ? AND is_enabled = 1", (token,))
        row = cursor.fetchone()
        if row:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("UPDATE access_tokens SET last_used_at = ? WHERE id = ?", (now, row["id"]))
            conn.commit()
            return True
    return False

def save_sms(phone: str, content: str, time_val: Any = None, device: str = "") -> int:
    code = extract_code(content)
    received_at = normalize_time(time_val)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sms_records (phone, content, code, received_at, device) VALUES (?, ?, ?, ?, ?)",
            (phone, content, code, received_at, device)
        )
        conn.commit()
        return cursor.lastrowid

def get_sms_list(page: int = 1, per_page: int = 20, device: str = "", phone: str = "", query: str = "") -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        where_clauses = []
        args = []
        
        if device:
            where_clauses.append("device = ?")
            args.append(device)
        if phone:
            where_clauses.append("phone LIKE ?")
            args.append(f"%{phone}%")
        if query:
            where_clauses.append("content LIKE ?")
            args.append(f"%{query}%")
            
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        
        # Count total
        cursor.execute(f"SELECT COUNT(*) FROM sms_records {where_sql}", args)
        total = cursor.fetchone()[0]
        
        # Query page
        offset = (page - 1) * per_page
        cursor.execute(
            f"SELECT * FROM sms_records {where_sql} ORDER BY id DESC LIMIT ? OFFSET ?",
            args + [per_page, offset]
        )
        rows = [dict(r) for r in cursor.fetchall()]
        
        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 1,
            "items": rows
        }

def get_devices() -> List[str]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT device FROM sms_records WHERE device != '' ORDER BY device ASC")
        return [r[0] for r in cursor.fetchall()]

def clear_all_sms() -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sms_records")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='sms_records'")
        conn.commit()
        return cursor.rowcount

def get_tokens() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM access_tokens ORDER BY id DESC")
        return [dict(r) for r in cursor.fetchall()]

def add_token(token: str, name: str) -> bool:
    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO access_tokens (token, name, is_enabled, created_at) VALUES (?, ?, 1, ?)", (token, name, now))
            conn.commit()
            return True
    except Exception:
        return False

def toggle_token(token_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE access_tokens SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE id = ?", (token_id,))
        conn.commit()
        return True

def delete_token(token_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM access_tokens WHERE id = ?", (token_id,))
        conn.commit()
        return True
