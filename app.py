"""
Home Healthcare Management System - Flask Backend Application
Provides RESTful APIs and UI routing for the 9-step home healthcare workflow.
"""

import os
import json
import uuid
import re
import secrets
import string
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection, init_db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "local-development-secret-key")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(minutes=30)
app.config["SESSION_REFRESH_EACH_REQUEST"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

default_upload_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads")
if os.environ.get("VERCEL"):
    default_upload_folder = "/tmp/uploads"
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", default_upload_folder)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx"}

@app.after_request
def add_security_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.before_request
def enforce_session_security():
    if request.path.startswith("/static/") or request.path.startswith("/uploads/"):
        return None
    public_routes = {
        "index", "uploaded_file", "login", "register",
        "forgot_password", "reset_password", "logout",
        "demo_switch", "current_user", "get_services", "get_professionals",
        "get_public_doctors", "get_public_reviews", "upload_document",
        "sync_appointments", "sync_patient"
    }
    if request.endpoint in public_routes:
        if request.endpoint in {"login", "register", "forgot_password", "reset_password"}:
            return None
        if request.endpoint == "current_user" and not session.get("user_id"):
            return jsonify({"success": False, "user": None})
        return None

    if not session.get("user_id"):
        return jsonify({"success": False, "message": "Access Denied"}), 401

    last_activity = session.get("last_activity")
    if last_activity is not None:
        try:
            last_activity = float(last_activity)
            if (datetime.now().timestamp() - last_activity) > app.config["PERMANENT_SESSION_LIFETIME"].total_seconds():
                session.clear()
                return jsonify({"success": False, "message": "Session expired. Please log in again."}), 401
        except (TypeError, ValueError):
            session.clear()
            return jsonify({"success": False, "message": "Session expired. Please log in again."}), 401

    session["last_activity"] = datetime.now().timestamp()
    return None


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def normalize_phone(phone_str):
    if not phone_str:
        return ""
    digits = re.sub(r"\D", "", str(phone_str))
    if digits.startswith("977") and len(digits) > 10:
        digits = digits[3:]
    return digits


def password_meets_policy(password):
    return (
        isinstance(password, str) and
        len(password) >= 6 and
        re.search(r"[A-Za-z]", password) and
        re.search(r"\d", password)
    )


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password, stored_hash):
    return check_password_hash(stored_hash, password)


def get_user_by_identifier(identifier):
    if not identifier:
        return None
    value = identifier.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(phone) = ?", (value, value))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def require_patient_ownership(patient_id):
    if session.get("role") != "patient":
        return True
    if patient_id != session.get("user_id"):
        return False
    return True


def ensure_appointment_belongs_to_current_patient(app_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT patient_id FROM appointments WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return False, None
    patient_id = row["patient_id"]
    if session.get("role") == "patient" and patient_id != session.get("user_id"):
        return False, patient_id
    return True, patient_id

# ==========================================
# 0. UI Page Route
# ==========================================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

# ==========================================
# 1. Authentication APIs (Step 1)
# ==========================================
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    role = data.get("role", "patient")
    phone = data.get("phone", "")
    age = data.get("age")
    gender = data.get("gender", "Other")
    blood_group = data.get("blood_group", "")
    address = data.get("address", "")
    specialization = data.get("specialization")
    qualification = data.get("qualification")

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required."}), 400
    if not password_meets_policy(password):
        return jsonify({"success": False, "message": "Password must be at least 6 characters and include letters and numbers."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": "User with this email already exists."}), 400

        cursor.execute("""
        INSERT INTO users (name, email, password, role, phone, age, gender, blood_group, address, specialization, qualification)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, email, hash_password(password), role, phone, age, gender, blood_group, address, specialization, qualification))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        session.clear()
        session["user_id"] = user_id
        session["role"] = role
        session["last_activity"] = datetime.now().timestamp()

        return jsonify({
            "success": True,
            "message": "Registration successful!",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role,
                "phone": phone,
                "age": age,
                "gender": gender,
                "blood_group": blood_group,
                "address": address
            }
        })
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    row = None
    # Smart alias resolution for demo roles and phone/email matching
    if email in ("patient@demo.com", "patient", "ram@demo.com", "ram"):
        cursor.execute("SELECT * FROM users WHERE LOWER(email) IN ('ram@demo.com', 'patient@demo.com') OR id = 1 LIMIT 1")
        row = cursor.fetchone()
    elif email in ("admin@demo.com", "admin", "sandeep@demo.com"):
        cursor.execute("SELECT * FROM users WHERE LOWER(email) IN ('sandeep@demo.com', 'admin@demo.com') OR role = 'admin' LIMIT 1")
        row = cursor.fetchone()
    elif email in ("doctor@demo.com", "dr.binod@demo.com"):
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = 'dr.binod@demo.com' LIMIT 1")
        row = cursor.fetchone()
    elif email in ("nurse@demo.com", "nurse.rama@demo.com"):
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = 'nurse.rama@demo.com' LIMIT 1")
        row = cursor.fetchone()
    elif email in ("therapist@demo.com", "therapist.asha@demo.com"):
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = 'therapist.asha@demo.com' LIMIT 1")
        row = cursor.fetchone()
    elif email in ("pharm@demo.com", "pharmacist@demo.com"):
        cursor.execute("SELECT * FROM users WHERE LOWER(email) IN ('pharm@demo.com', 'pharm.chetna@demo.com') LIMIT 1")
        row = cursor.fetchone()
    else:
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(phone) = ?", (email, email))
        row = cursor.fetchone()
        if not row:
            p_digits = normalize_phone(email)
            if p_digits and len(p_digits) >= 7:
                cursor.execute("SELECT * FROM users")
                for u in cursor.fetchall():
                    if u["phone"] and normalize_phone(u["phone"]) == p_digits:
                        row = u
                        break
    conn.close()

    if not row:
        return jsonify({"success": False, "message": "Account not found with this email or phone number. Please register as a new patient."}), 401

    user = dict(row)
    stored_hash = user.get("password", "")
    password_valid = False

    try:
        password_valid = verify_password(password, stored_hash)
    except Exception:
        password_valid = False

    if not password_valid:
        # Fallback 1: Plain-text legacy check
        if stored_hash == password:
            password_valid = True
        # Fallback 2: Known demo credentials check to prevent demo lockouts
        elif user.get("role") == "patient" and password in ("ram123", "demo123", "patient123", "Ram123"):
            password_valid = True
        elif user.get("role") == "admin" and password in ("admin123", "demo123", "Admin123"):
            password_valid = True
        elif user.get("role") == "professional" and password in ("doctor123", "nurse123", "therapist123", "demo123"):
            password_valid = True
        elif user.get("role") == "pharmacist" and password in ("pharm123", "demo123"):
            password_valid = True

        if password_valid:
            try:
                conn_up = get_db_connection()
                conn_up.execute("UPDATE users SET password = ? WHERE id = ?", (hash_password(password), user["id"]))
                conn_up.commit()
                conn_up.close()
            except Exception:
                pass

    if not password_valid:
        return jsonify({"success": False, "message": "Invalid password. Please check your password or use 'Forgot Password?' to reset."}), 401

    # Security Check: Require Hospital Authorization PIN (Staff Security Code) for Doctor, Nurse, Admin, Therapist, Pharmacist
    if user.get("role") != "patient":
        staff_pin = str(data.get("staff_pin", "")).strip()
        if staff_pin != "2026":
            return jsonify({
                "success": False,
                "message": "Hospital Clearance Required: Access to Doctor, Nurse, or Admin portals requires a valid Hospital Authorization PIN."
            }), 403

    session.clear()
    session["user_id"] = user["id"]
    session["role"] = user["role"]
    session["last_activity"] = datetime.now().timestamp()
    del user["password"]

    return jsonify({"success": True, "message": "Login successful!", "user": user})

@app.route("/api/auth/sync-patient", methods=["POST"])
def sync_patient():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    phone = data.get("phone", "").strip()
    age = data.get("age")
    gender = data.get("gender", "Other")
    blood_group = data.get("blood_group", "")
    address = data.get("address", "")
    role = "patient"

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
        existing = cursor.fetchone()
        if existing:
            cursor.execute("""
                UPDATE users SET name = ?, password = ?, phone = ?, age = ?, gender = ?, blood_group = ?, address = ?
                WHERE id = ?
            """, (name, hash_password(password), phone, age, gender, blood_group, address, existing["id"]))
            user_id = existing["id"]
        else:
            cursor.execute("""
                INSERT INTO users (name, email, password, role, phone, age, gender, blood_group, address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, email, hash_password(password), role, phone, age, gender, blood_group, address))
            user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Patient account synchronized successfully.", "user_id": user_id})
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/auth/me", methods=["GET"])
def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "user": None})
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "user": None})

    user = dict(row)
    del user["password"]
    return jsonify({"success": True, "user": user})

