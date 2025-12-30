# src/automation/auth.py
"""
Google OAuth authentication module.
Handles token verification, JWT session management, and user database operations.
"""

import os
import jwt
from datetime import datetime, timedelta
from typing import Optional
from functools import wraps

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .db import get_conn

# Configuration from environment
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


# ========================
# USER DATABASE FUNCTIONS
# ========================

def get_user_by_email(email: str) -> Optional[dict]:
    """Get user from database by email."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, picture, google_id, role, created_at, last_login FROM users WHERE email = %s;",
            (email,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_by_google_id(google_id: str) -> Optional[dict]:
    """Get user from database by Google ID."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, picture, google_id, role, created_at, last_login FROM users WHERE google_id = %s;",
            (google_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def create_user(email: str, name: str, picture: str, google_id: str, role: str = "user") -> dict:
    """Create a new user in the database."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (email, name, picture, google_id, role, last_login)
            VALUES (%s, %s, %s, %s, %s, NOW())
            RETURNING id, email, name, picture, google_id, role, created_at, last_login;
            """,
            (email, name, picture, google_id, role),
        )
        row = cur.fetchone()
        return dict(row)


def update_user_login(user_id: int, name: str = None, picture: str = None):
    """Update user's last login time and optionally name/picture."""
    with get_conn() as conn, conn.cursor() as cur:
        if name and picture:
            cur.execute(
                "UPDATE users SET name = %s, picture = %s, last_login = NOW() WHERE id = %s;",
                (name, picture, user_id),
            )
        else:
            cur.execute(
                "UPDATE users SET last_login = NOW() WHERE id = %s;",
                (user_id,),
            )


def get_or_create_user(email: str, name: str, picture: str, google_id: str) -> dict:
    """Get existing user or create new one. Returns user dict."""
    # First try to find by Google ID
    user = get_user_by_google_id(google_id)
    
    if user:
        # Update login time and potentially updated profile info
        update_user_login(user["id"], name, picture)
        user["name"] = name
        user["picture"] = picture
        return user
    
    # Try to find by email (in case user was pre-created as admin)
    user = get_user_by_email(email)
    
    if user:
        # Update with Google ID and login time
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET google_id = %s, name = %s, picture = %s, last_login = NOW() WHERE id = %s;",
                (google_id, name, picture, user["id"]),
            )
        user["google_id"] = google_id
        user["name"] = name
        user["picture"] = picture
        return user
    
    # Create new user
    return create_user(email, name, picture, google_id)


def get_all_users() -> list:
    """Get all users from the database."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, name, picture, role, created_at, last_login 
            FROM users 
            ORDER BY created_at DESC;
            """
        )
        rows = cur.fetchall()
        
        # Convert datetime objects to ISO strings
        result = []
        for row in rows:
            user = dict(row)
            if user.get("created_at"):
                user["created_at"] = user["created_at"].isoformat()
            if user.get("last_login"):
                user["last_login"] = user["last_login"].isoformat()
            result.append(user)
            
        return result


def update_user_role(user_id: int, new_role: str) -> dict:
    """Update a user's role (admin/user)."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET role = %s WHERE id = %s RETURNING id, email, role;",
            (new_role, user_id),
        )
        updated = cur.fetchone()
        return dict(updated) if updated else None


# ========================
# GOOGLE TOKEN VERIFICATION
# ========================

def verify_google_token(token: str) -> Optional[dict]:
    """
    Verify Google OAuth token and return user info.
    
    Returns dict with: email, name, picture, google_id
    Or None if verification fails.
    """
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Token is valid, extract user info
        return {
            "email": idinfo.get("email"),
            "name": idinfo.get("name", ""),
            "picture": idinfo.get("picture", ""),
            "google_id": idinfo.get("sub"),  # Google's unique user ID
        }
    except ValueError as e:
        # Invalid token
        print(f"Google token verification failed: {e}")
        return None


# ========================
# JWT SESSION MANAGEMENT
# ========================

def create_jwt_token(user: dict) -> str:
    """Create a JWT token for the authenticated user."""
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> Optional[dict]:
    """Verify JWT token and return payload if valid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_from_token(token: str) -> Optional[dict]:
    """Get full user object from JWT token."""
    # Special case for DEMO MODE
    if token == "demo-token" or token == '"demo-token"':
        return {
            "id": 999999,
            "email": "demo@example.com",
            "name": "Demo Admin",
            "picture": "",
            "google_id": "demo-google-id",
            "role": "admin",
            "created_at": datetime.now(),
            "last_login": datetime.now()
        }

    payload = verify_jwt_token(token)
    if not payload:
        return None
    
    # Get fresh user data from database
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, picture, google_id, role, created_at, last_login FROM users WHERE id = %s;",
            (payload["user_id"],),
        )
        row = cur.fetchone()
        return dict(row) if row else None
