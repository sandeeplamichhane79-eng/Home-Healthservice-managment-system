"""
Home Healthcare Management System - Database Module
SQLite Database with updated user roster:
- Patient: Ram
- Admin: Sandeep
- Doctor: Dr. Binod Thapa
- Nurse: Rama
- Pharmacist: Chetna
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "healthcare.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_reseed=False):
    if force_reseed and os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('patient', 'admin', 'professional', 'pharmacist')),
        phone TEXT,
        age INTEGER,
        gender TEXT,
        blood_group TEXT,
        address TEXT,
        specialization TEXT,
        qualification TEXT,
        experience_years INTEGER,
        rating REAL DEFAULT 5.0,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Services Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        duration TEXT NOT NULL,
        icon TEXT NOT NULL,
        image_url TEXT,
        inclusions TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    );
    """)

    # 3. Appointments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_number TEXT UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        professional_id INTEGER,
        status TEXT NOT NULL DEFAULT 'Pending' 
            CHECK(status IN ('Pending', 'Assigned', 'In-Progress', 'Completed', 'Cancelled', 'Issue Raised')),
        current_step INTEGER DEFAULT 3,
        appointment_date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        symptoms TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        uploaded_docs TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (service_id) REFERENCES services (id),
        FOREIGN KEY (professional_id) REFERENCES users (id)
    );
    """)

    # 4. Visit Records Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS visit_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        professional_id INTEGER NOT NULL,
        visit_date TEXT NOT NULL,
        check_in_time TEXT,
        check_out_time TEXT,
        blood_pressure TEXT,
        pulse_rate INTEGER,
        temperature REAL,
        spo2 INTEGER,
        blood_sugar REAL,
        respiration_rate INTEGER,
        clinical_notes TEXT,
        treatment_given TEXT,
        attached_report_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id),
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (professional_id) REFERENCES users (id)
    );
    """)

    # 5. Prescriptions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        professional_id INTEGER NOT NULL,
        doctor_name TEXT NOT NULL,
        pharmacist_name TEXT DEFAULT 'Shyam (Pharmacist)',
        diagnosis TEXT NOT NULL,
        medicines_json TEXT NOT NULL,
        special_instructions TEXT,
        follow_up_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id),
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (professional_id) REFERENCES users (id)
    );
    """)

    # 6. Payments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('online_card', 'online_upi', 'cash')),
        transaction_id TEXT UNIQUE NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'Completed' CHECK(payment_status IN ('Completed', 'Pending', 'Refunded')),
        invoice_number TEXT UNIQUE NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        breakdown_json TEXT,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id),
        FOREIGN KEY (patient_id) REFERENCES users (id)
    );
    """)

    # 7. Feedback Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        professional_id INTEGER,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        tags TEXT,
        comments TEXT,
        is_satisfied INTEGER NOT NULL CHECK(is_satisfied IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id),
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (professional_id) REFERENCES users (id)
    );
    """)

    # 8. Issue Tickets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS issue_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        appointment_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        desired_resolution TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'In Review', 'Resolved', 'Refund Processed')),
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id),
        FOREIGN KEY (patient_id) REFERENCES users (id)
    );
    """)

    conn.commit()
    seed_updated_users_data(conn)
    ensure_requested_staff_roster(conn)
    ensure_therapist_demo_account(conn)
    conn.close()