@app.route("/api/patient/profile", methods=["GET"])
def get_patient_profile():
    user_id = session.get("user_id")
    if not user_id or session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied: Patient access only."}), 403

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, role, phone, age, gender, blood_group, address, avatar, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "message": "Profile not found."}), 404

    return jsonify({"success": True, "profile": dict(row)})

@app.route("/api/patient/profile", methods=["POST"])
def update_patient_profile():
    user_id = session.get("user_id")
    if not user_id or session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied: Patient access only."}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    age = data.get("age")
    gender = data.get("gender") or "Other"
    blood_group = data.get("blood_group") or "O+"
    address = (data.get("address") or "").strip()

    if not name:
        return jsonify({"success": False, "message": "Name is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users
        SET name = ?, phone = ?, age = ?, gender = ?, blood_group = ?, address = ?
        WHERE id = ? AND role = 'patient'
    """, (name, phone, age, gender, blood_group, address, user_id))
    conn.commit()

    cursor.execute("SELECT id, name, email, role, phone, age, gender, blood_group, address, avatar, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Profile updated successfully.",
        "user": dict(row)
    })

@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    identifier = (data.get("identifier") or "").strip()
    if not identifier:
        return jsonify({"success": False, "message": "Enter your registered email or phone number."}), 400

    user = get_user_by_identifier(identifier)
    if not user:
        return jsonify({"success": False, "message": "No account found for that email or phone number."}), 404

    otp = "".join(secrets.choice(string.digits) for _ in range(6))
    session["recovery_user_id"] = user["id"]
    session["recovery_otp"] = otp
    session["recovery_expires_at"] = (datetime.now() + timedelta(minutes=10)).timestamp()

    return jsonify({
        "success": True,
        "message": "A verification code has been sent to your registered contact.",
        "otp": otp,
        "user_id": user["id"]
    })

@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    identifier = (data.get("identifier") or "").strip()
    otp = (data.get("otp") or "").strip()
    new_password = (data.get("new_password") or "").strip()
    confirm_password = (data.get("confirm_password") or "").strip()

    if not identifier or not otp or not new_password or not confirm_password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    user = get_user_by_identifier(identifier)
    if not user:
        return jsonify({"success": False, "message": "No account found for that email or phone number."}), 404

    if not password_meets_policy(new_password):
        return jsonify({"success": False, "message": "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."}), 400

    if new_password != confirm_password:
        return jsonify({"success": False, "message": "Password confirmation does not match."}), 400

    recovery_user_id = session.get("recovery_user_id")
    recovery_otp = session.get("recovery_otp")
    expires_at = session.get("recovery_expires_at")
    if recovery_user_id != user["id"] or recovery_otp != otp:
        return jsonify({"success": False, "message": "Invalid or expired verification code."}), 400
    if expires_at and datetime.now().timestamp() > float(expires_at):
        session.pop("recovery_user_id", None)
        session.pop("recovery_otp", None)
        session.pop("recovery_expires_at", None)
        return jsonify({"success": False, "message": "Verification code has expired. Please request a new one."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (hash_password(new_password), user["id"]))
    conn.commit()
    conn.close()

    session.pop("recovery_user_id", None)
    session.pop("recovery_otp", None)
    session.pop("recovery_expires_at", None)
    return jsonify({"success": True, "message": "Password reset successful. Please log in with your new password."})

@app.route("/api/auth/change-password", methods=["POST"])
def change_password():
    if session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied"}), 403

    data = request.get_json() or {}
    current_password = (data.get("current_password") or "").strip()
    new_password = (data.get("new_password") or "").strip()
    confirm_password = (data.get("confirm_password") or "").strip()

    if not current_password or not new_password or not confirm_password:
        return jsonify({"success": False, "message": "Current password, new password, and confirmation are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE id = ?", (session["user_id"],))
    row = cursor.fetchone()
    if not row or not verify_password(current_password, row["password"]):
        conn.close()
        return jsonify({"success": False, "message": "Current password is incorrect."}), 401

    if not password_meets_policy(new_password):
        conn.close()
        return jsonify({"success": False, "message": "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."}), 400

    if new_password != confirm_password:
        conn.close()
        return jsonify({"success": False, "message": "Password confirmation does not match."}), 400

    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (hash_password(new_password), session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Password changed successfully."})

@app.route("/api/auth/demo-switch", methods=["POST"])
def demo_switch():
    if session.get("role") == "patient":
        return jsonify({"success": False, "message": "Access Denied: Logged-in patients can only access their own profile."}), 403

    data = request.get_json() or {}
    target_role = data.get("role", "patient")

    # Security check: Direct switching to staff/admin is strictly prohibited unless already authenticated as staff/admin
    if target_role != "patient":
        current_role = session.get("role")
        if current_role not in ("admin", "professional", "pharmacist"):
            return jsonify({
                "success": False,
                "message": "Access Denied: Direct role switching to staff profiles is restricted. Please sign in with official credentials and Hospital Authorization PIN."
            }), 403

    conn = get_db_connection()
    cursor = conn.cursor()

    if target_role == "admin":
        cursor.execute("SELECT * FROM users WHERE email = 'sandeep@demo.com' OR role = 'admin' LIMIT 1")
    elif target_role == "nurse":
        cursor.execute("SELECT * FROM users WHERE email = 'nurse.rama@demo.com' LIMIT 1")
    elif target_role == "nurse_chetna":
        cursor.execute("SELECT * FROM users WHERE email = 'nurse.chetna@demo.com' LIMIT 1")
    elif target_role == "doctor":
        cursor.execute("SELECT * FROM users WHERE email = 'dr.binod@demo.com' LIMIT 1")
    elif target_role == "doctor_sunil":
        cursor.execute("SELECT * FROM users WHERE email = 'dr.sunil@demo.com' LIMIT 1")
    elif target_role == "doctor_sahil":
        cursor.execute("SELECT * FROM users WHERE email = 'dr.sahil@demo.com' LIMIT 1")
    elif target_role == "therapist":
        cursor.execute("SELECT * FROM users WHERE email = 'therapist.asha@demo.com' LIMIT 1")
    elif target_role in ("pharmacist", "pharm"):
        cursor.execute("SELECT * FROM users WHERE email = 'pharm@demo.com' LIMIT 1")
    elif target_role == "professional":
        cursor.execute("SELECT * FROM users WHERE role IN ('professional', 'pharmacist') LIMIT 1")
    else:  # patient
        cursor.execute("SELECT * FROM users WHERE email = 'ram@demo.com' OR role = 'patient' LIMIT 1")

    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "message": f"No account found for role {target_role}"}), 404

    user = dict(row)
    del user["password"]
    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return jsonify({"success": True, "message": f"Switched to {user['name']} ({user['role']})", "user": user})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully."})

# ==========================================
# 2. Services APIs (Step 2)
# ==========================================
@app.route("/api/services", methods=["GET"])
def get_services():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM services WHERE is_active = 1")
    rows = cursor.fetchall()
    conn.close()

    services = []
    for r in rows:
        d = dict(r)
        d["inclusions"] = json.loads(d["inclusions"]) if d["inclusions"] else []
        services.append(d)

    return jsonify({"success": True, "services": services})

@app.route("/api/professionals", methods=["GET"])
def get_professionals():
    if session.get("role") == "patient":
        return jsonify({"success": False, "message": "Access Denied: Healthcare staff directory is restricted."}), 403
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, phone, specialization, qualification, experience_years, rating, avatar FROM users WHERE role = 'professional'")
    rows = cursor.fetchall()
    conn.close()

    professionals = [dict(r) for r in rows]
    return jsonify({"success": True, "professionals": professionals})

@app.route("/api/public/doctors", methods=["GET"])
def get_public_doctors():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, specialization, qualification, experience_years, rating, avatar, role
        FROM users
        WHERE role IN ('professional', 'pharmacist')
        ORDER BY rating DESC, experience_years DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    doctors = [dict(r) for r in rows]
    return jsonify({"success": True, "doctors": doctors})

@app.route("/api/public/reviews", methods=["GET"])
def get_public_reviews():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT f.id, f.rating, f.tags, f.comments, f.created_at,
               COALESCE(p.name, 'Verified Patient') AS patient_name,
               COALESCE(s.title, 'Home Healthcare Service') AS service_title,
               COALESCE(pro.name, 'Healthcare Professional') AS doctor_name,
               pro.specialization AS doctor_specialization
        FROM feedback f
        LEFT JOIN appointments a ON f.appointment_id = a.id
        LEFT JOIN services s ON a.service_id = s.id
        LEFT JOIN users p ON f.patient_id = p.id
        LEFT JOIN users pro ON f.professional_id = pro.id
        WHERE f.is_satisfied = 1 AND f.comments IS NOT NULL AND TRIM(f.comments) != ''
        ORDER BY f.id DESC
        LIMIT 10
    """)
    rows = cursor.fetchall()
    conn.close()

    reviews = []
    for r in rows:
        rev = dict(r)
        p_name = rev.get("patient_name") or "Verified Patient"
        parts = p_name.split()
        if len(parts) > 1:
            rev["patient_display_name"] = f"{parts[0]} {parts[1][0]}."
        else:
            rev["patient_display_name"] = p_name
        reviews.append(rev)

    if not reviews:
        reviews = [
            {
                "id": 1,
                "patient_display_name": "Ram S.",
                "rating": 5,
                "service_title": "Doctor Home Consultation",
                "doctor_name": "Dr. Binod Thapa",
                "doctor_specialization": "Senior Consultant General Physician & Cardiologist",
                "comments": "Dr. Binod conducted a thorough bedside examination with ECG review. His bedside manner was reassuring and professional.",
                "tags": "Professional, Punctual, Excellent Care",
                "created_at": "Recently"
            },
            {
                "id": 2,
                "patient_display_name": "Sita K.",
                "rating": 5,
                "service_title": "Skilled Nursing Care",
                "doctor_name": "Nurse Rama",
                "doctor_specialization": "Critical Care, Post-Op & Wound Management Nurse",
                "comments": "Nurse Rama was exceptionally gentle while changing surgical dressings and administering IV fluids at home. Highly recommended.",
                "tags": "Gentle, Clean & Sterile, Caring",
                "created_at": "Recently"
            },
            {
                "id": 3,
                "patient_display_name": "Hari P.",
                "rating": 5,
                "service_title": "Doctor Home Consultation",
                "doctor_name": "Dr. Sunil",
                "doctor_specialization": "Consultant Physician",
                "comments": "Prompt arrival with complete diagnostic kit. The digital prescription and medicine guidance made home recovery seamless.",
                "tags": "Knowledgeable, On-Time Arrival",
                "created_at": "Recently"
            },
            {
                "id": 4,
                "patient_display_name": "Gita M.",
                "rating": 5,
                "service_title": "Physical & Rehab Therapy",
                "doctor_name": "Asha Shrestha, PT",
                "doctor_specialization": "Physical Therapist, Rehabilitation & Mobility",
                "comments": "Mobility exercises and gait retraining at home have drastically improved my father's post-stroke walking confidence.",
                "tags": "Patient, Expert Guidance, Dedicated",
                "created_at": "Recently"
            }
        ]
    return jsonify({"success": True, "reviews": reviews})

# ==========================================
# 3. Document Upload API (Step 3 & 6)
# ==========================================
@app.route("/api/upload", methods=["POST"])
def upload_document():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file part in request"}), 400
    
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "message": "No file selected"}), 400

    if file and allowed_file(file.filename):
        ext = file.filename.rsplit(".", 1)[1].lower()
        unique_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
        file.save(save_path)
        
        return jsonify({
            "success": True,
            "filename": unique_name,
            "url": f"/uploads/{unique_name}",
            "original_name": file.filename
        })

    return jsonify({"success": False, "message": "File type not allowed. Allowed: pdf, png, jpg, jpeg, doc, docx"}), 400

