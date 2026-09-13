"""
Home Healthcare Management System - Flask Backend Application
Provides RESTful APIs and UI routing for the 9-step home healthcare workflow.
"""

import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session, send_from_directory
from werkzeug.utils import secure_filename
from database import get_db_connection, init_db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "local-development-secret-key")

default_upload_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads")
if os.environ.get("VERCEL"):
    default_upload_folder = "/tmp/uploads"
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", default_upload_folder)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

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
        """, (name, email, password, role, phone, age, gender, blood_group, address, specialization, qualification))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        session["user_id"] = user_id
        session["role"] = role

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

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    user = dict(row)
    del user["password"]
    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return jsonify({"success": True, "message": "Login successful!", "user": user})

@app.route("/api/auth/me", methods=["GET"])
def current_user():
    user_id = session.get("user_id", 1)  # Default demo patient if not set
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

@app.route("/api/auth/demo-switch", methods=["POST"])
def demo_switch():
    data = request.get_json() or {}
    target_role = data.get("role", "patient")
    
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
    elif target_role in ("pharmacist", "pharm", "shyam"):
        cursor.execute("SELECT * FROM users WHERE email = 'pharm.shyam@demo.com' LIMIT 1")
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
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, phone, specialization, qualification, experience_years, rating, avatar FROM users WHERE role = 'professional'")
    rows = cursor.fetchall()
    conn.close()

    professionals = [dict(r) for r in rows]
    return jsonify({"success": True, "professionals": professionals})

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
    user_id = session.get("user_id", 1)
    role = session.get("role", "patient")

    # Filter parameter from query
    status_filter = request.args.get("status")

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT a.*, 
           s.title AS service_title, s.category AS service_category, s.price AS service_price, s.icon AS service_icon,
           p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.blood_group AS patient_blood_group,
           pro.name AS professional_name, pro.phone AS professional_phone, pro.specialization AS professional_specialization, pro.avatar AS professional_avatar
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users p ON a.patient_id = p.id
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
    conn = get_db_connection()
    cursor = conn.cursor()

    # Appointment base
    cursor.execute("""
    SELECT a.*, 
           s.title AS service_title, s.category AS service_category, s.price AS service_price, s.duration AS service_duration, s.icon AS service_icon, s.inclusions AS service_inclusions,
           p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email, p.age AS patient_age, p.gender AS patient_gender, p.blood_group AS patient_blood_group,
           pro.name AS professional_name, pro.phone AS professional_phone, pro.specialization AS professional_specialization, pro.rating AS professional_rating, pro.avatar AS professional_avatar
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users p ON a.patient_id = p.id
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
    data = request.get_json() or {}
    patient_id = session.get("user_id", data.get("patient_id", 1))
    service_id = data.get("service_id")
    appointment_date = data.get("appointment_date")
    time_slot = data.get("time_slot")
    address = data.get("address", "").strip()
    symptoms = data.get("symptoms", "").strip()
    emergency_contact_name = data.get("emergency_contact_name", "")
    emergency_contact_phone = data.get("emergency_contact_phone", "")
    uploaded_docs = data.get("uploaded_docs", [])

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

# ==========================================
# 5. Admin Assignment API (Step 4)
# ==========================================
@app.route("/api/appointments/<int:app_id>/assign", methods=["POST"])
def assign_professional(app_id):
    data = request.get_json() or {}
    professional_id = data.get("professional_id")

    if not professional_id:
        return jsonify({"success": False, "message": "Please select a Healthcare Professional."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Update appointment to Assigned, current_step 5
    cursor.execute("""
    UPDATE appointments 
    SET professional_id = ?, status = 'Assigned', current_step = 5, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (professional_id, app_id))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Healthcare professional assigned and appointment confirmed successfully!"
    })

# ==========================================
# 6. Home Visit & Records Update APIs (Step 5 & 6)
# ==========================================
@app.route("/api/appointments/<int:app_id>/start-visit", methods=["POST"])
def start_visit(app_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    now_time = datetime.now().strftime("%I:%M %p")
    cursor.execute("""
    UPDATE appointments 
    SET status = 'In-Progress', current_step = 5, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (app_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Visit checked-in at {now_time}. Service in progress.", "check_in_time": now_time})

@app.route("/api/appointments/<int:app_id>/complete-service", methods=["POST"])
def complete_service_records(app_id):
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

    # Advance appointment to Step 7 (Payment required)
    cursor.execute("""
    UPDATE appointments 
    SET current_step = 7, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (app_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Health records, vitals, and prescription successfully updated! Ready for payment checkout.",
        "current_step": 7
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
    user_id = session.get("user_id", 1)
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
    print("Starting Home Healthcare Management System on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