def ensure_requested_staff_roster(conn):
    """Apply the current demo roster to both new and existing databases."""
    conn.execute("UPDATE users SET name = ?, email = ? WHERE id = 1", ("Patient", "patient@demo.com"))
    conn.execute("UPDATE users SET name = ? WHERE email = 'sandeep@demo.com'", ("Sandeep Sharma",))
    conn.execute("UPDATE users SET name = ?, email = ? WHERE email = 'pharm.chetna@demo.com'", ("Shyam", "pharm.shyam@demo.com"))

    requested_staff = [
        ("Chetna", "nurse.chetna@demo.com", "nurse123", "professional", "+977 9811111111", 30, "Female", "A+", "Baneshwor, Kathmandu", "General Nursing & Patient Care", "BSN, RN", 6, 4.95, "https://images.unsplash.com/photo-1584515933487-779824d29309?w=150"),
        ("Dr. Sunil", "dr.sunil@demo.com", "doctor123", "professional", "+977 9822222222", 44, "Male", "B+", "Maharajgunj, Kathmandu", "Consultant Physician", "MBBS, MD", 15, 4.9, "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150"),
        ("Dr. Sahil", "dr.sahil@demo.com", "doctor123", "professional", "+977 9833333333", 41, "Male", "O+", "Thamel, Kathmandu", "Consultant Physician & Cardiologist", "MBBS, MD", 12, 4.9, "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150"),
    ]
    conn.executemany("""
        INSERT OR IGNORE INTO users
        (name, email, password, role, phone, age, gender, blood_group, address, specialization, qualification, experience_years, rating, avatar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, requested_staff)
    conn.commit()

def ensure_therapist_demo_account(conn):
    """Keep the therapist portal available even for databases created before this role was added."""
    conn.execute("""
        INSERT OR IGNORE INTO users
        (name, email, password, role, phone, age, gender, blood_group, address, specialization, qualification, experience_years, rating, avatar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Asha Shrestha, PT", "therapist.asha@demo.com", "therapist123", "professional",
        "+977 9801234567", 33, "Female", "O+", "Patan, Lalitpur",
        "Physical Therapist, Rehabilitation & Mobility Care", "BPT, MPT, Licensed Physiotherapist",
        10, 4.96, "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150"
    ))
    conn.commit()