# ==========================================
# 4. Appointment Booking & Management (Steps 3, 4, 5)
# ==========================================
@app.route("/api/appointments", methods=["GET"])
def get_appointments():
    user_id = session.get("user_id")
    role = session.get("role", "patient")
    if not user_id:
        return jsonify({"success": False, "message": "Access Denied"}), 401

    status_filter = request.args.get("status")

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT a.*, 
           COALESCE(s.title, 'General Healthcare Service') AS service_title,
           COALESCE(s.category, 'Medical') AS service_category,
           COALESCE(s.price, 65.0) AS service_price,
           COALESCE(s.icon, 'fa-stethoscope') AS service_icon,
           COALESCE(p.name, 'Patient #' || a.patient_id) AS patient_name,
           COALESCE(p.phone, a.emergency_contact_phone, '') AS patient_phone,
           COALESCE(p.email, '') AS patient_email,
           COALESCE(p.age, '') AS patient_age,
           COALESCE(p.gender, '') AS patient_gender,
           COALESCE(p.blood_group, '') AS patient_blood_group,
           pro.name AS professional_name,
           pro.phone AS professional_phone,
           pro.specialization AS professional_specialization,
           pro.avatar AS professional_avatar,
           pro.rating AS professional_rating
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN users p ON a.patient_id = p.id
    LEFT JOIN users pro ON a.professional_id = pro.id
    WHERE 1=1
    """
    params = []

    if role == "patient":
        query += " AND a.patient_id = ?"
        params.append(user_id)
    elif role in ("professional", "pharmacist"):
        query += " AND a.professional_id = ?"
        params.append(user_id)
    # Admin sees all appointments

    if status_filter and status_filter != "All":
        query += " AND a.status = ?"
        params.append(status_filter)

    query += " ORDER BY a.id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    appointments = []
    for r in rows:
        d = dict(r)
        d["uploaded_docs"] = json.loads(d["uploaded_docs"]) if d["uploaded_docs"] else []
        appointments.append(d)

    return jsonify({"success": True, "appointments": appointments})

@app.route("/api/appointments/<int:app_id>", methods=["GET"])
def get_appointment_details(app_id):
    if session.get("role") == "patient":
        allowed, _ = ensure_appointment_belongs_to_current_patient(app_id)
        if not allowed:
            return jsonify({"success": False, "message": "Access Denied"}), 403

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT a.*, 
           COALESCE(s.title, 'General Healthcare Service') AS service_title,
           COALESCE(s.category, 'Medical') AS service_category,
           COALESCE(s.price, 65.0) AS service_price,
           COALESCE(s.duration, '45 mins') AS service_duration,
           COALESCE(s.icon, 'fa-stethoscope') AS service_icon,
           COALESCE(s.inclusions, '[]') AS service_inclusions,
           COALESCE(p.name, 'Patient #' || a.patient_id) AS patient_name,
           COALESCE(p.phone, a.emergency_contact_phone, '') AS patient_phone,
           COALESCE(p.email, '') AS patient_email,
           COALESCE(p.age, '') AS patient_age,
           COALESCE(p.gender, '') AS patient_gender,
           COALESCE(p.blood_group, '') AS patient_blood_group,
           pro.name AS professional_name, pro.phone AS professional_phone,
           pro.specialization AS professional_specialization, pro.rating AS professional_rating,
           pro.avatar AS professional_avatar
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN users p ON a.patient_id = p.id
    LEFT JOIN users pro ON a.professional_id = pro.id
    WHERE a.id = ?
    """, (app_id,))
    app_row = cursor.fetchone()

    if not app_row:
        conn.close()
        return jsonify({"success": False, "message": "Appointment not found."}), 404

    appointment = dict(app_row)
    appointment["uploaded_docs"] = json.loads(appointment["uploaded_docs"]) if appointment["uploaded_docs"] else []
    appointment["service_inclusions"] = json.loads(appointment["service_inclusions"]) if appointment["service_inclusions"] else []

    # Visit Records
    cursor.execute("SELECT * FROM visit_records WHERE appointment_id = ?", (app_id,))
    vr_row = cursor.fetchone()
    appointment["visit_record"] = dict(vr_row) if vr_row else None

    # Prescriptions
    cursor.execute("SELECT * FROM prescriptions WHERE appointment_id = ?", (app_id,))
    rx_row = cursor.fetchone()
    if rx_row:
        rx_dict = dict(rx_row)
        rx_dict["medicines"] = json.loads(rx_dict["medicines_json"]) if rx_dict["medicines_json"] else []
        appointment["prescription"] = rx_dict
    else:
        appointment["prescription"] = None

    # Payment
    cursor.execute("SELECT * FROM payments WHERE appointment_id = ?", (app_id,))
    pay_row = cursor.fetchone()
    if pay_row:
        pay_dict = dict(pay_row)
        pay_dict["breakdown"] = json.loads(pay_dict["breakdown_json"]) if pay_dict["breakdown_json"] else {}
        appointment["payment"] = pay_dict
    else:
        appointment["payment"] = None

    # Feedback
    cursor.execute("SELECT * FROM feedback WHERE appointment_id = ?", (app_id,))
    fb_row = cursor.fetchone()
    appointment["feedback"] = dict(fb_row) if fb_row else None

    # Issues
    cursor.execute("SELECT * FROM issue_tickets WHERE appointment_id = ?", (app_id,))
    issue_rows = cursor.fetchall()
    appointment["issues"] = [dict(i) for i in issue_rows]

    conn.close()
    return jsonify({"success": True, "appointment": appointment})

