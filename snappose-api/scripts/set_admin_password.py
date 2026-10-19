"""Set the admin's password in the database to ADMIN_PASSWORD from .env.

seed.py only creates the admin when there is none, so changing ADMIN_PASSWORD afterwards has no
effect on an existing database until this runs.

Run:
  python -m scripts.set_admin_password
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import AdminUser


def run() -> None:
    db = SessionLocal()
    try:
        admin = db.query(AdminUser).filter(AdminUser.username == settings.admin_username).first()
        if admin is None:
            print(f"No admin named {settings.admin_username!r}; run python -m scripts.seed to create it.")
            return
        admin.password_hash = hash_password(settings.admin_password)
        db.commit()
        print(f"Password updated for admin {settings.admin_username!r}.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