def seed_updated_users_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        return

    print("Seeding updated team roster: Ram, Sandeep, Dr. Binod Thapa, Rama, Chetna...")

    # 1. Seed Users (Ram, Sandeep, Dr. Binod Thapa, Rama, Chetna)
    users_data = [
        # 1. Patient: Ram
        ("Ram", "ram@demo.com", "ram123", "patient", "+977 9841234567", 48, "Male", "O+", "Lazimpat, Kathmandu", None, None, None, 5.0, "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"),
        
        # 2. Admin: Sandeep
        ("Sandeep", "sandeep@demo.com", "admin123", "admin", "+977 9851098765", 42, "Male", "B+", "Central Command Hospital HQ, Kathmandu", "Chief Hospital Director & System Administrator", "MD, MHA, Health Informatics", 16, 5.0, "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150"),
        
        # 3. Doctor: Binod Thapa
        ("Dr. Binod Thapa", "dr.binod@demo.com", "doctor123", "professional", "+977 9841987654", 45, "Male", "A+", "Baluwatar, Kathmandu", "Senior Consultant General Physician & Cardiologist", "MBBS, MD (Internal Medicine), Board Certified", 18, 4.98, "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150"),
        
        # 4. Nurse: Rama
        ("Rama", "nurse.rama@demo.com", "nurse123", "professional", "+977 9860123456", 31, "Female", "B+", "Baneshwor, Kathmandu", "Critical Care, Post-Op & Wound Management Nurse", "BSN, RN, Certified Critical Care Nurse", 9, 4.95, "https://images.unsplash.com/photo-1594824813580-c116d4791559?w=150"),
        
        # 5. Pharmacist: Chetna
        ("Chetna", "pharm.chetna@demo.com", "pharm123", "pharmacist", "+977 9812345678", 29, "Female", "AB+", "Maharajgunj, Kathmandu", "Chief Clinical Pharmacist & Medicine Dispenser", "B.Pharm, Pharm.D, Registered Pharmacist", 7, 4.9, "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150")
    ]

    cursor.executemany("""
    INSERT INTO users (name, email, password, role, phone, age, gender, blood_group, address, specialization, qualification, experience_years, rating, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, users_data)

    # 2. Seed Services
    services_data = [
        (
            "Doctor Home Consultation",
            "Medical",
            "Comprehensive bedside medical checkup and clinical examination by Dr. Binod Thapa with auscultation, diagnosis, ECG review, and digital prescription issuance.",
            95.00,
            "45 mins",
            "fa-user-doctor",
            "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500",
            json.dumps(["Full physical examination", "Stethoscope heart & lung auscultation", "Review of medical history", "Official digital prescription", "Laboratory test orders"])
        ),
        (
            "Skilled Nursing Care",
            "Nursing",
            "Expert in-home clinical nursing by Nurse Rama: sterile wound dressing, IV infusion, catheter management, post-op drainage care, and vitals monitoring.",
            65.00,
            "60 mins",
            "fa-user-nurse",
            "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=500",
            json.dumps(["Sterile wound dressing", "IV/IM Injections & Infusions", "Catheter & Stoma care", "Vitals & Glucose monitoring", "Medication schedule setup"])
        ),
        (
            "Clinical Pharmacy & Medicine Dispensation",
            "Pharmacy",
            "Doorstep medicine dispensation, medication therapy management, dosage review, and drug interaction verification managed directly by Pharmacist Shyam.",
            35.00,
            "30 mins",
            "fa-pills",
            "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=500",
            json.dumps(["Genuine verified medicine delivery", "Dosage & timing schedule counseling", "Drug interaction screening", "Chronic refill management", "Storage safety guidance"])
        ),
        (
            "Elderly & Assisted Living Care",
            "Senior Care",
            "Compassionate daily assisted care for elderly patients including mobility assistance, fall prevention, bedside hygiene support, and timely medication reminders.",
            50.00,
            "120 mins",
            "fa-hands-holding-child",
            "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=500",
            json.dumps(["Mobility & Transfer support", "Bedside hygiene & grooming", "Medication schedule adherence", "Vitals log maintenance", "Companionship support"])
        ),
        (
            "Physical & Rehab Therapy",
            "Rehabilitation",
            "Targeted home physiotherapy for orthopedic recovery, joint mobility, stroke rehab, post-surgery physical strengthening, and pain relief.",
            80.00,
            "50 mins",
            "fa-person-walking",
            "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500",
            json.dumps(["Personalized exercise routine", "Manual therapy & joint mobilization", "Pain relief modalities", "Gait & balance retraining", "Ergonomic guidance"])
        ),
        (
            "Home Lab Diagnostic & Blood Collection",
            "Diagnostic",
            "Hygienic at-home blood and specimen sample collection by certified phlebotomists with fast accredited lab analysis and online digital PDF reports.",
            40.00,
            "30 mins",
            "fa-vial-virus",
            "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=500",
            json.dumps(["Painless vacutainer blood draw", "Sterile specimen handling", "Complete Blood Count (CBC)", "Lipid & Liver Function panel", "Digital report within 6 hours"])
        )
    ]

    cursor.executemany("""
    INSERT INTO services (title, category, description, price, duration, icon, image_url, inclusions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, services_data)

    # 3. Seed Completed Sample Appointment for Ram with Doctor Binod Thapa & Nurse Rama
    past_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
    today_str = datetime.now().strftime("%Y-%m-%d")

    cursor.execute("""
    INSERT INTO appointments (
        appointment_number, patient_id, service_id, professional_id, status, current_step,
        appointment_date, time_slot, address, symptoms, emergency_contact_name, emergency_contact_phone, uploaded_docs
    ) VALUES (
        'HH-2026-001', 1, 1, 3, 'Completed', 9,
        ?, '10:00 AM - 10:45 AM', 'Lazimpat, Kathmandu',
        'Routine hypertension assessment, intermittent chest tightness, and medication renewal.',
        'Sita Sharma (Spouse)', '+977 9841000000', '["sample_discharge_summary.pdf"]'
    )
    """, (past_date,))
    app_id_1 = cursor.lastrowid

    # Vitals by Doctor Binod Thapa
    cursor.execute("""
    INSERT INTO visit_records (
        appointment_id, patient_id, professional_id, visit_date, check_in_time, check_out_time,
        blood_pressure, pulse_rate, temperature, spo2, blood_sugar, respiration_rate,
        clinical_notes, treatment_given, attached_report_path
    ) VALUES (
        ?, 1, 3, ?, '10:05 AM', '10:50 AM',
        '120/78', 72, 98.4, 99, 108.0, 16,
        'Patient Ram examined at bedside. Cardiac auscultation normal, S1/S2 heard, no murmurs. Lungs clear bilaterally. Vitals completely stable.',
        'Stethoscope chest examination performed, BP and glucose verified, prescription renewal counseled.',
        'sample_visit_summary.pdf'
    )
    """, (app_id_1, past_date))

    # Prescription signed by Dr. Binod Thapa, dispensed by Chetna
    medicines = [
        {"name": "Telmisartan 40mg", "dosage": "1 Tablet", "frequency": "Once daily (1-0-0)", "duration": "30 Days", "instructions": "Take in morning after breakfast"},
        {"name": "Amlodipine 5mg", "dosage": "1 Tablet", "frequency": "Once daily (0-0-1)", "duration": "30 Days", "instructions": "Take at night"},
        {"name": "Paracetamol 650mg", "dosage": "1 Tablet", "frequency": "As needed (SOS)", "duration": "5 Days", "instructions": "For mild headache or fever"}
    ]
    cursor.execute("""
    INSERT INTO prescriptions (
        appointment_id, patient_id, professional_id, doctor_name, pharmacist_name, diagnosis, medicines_json, special_instructions, follow_up_date
    ) VALUES (
        ?, 1, 3, 'Dr. Binod Thapa, MD', 'Shyam, B.Pharm', 'Essential Hypertension (Controlled) - Routine Bedside Review',
        ?, 'Reduce dietary salt. Maintain 30 mins brisk walking daily. Verified and dispensed by Pharmacist Shyam.', ?
    )
    """, (app_id_1, json.dumps(medicines), (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")))

    # Payment
    breakdown = {
        "base_service": 95.00,
        "consumables": 15.00,
        "tax": 5.50,
        "discount": 0.00,
        "total": 115.50
    }
    cursor.execute("""
    INSERT INTO payments (
        appointment_id, patient_id, amount, payment_method, transaction_id, payment_status, invoice_number, breakdown_json
    ) VALUES (
        ?, 1, 115.50, 'online_card', 'TXN-KHALTI-89210', 'Completed', 'INV-2026-RAM-01', ?
    )
    """, (app_id_1, json.dumps(breakdown)))

    # Feedback
    cursor.execute("""
    INSERT INTO feedback (
        appointment_id, patient_id, professional_id, rating, tags, comments, is_satisfied
    ) VALUES (
        ?, 1, 3, 5, 'Punctual, Highly Skilled, Clear Explanations, Compassionate Care',
        'Dr. Binod Thapa examined me thoroughly with stethoscope and explained all my medicines. Nurse Rama and Pharmacist Chetna provided excellent support. Very satisfied!',
        1
    )
    """, (app_id_1,))

    # Seed an In-Progress Visit for Nurse Rama
    cursor.execute("""
    INSERT INTO appointments (
        appointment_number, patient_id, service_id, professional_id, status, current_step,
        appointment_date, time_slot, address, symptoms, emergency_contact_name, emergency_contact_phone, uploaded_docs
    ) VALUES (
        'HH-2026-002', 1, 2, 4, 'In-Progress', 5,
        ?, '02:00 PM - 03:00 PM', 'Lazimpat, Kathmandu',
        'Post-operative wound dressing change and sterile IV infusion.',
        'Sita Sharma (Spouse)', '+977 9841000000', '[]'
    )
    """, (today_str,))

    # Seed a Pending request for Admin Sandeep to assign
    cursor.execute("""
    INSERT INTO appointments (
        appointment_number, patient_id, service_id, professional_id, status, current_step,
        appointment_date, time_slot, address, symptoms, emergency_contact_name, emergency_contact_phone, uploaded_docs
    ) VALUES (
        'HH-2026-003', 1, 3, NULL, 'Pending', 4,
        ?, '11:00 AM - 11:30 AM', 'Lazimpat, Kathmandu',
        'Monthly chronic prescription refill and medicine therapy counseling by Pharmacist Shyam.',
        'Sita Sharma (Spouse)', '+977 9841000000', '[]'
    )
    """, ((datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),))

    conn.commit()
    print("Database reseeded with Ram, Sandeep, Dr. Binod Thapa, Rama, and Chetna!")

if __name__ == "__main__":
    init_db(force_reseed=True)