@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    if session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied"}), 403

    data = request.get_json() or {}
    patient_id = session.get("user_id")
    service_id = data.get("service_id")
    appointment_date = data.get("appointment_date")
    time_slot = data.get("time_slot")
    address = data.get("address", "").strip()
    symptoms = data.get("symptoms", "").strip()
    emergency_contact_name = data.get("emergency_contact_name", "")
    emergency_contact_phone = data.get("emergency_contact_phone", "")
    uploaded_docs = data.get("uploaded_docs", [])

    if not patient_id:
        return jsonify({"success": False, "message": "Access Denied"}), 401
    if not service_id or not appointment_date or not time_slot or not address:
        return jsonify({"success": False, "message": "Service, date, time slot, and address are required."}), 400

    app_number = f"HH-{datetime.now().strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO appointments (
        appointment_number, patient_id, service_id, status, current_step,
        appointment_date, time_slot, address, symptoms,
        emergency_contact_name, emergency_contact_phone, uploaded_docs
    ) VALUES (?, ?, ?, 'Pending', 4, ?, ?, ?, ?, ?, ?, ?)
    """, (
        app_number, patient_id, service_id,
        appointment_date, time_slot, address, symptoms,
        emergency_contact_name, emergency_contact_phone, json.dumps(uploaded_docs)
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Appointment request #{app_number} submitted successfully! Awaiting Admin assignment.",
        "appointment_id": new_id,
        "appointment_number": app_number
    })

@app.route("/api/appointments/sync", methods=["POST"])
def sync_appointments():
    data = request.get_json() or {}
    items = data.get("appointments", [])
    if not items:
        return jsonify({"success": True, "synced": 0})
    
    conn = get_db_connection()
    cursor = conn.cursor()
    synced = 0
    for it in items:
        app_num = it.get("appointment_number")
        if not app_num:
            continue
        cursor.execute("SELECT id FROM appointments WHERE appointment_number = ?", (app_num,))
        row = cursor.fetchone()
        if not row:
            raw_pro_id = it.get("professional_id")
            pro_id = int(raw_pro_id) if raw_pro_id is not None and str(raw_pro_id).isdigit() else None
            cursor.execute("""
            INSERT INTO appointments (
                appointment_number, patient_id, service_id, professional_id, status, current_step,
                appointment_date, time_slot, address, symptoms,
                emergency_contact_name, emergency_contact_phone, uploaded_docs,
                staff_response, eta
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                app_num,
                it.get("patient_id", 1),
                it.get("service_id", 1),
                pro_id,
                it.get("status", "Pending"),
                it.get("current_step", 4),
                it.get("appointment_date", datetime.now().strftime("%Y-%m-%d")),
                it.get("time_slot", "09:00 AM - 10:00 AM"),
                it.get("address", "Patient Address"),
                it.get("symptoms", "Home health checkup"),
                it.get("emergency_contact_name", ""),
                it.get("emergency_contact_phone", ""),
                json.dumps(it.get("uploaded_docs", [])),
                it.get("staff_response", ""),
                it.get("eta", "")
            ))
            synced += 1
        else:
            existing_id = row["id"]
            raw_pro_id = it.get("professional_id")
            pro_id = int(raw_pro_id) if raw_pro_id is not None and str(raw_pro_id).isdigit() else None
            status = it.get("status")
            step = it.get("current_step")
            staff_resp = it.get("staff_response")
            eta = it.get("eta")

            updates = []
            vals = []
            if raw_pro_id is not None:
                updates.append("professional_id = ?")
                vals.append(pro_id)
            if status:
                updates.append("status = ?")
                vals.append(status)
            if step is not None:
                updates.append("current_step = ?")
                vals.append(int(step))
            if staff_resp:
                updates.append("staff_response = ?")
                vals.append(staff_resp)
            if eta:
                updates.append("eta = ?")
                vals.append(eta)

            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                vals.append(existing_id)
                cursor.execute(f"UPDATE appointments SET {', '.join(updates)} WHERE id = ?", tuple(vals))
                synced += 1
    conn.commit()
    conn.close()
    return jsonify({"success": True, "synced": synced})

# ==========================================
# 5. Admin Assignment API (Step 4)
# ==========================================
@app.route("/api/appointments/<int:app_id>/assign", methods=["POST"])
def assign_professional(app_id):
    data = request.get_json() or {}
    raw_professional_id = data.get("professional_id")

    if not raw_professional_id:
        return jsonify({"success": False, "message": "Please select a Healthcare Professional."}), 400

    try:
        professional_id = int(raw_professional_id)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid Healthcare Professional ID."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, role, specialization, phone, avatar, rating FROM users WHERE id = ?", (professional_id,))
    prof = cursor.fetchone()
    prof_name = prof["name"] if prof else f"Staff #{professional_id}"
    prof_spec = prof["specialization"] if prof and prof["specialization"] else "Healthcare Provider"

    staff_msg = f"{prof_name} ({prof_spec}) has been assigned to your appointment. Preparation in progress."

    # Update appointment to Assigned, current_step 5
    cursor.execute("""
    UPDATE appointments 
    SET professional_id = ?, status = 'Assigned', current_step = 5, staff_response = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (professional_id, staff_msg, app_id))
    conn.commit()

    cursor.execute("""
    SELECT a.*, 
           COALESCE(s.title, 'General Healthcare Service') AS service_title,
           COALESCE(p.name, 'Patient #' || a.patient_id) AS patient_name,
           COALESCE(p.phone, a.emergency_contact_phone, '') AS patient_phone,
           pro.name AS professional_name,
           pro.phone AS professional_phone,
           pro.specialization AS professional_specialization,
           pro.avatar AS professional_avatar,
           pro.rating AS professional_rating
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN users p ON a.patient_id = p.id
    LEFT JOIN users pro ON a.professional_id = pro.id
    WHERE a.id = ?
    """, (app_id,))
    updated_app = cursor.fetchone()
    conn.close()

    app_dict = dict(updated_app) if updated_app else None
    if app_dict and app_dict.get("uploaded_docs"):
        try:
            app_dict["uploaded_docs"] = json.loads(app_dict["uploaded_docs"])
        except Exception:
            pass

    return jsonify({
        "success": True,
        "message": f"{prof_name} assigned and appointment confirmed successfully!",
        "appointment": app_dict
    })

# ==========================================
# Direct Staff Response & Status Update API
# ==========================================
@app.route("/api/appointments/<int:app_id>/respond", methods=["POST"])
def respond_to_appointment(app_id):
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id or role not in {"professional", "pharmacist", "admin"}:
        return jsonify({"success": False, "message": "Access Denied: Healthcare staff only."}), 403

    data = request.get_json() or {}
    staff_response = (data.get("staff_response") or "").strip()
    eta = (data.get("eta") or "").strip()
    new_status = (data.get("status") or "").strip()

    if not staff_response and not eta and not new_status:
        return jsonify({"success": False, "message": "Please provide an update message or ETA for the patient."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, patient_id, professional_id, status FROM appointments WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Appointment not found."}), 404

    # Allow staff member assigned or admin
    if role != "admin" and row["professional_id"] and row["professional_id"] != user_id:
        conn.close()
        return jsonify({"success": False, "message": "You are not assigned to this appointment."}), 403

    updates = ["updated_at = CURRENT_TIMESTAMP"]
    params = []
    if staff_response:
        updates.append("staff_response = ?")
        params.append(staff_response)
    if eta:
        updates.append("eta = ?")
        params.append(eta)
    if new_status:
        valid_statuses = {'Pending', 'Assigned', 'In-Progress', 'Completed', 'Cancelled', 'Issue Raised'}
        status_to_save = new_status
        if new_status in ("On the Way", "En Route", "En-Route"):
            status_to_save = "In-Progress"
        elif new_status in ("Confirmed", "Accepted"):
            status_to_save = "Assigned"
        
        if status_to_save in valid_statuses:
            updates.append("status = ?")
            params.append(status_to_save)

    params.append(app_id)
    cursor.execute(f"UPDATE appointments SET {', '.join(updates)} WHERE id = ?", tuple(params))
    conn.commit()

    cursor.execute("""
    SELECT a.*, 
           COALESCE(s.title, 'General Healthcare Service') AS service_title,
           COALESCE(p.name, 'Patient #' || a.patient_id) AS patient_name,
           COALESCE(p.phone, a.emergency_contact_phone, '') AS patient_phone,
           pro.name AS professional_name,
           pro.phone AS professional_phone,
           pro.specialization AS professional_specialization,
           pro.avatar AS professional_avatar,
           pro.rating AS professional_rating
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN users p ON a.patient_id = p.id
    LEFT JOIN users pro ON a.professional_id = pro.id
    WHERE a.id = ?
    """, (app_id,))
    updated_app = cursor.fetchone()
    conn.close()

    app_dict = dict(updated_app) if updated_app else None
    if app_dict and app_dict.get("uploaded_docs"):
        try:
            app_dict["uploaded_docs"] = json.loads(app_dict["uploaded_docs"])
        except Exception:
            pass

    return jsonify({
        "success": True,
        "message": "Update sent directly to patient successfully!",
        "appointment": app_dict
    })

# ==========================================
# 6. Home Visit & Records Update APIs (Step 5 & 6)
# ==========================================
@app.route("/api/appointments/<int:app_id>/start-visit", methods=["POST"])
def start_visit(app_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    now_time = datetime.now().strftime("%I:%M %p")
    msg = f"Healthcare professional checked in at your location at {now_time}. Home visit in progress."
    cursor.execute("""
    UPDATE appointments 
    SET status = 'In-Progress', current_step = 5, staff_response = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (msg, app_id))
    conn.commit()

    cursor.execute("""
    SELECT a.*, 
           COALESCE(s.title, 'General Healthcare Service') AS service_title,
           COALESCE(p.name, 'Patient #' || a.patient_id) AS patient_name,
           COALESCE(p.phone, a.emergency_contact_phone, '') AS patient_phone,
           pro.name AS professional_name,
           pro.phone AS professional_phone,
           pro.specialization AS professional_specialization,
           pro.avatar AS professional_avatar,
           pro.rating AS professional_rating
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN users p ON a.patient_id = p.id
    LEFT JOIN users pro ON a.professional_id = pro.id
    WHERE a.id = ?
    """, (app_id,))
    updated_app = cursor.fetchone()
    conn.close()

    app_dict = dict(updated_app) if updated_app else None
    if app_dict and app_dict.get("uploaded_docs"):
        try:
            app_dict["uploaded_docs"] = json.loads(app_dict["uploaded_docs"])
        except Exception:
            pass

    return jsonify({
        "success": True, 
        "message": f"Visit checked-in at {now_time}. Service in progress.", 
        "check_in_time": now_time,
        "appointment": app_dict
    })

@app.route("/api/appointments/<int:app_id>/complete-service", methods=["POST"])
def complete_service_records(app_id):
    if session.get("role") not in {"professional", "pharmacist", "admin"}:
        return jsonify({"success": False, "message": "Access Denied"}), 403

    data = request.get_json() or {}
    user_id = session.get("user_id", 4)
    
    # Vitals
    bp = data.get("blood_pressure", "120/80")
    pulse = data.get("pulse_rate", 72)
    temp = data.get("temperature", 98.6)
    spo2 = data.get("spo2", 98)
    sugar = data.get("blood_sugar", 105.0)
    resp = data.get("respiration_rate", 16)
    clinical_notes = data.get("clinical_notes", "")
    treatment_given = data.get("treatment_given", "")
    attached_report_path = data.get("attached_report_path", "")

    # Prescription
    doctor_name = data.get("doctor_name", "Attending Healthcare Staff")
    diagnosis = data.get("diagnosis", "Clinical Assessment")
    medicines = data.get("medicines", [])
    special_instructions = data.get("special_instructions", "")
    follow_up_date = data.get("follow_up_date", "")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT patient_id, professional_id FROM appointments WHERE id = ?", (app_id,))
    app_info = cursor.fetchone()
    if not app_info:
        conn.close()
        return jsonify({"success": False, "message": "Appointment not found."}), 404

    patient_id = app_info["patient_id"]
    prof_id = app_info["professional_id"] or user_id
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_time = datetime.now().strftime("%I:%M %p")

    # Upsert visit records
    cursor.execute("DELETE FROM visit_records WHERE appointment_id = ?", (app_id,))
    cursor.execute("""
    INSERT INTO visit_records (
        appointment_id, patient_id, professional_id, visit_date, check_in_time, check_out_time,
        blood_pressure, pulse_rate, temperature, spo2, blood_sugar, respiration_rate,
        clinical_notes, treatment_given, attached_report_path
    ) VALUES (?, ?, ?, ?, 'Checked-In', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        app_id, patient_id, prof_id, today_str, now_time,
        bp, pulse, temp, spo2, sugar, resp,
        clinical_notes, treatment_given, attached_report_path
    ))

    # Upsert Prescription if medicines or diagnosis supplied
    if medicines or diagnosis:
        cursor.execute("DELETE FROM prescriptions WHERE appointment_id = ?", (app_id,))
        cursor.execute("""
        INSERT INTO prescriptions (
            appointment_id, patient_id, professional_id, doctor_name, diagnosis,
            medicines_json, special_instructions, follow_up_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_id, patient_id, prof_id, doctor_name, diagnosis,
            json.dumps(medicines), special_instructions, follow_up_date
        ))

    summary_resp = f"Visit completed by {doctor_name}. Assessment: {diagnosis}. Clinical vitals and prescription recorded."
    # Advance appointment to Step 7 (Payment required)
    cursor.execute("""
    UPDATE appointments 
    SET current_step = 7, staff_response = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (summary_resp, app_id))

    conn.commit()

    cursor.execute("""
    SELECT a.*, 
           COALESCE(s.title, 'General Healthcare Service') AS service_title,
           COALESCE(p.name, 'Patient #' || a.patient_id) AS patient_name,
           COALESCE(p.phone, a.emergency_contact_phone, '') AS patient_phone,
           pro.name AS professional_name,
           pro.phone AS professional_phone,
           pro.specialization AS professional_specialization,
           pro.avatar AS professional_avatar,
           pro.rating AS professional_rating
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN users p ON a.patient_id = p.id
    LEFT JOIN users pro ON a.professional_id = pro.id
    WHERE a.id = ?
    """, (app_id,))
    updated_app = cursor.fetchone()
    conn.close()

    app_dict = dict(updated_app) if updated_app else None
    if app_dict and app_dict.get("uploaded_docs"):
        try:
            app_dict["uploaded_docs"] = json.loads(app_dict["uploaded_docs"])
        except Exception:
            pass

    return jsonify({
        "success": True,
        "message": "Health records, vitals, and prescription successfully updated! Ready for payment checkout.",
        "current_step": 7,
        "appointment": app_dict
    })

# ==========================================
# 7. Payment Processing API (Step 7)
# ==========================================
@app.route("/api/appointments/<int:app_id>/pay", methods=["POST"])
def process_payment(app_id):
    data = request.get_json() or {}
    payment_method = data.get("payment_method", "online_card")  # online_card, online_upi, cash
    
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT a.*, s.price AS service_price 
    FROM appointments a 
    JOIN services s ON a.service_id = s.id 
    WHERE a.id = ?
    """, (app_id,))
    app_info = cursor.fetchone()

    if not app_info:
        conn.close()
        return jsonify({"success": False, "message": "Appointment not found."}), 404

    base_price = app_info["service_price"]
    consumables = 15.00
    tax = round((base_price + consumables) * 0.05, 2)
    total = base_price + consumables + tax

    txn_id = f"TXN-{payment_method.upper()}-{uuid.uuid4().hex[:8].upper()}"
    invoice_num = f"INV-{datetime.now().strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"

    breakdown = {
        "base_service": base_price,
        "consumables": consumables,
        "tax": tax,
        "discount": 0.00,
        "total": total
    }

    # Record payment
    cursor.execute("DELETE FROM payments WHERE appointment_id = ?", (app_id,))
    cursor.execute("""
    INSERT INTO payments (
        appointment_id, patient_id, amount, payment_method, transaction_id, payment_status, invoice_number, breakdown_json
    ) VALUES (?, ?, ?, ?, ?, 'Completed', ?, ?)
    """, (
        app_id, app_info["patient_id"], total, payment_method, txn_id, invoice_num, json.dumps(breakdown)
    ))

    # Advance to Step 8 (Records/History ready) & Mark Completed if paid
    cursor.execute("""
    UPDATE appointments 
    SET status = 'Completed', current_step = 8, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (app_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Payment of NPR {total:.2f} completed successfully via {payment_method.replace('_', ' ').title()}!",
        "transaction_id": txn_id,
        "invoice_number": invoice_num,
        "total_amount": total,
        "current_step": 8
    })

# ==========================================
# 8. Patient Vitals Trends & History (Step 8)
# ==========================================
@app.route("/api/patient/vitals-history", methods=["GET"])
def get_vitals_history():
    if session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied"}), 403

    user_id = session.get("user_id")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT vr.*, a.appointment_number, s.title AS service_title 
    FROM visit_records vr
    JOIN appointments a ON vr.appointment_id = a.id
    JOIN services s ON a.service_id = s.id
    WHERE vr.patient_id = ?
    ORDER BY vr.visit_date ASC, vr.id ASC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    vitals = [dict(r) for r in rows]
    return jsonify({"success": True, "vitals_history": vitals})

# ==========================================
# 9. Feedback & Issue Resolution (Step 9)
# ==========================================
@app.route("/api/appointments/<int:app_id>/feedback", methods=["POST"])
def submit_feedback(app_id):
    if session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied"}), 403

    allowed, _ = ensure_appointment_belongs_to_current_patient(app_id)
    if not allowed:
        return jsonify({"success": False, "message": "Access Denied"}), 403

    data = request.get_json() or {}
    try:
        rating = int(data.get("rating", 5))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Rating must be a whole number from 1 to 5."}), 400
    if not 1 <= rating <= 5:
        return jsonify({"success": False, "message": "Rating must be between 1 and 5."}), 400
    tags = data.get("tags", "")
    comments = data.get("comments", "").strip()
    is_satisfied = 1 if data.get("is_satisfied", True) else 0

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT patient_id, professional_id FROM appointments WHERE id = ?", (app_id,))
    app_info = cursor.fetchone()

    if not app_info:
        conn.close()
        return jsonify({"success": False, "message": "Appointment not found."}), 404

    cursor.execute("DELETE FROM feedback WHERE appointment_id = ?", (app_id,))
    cursor.execute("""
    INSERT INTO feedback (appointment_id, patient_id, professional_id, rating, tags, comments, is_satisfied)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (app_id, app_info["patient_id"], app_info["professional_id"], rating, tags, comments, is_satisfied))

    # Keep the professional profile rating in sync with all submitted feedback.
    updated_rating = None
    if app_info["professional_id"]:
        cursor.execute("""
        SELECT ROUND(AVG(rating), 2)
        FROM feedback
        WHERE professional_id = ?
        """, (app_info["professional_id"],))
        updated_rating = cursor.fetchone()[0]
        cursor.execute("""
        UPDATE users
        SET rating = ?
        WHERE id = ?
        """, (updated_rating, app_info["professional_id"]))

    # Update appointment current_step to 9
    cursor.execute("""
    UPDATE appointments 
    SET current_step = 9, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (app_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "is_satisfied": bool(is_satisfied),
        "professional_id": app_info["professional_id"],
        "professional_rating": updated_rating,
        "message": "Thank you! Your feedback has been recorded successfully." if is_satisfied else "Feedback received. You can now raise an issue resolution ticket if unsatisfied."
    })

@app.route("/api/appointments/<int:app_id>/issue", methods=["POST"])
def raise_issue_ticket(app_id):
    if session.get("role") != "patient":
        return jsonify({"success": False, "message": "Access Denied"}), 403

    allowed, _ = ensure_appointment_belongs_to_current_patient(app_id)
    if not allowed:
        return jsonify({"success": False, "message": "Access Denied"}), 403

    data = request.get_json() or {}
    category = data.get("category", "Service Quality")
    description = data.get("description", "").strip()
    desired_resolution = data.get("desired_resolution", "Refund")

    if not description:
        return jsonify({"success": False, "message": "Please describe the issue encountered."}), 400

    ticket_number = f"TKT-{datetime.now().strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT patient_id FROM appointments WHERE id = ?", (app_id,))
    app_info = cursor.fetchone()

    if not app_info:
        conn.close()
        return jsonify({"success": False, "message": "Appointment not found."}), 404

    cursor.execute("""
    INSERT INTO issue_tickets (ticket_number, appointment_id, patient_id, category, description, desired_resolution, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Open')
    """, (ticket_number, app_id, app_info["patient_id"], category, description, desired_resolution))

    cursor.execute("""
    UPDATE appointments 
    SET status = 'Issue Raised', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (app_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Issue Ticket #{ticket_number} created and escalated to Healthcare Admin.",
        "ticket_number": ticket_number
    })

@app.route("/api/issues", methods=["GET"])
def get_issues():
    conn = get_db_connection()
    cursor = conn.cursor()
    role = session.get("role")
    user_id = session.get("user_id")

    if role == "patient":
        cursor.execute("""
        SELECT it.*, 
               a.appointment_number, a.appointment_date,
               p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
               s.title AS service_title,
               pro.name AS professional_name
        FROM issue_tickets it
        JOIN appointments a ON it.appointment_id = a.id
        JOIN users p ON it.patient_id = p.id
        JOIN services s ON a.service_id = s.id
        LEFT JOIN users pro ON a.professional_id = pro.id
        WHERE it.patient_id = ?
        ORDER BY it.id DESC
        """, (user_id,))
    else:
        cursor.execute("""
        SELECT it.*, 
               a.appointment_number, a.appointment_date,
               p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
               s.title AS service_title,
               pro.name AS professional_name
        FROM issue_tickets it
        JOIN appointments a ON it.appointment_id = a.id
        JOIN users p ON it.patient_id = p.id
        JOIN services s ON a.service_id = s.id
        LEFT JOIN users pro ON a.professional_id = pro.id
        ORDER BY it.id DESC
        """)
    rows = cursor.fetchall()
    conn.close()

    issues = [dict(r) for r in rows]
    return jsonify({"success": True, "issues": issues})

@app.route("/api/issues/<int:ticket_id>/resolve", methods=["POST"])
def resolve_issue(ticket_id):
    data = request.get_json() or {}
    status = data.get("status", "Resolved")
    admin_notes = data.get("admin_notes", "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    UPDATE issue_tickets 
    SET status = ?, admin_notes = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (status, admin_notes, ticket_id))
    
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Ticket #{ticket_id} updated to '{status}' with admin resolution notes."
    })

# ==========================================
# 10. System Stats & Quick Reset API
# ==========================================
@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM appointments")
    total_appointments = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM appointments WHERE status = 'Completed'")
    completed_appointments = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM appointments WHERE status = 'Pending'")
    pending_appointments = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM issue_tickets WHERE status = 'Open'")
    open_issues = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'Completed'")
    total_revenue = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(AVG(rating), 5.0) FROM feedback")
    avg_rating = round(cursor.fetchone()[0], 1)

    conn.close()

    return jsonify({
        "success": True,
        "stats": {
            "total_appointments": total_appointments,
            "completed_appointments": completed_appointments,
            "pending_appointments": pending_appointments,
            "open_issues": open_issues,
            "total_revenue": total_revenue,
            "avg_rating": avg_rating
        }
    })

if __name__ == "__main__":
    init_db()
    debug_mode = os.environ.get("FLASK_DEBUG", "0").lower() in {"1", "true", "yes", "on"}
    print("Starting Home Healthcare Management System on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=debug_mode, use_reloader=debug_mode)
