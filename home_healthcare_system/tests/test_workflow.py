"""
End-to-End Automated Workflow Verification Test
Tests all 9 steps of the Home Healthcare Management System lifecycle.
"""

import unittest
import json
import io
import uuid
from datetime import datetime
from app import app
from database import init_db

class HomeHealthcareWorkflowTestCase(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()
        with app.app_context():
            init_db()

    def test_step1_authentication(self):
        """Step 1: Patient Registration and Login"""
        test_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
        # Register new patient
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Jane Miller",
            "email": test_email,
            "password": "pass123",
            "role": "patient",
            "phone": "+1 (555) 999-8888",
            "age": 42,
            "gender": "Female",
            "blood_group": "B+",
            "address": "100 Maple St, Springfield"
        })
        self.assertEqual(reg_res.status_code, 200)
        reg_data = reg_res.get_json()
        self.assertTrue(reg_data["success"])

        # Login
        login_res = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": "pass123"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.get_json()["success"])

        # Me endpoint
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.get_json()["user"]["name"], "Jane Miller")

    def test_patient_cannot_access_another_patients_data(self):
        """A patient must never read or manipulate another patient's records."""
        with app.app_context():
            init_db(force_reseed=True)

        patient_a = self.client.post("/api/auth/register", json={
            "name": "Alice Patient",
            "email": "alice@example.com",
            "password": "StrongPass!123",
            "role": "patient",
            "phone": "+1 111",
            "age": 30,
            "gender": "Female",
            "blood_group": "A+",
            "address": "1 Alice St"
        })
        self.assertEqual(patient_a.status_code, 200)

        patient_b = self.client.post("/api/auth/register", json={
            "name": "Bob Patient",
            "email": "bob@example.com",
            "password": "StrongPass!456",
            "role": "patient",
            "phone": "+1 222",
            "age": 35,
            "gender": "Male",
            "blood_group": "B+",
            "address": "2 Bob St"
        })
        self.assertEqual(patient_b.status_code, 200)

        service_res = self.client.get("/api/services")
        service_id = service_res.get_json()["services"][0]["id"]

        self.client.post("/api/auth/logout", json={})
        login_a = self.client.post("/api/auth/login", json={"email": "alice@example.com", "password": "StrongPass!123"})
        self.assertTrue(login_a.get_json()["success"])

        appointment_res = self.client.post("/api/appointments", json={
            "service_id": service_id,
            "appointment_date": "2026-10-12",
            "time_slot": "09:00 AM - 10:00 AM",
            "address": "1 Alice St",
            "symptoms": "Needs care"
        })
        self.assertEqual(appointment_res.status_code, 200)
        appointment_id = appointment_res.get_json()["appointment_id"]

        self.client.post("/api/auth/logout", json={})
        login_b = self.client.post("/api/auth/login", json={"email": "bob@example.com", "password": "StrongPass!456"})
        self.assertTrue(login_b.get_json()["success"])

        forbidden = self.client.get(f"/api/appointments/{appointment_id}")
        self.assertEqual(forbidden.status_code, 403)
        self.assertIn("Access Denied", forbidden.get_json()["message"])

    def test_forgot_password_recovery_flow(self):
        """A patient can request a reset OTP, verify it, and set a new password."""
        with app.app_context():
            init_db(force_reseed=True)

        register = self.client.post("/api/auth/register", json={
            "name": "Reset User",
            "email": "reset@example.com",
            "password": "OldPass!123",
            "role": "patient",
            "phone": "+1 777",
            "age": 27,
            "gender": "Female",
            "blood_group": "O-",
            "address": "Reset Street"
        })
        self.assertEqual(register.status_code, 200)

        forgot = self.client.post("/api/auth/forgot-password", json={"identifier": "reset@example.com"})
        self.assertEqual(forgot.status_code, 200)
        data = forgot.get_json()
        self.assertTrue(data["success"])
        self.assertIn("otp", data)
        otp = data["otp"]

        reset = self.client.post("/api/auth/reset-password", json={
            "identifier": "reset@example.com",
            "otp": otp,
            "new_password": "NewSecure!456",
            "confirm_password": "NewSecure!456"
        })
        self.assertEqual(reset.status_code, 200)
        self.assertTrue(reset.get_json()["success"])

        login = self.client.post("/api/auth/login", json={
            "email": "reset@example.com",
            "password": "NewSecure!456"
        })
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.get_json()["success"])

    def test_step2_to_step9_complete_lifecycle(self):
        """Steps 2 to 9: Complete End-to-End Workflow Lifecycle"""
        with app.app_context():
            init_db(force_reseed=True)

        login_res = self.client.post("/api/auth/login", json={
            "email": "ram@demo.com",
            "password": "ram123"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.get_json()["success"])

        # --- STEP 2: Select Service ---
        svc_res = self.client.get("/api/services")
        self.assertEqual(svc_res.status_code, 200)
        services = svc_res.get_json()["services"]
        self.assertGreater(len(services), 0)
        service = services[0]  # Skilled Nursing Care
        service_id = service["id"]

        # --- STEP 3: Book Appointment & Upload Document ---
        # Upload doc
        file_content = b"Previous Doctor Discharge Note and Rx"
        upload_res = self.client.post("/api/upload", data={
            "file": (io.BytesIO(file_content), "discharge_note.pdf")
        }, content_type="multipart/form-data")
        self.assertEqual(upload_res.status_code, 200)
        upload_data = upload_res.get_json()
        self.assertTrue(upload_data["success"])
        doc_filename = upload_data["filename"]

        # Book Appointment
        book_res = self.client.post("/api/appointments", json={
            "patient_id": 1,
            "service_id": service_id,
            "appointment_date": "2026-09-02",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": "742 Evergreen Terrace, Springfield",
            "symptoms": "Post-op wound care and sterile dressing required.",
            "emergency_contact_name": "Mary Doe",
            "emergency_contact_phone": "+1 555 234 9999",
            "uploaded_docs": [doc_filename]
        })
        self.assertEqual(book_res.status_code, 200)
        book_data = book_res.get_json()
        self.assertTrue(book_data["success"])
        appointment_id = book_data["appointment_id"]

        # --- STEP 4: Admin Assigns Healthcare Professional ---
        assign_res = self.client.post(f"/api/appointments/{appointment_id}/assign", json={
            "professional_id": 4  # Nurse Sarah Jenkins
        })
        self.assertEqual(assign_res.status_code, 200)
        self.assertTrue(assign_res.get_json()["success"])

        # Verify status is Assigned
        app_res = self.client.get(f"/api/appointments/{appointment_id}")
        self.assertEqual(app_res.get_json()["appointment"]["status"], "Assigned")

        with self.client.session_transaction() as sess:
            sess["user_id"] = 4
            sess["role"] = "professional"
            sess["last_activity"] = datetime.now().timestamp()

        # --- STEP 5: Home Visit Check-In & In-Progress ---
        start_res = self.client.post(f"/api/appointments/{appointment_id}/start-visit")
        self.assertEqual(start_res.status_code, 200)
        self.assertTrue(start_res.get_json()["success"])

        # --- STEP 6: Update Vitals, Records & Prescriptions ---
        records_res = self.client.post(f"/api/appointments/{appointment_id}/complete-service", json={
            "blood_pressure": "118/76",
            "pulse_rate": 74,
            "temperature": 98.6,
            "spo2": 99,
            "blood_sugar": 102.0,
            "respiration_rate": 16,
            "clinical_notes": "Aseptic wound dressing applied. Healing satisfactorily.",
            "treatment_given": "Wound cleansed and dressed with Aquacel Ag.",
            "doctor_name": "Dr. James Wilson, MD",
            "diagnosis": "Post-Op Wound Healing",
            "medicines": [
                {"name": "Amoxicillin 500mg", "dosage": "1 Tab", "frequency": "Twice daily", "duration": "5 Days", "instructions": "After food"}
            ],
            "special_instructions": "Keep dressing dry."
        })
        self.assertEqual(records_res.status_code, 200)
        self.assertTrue(records_res.get_json()["success"])

        # --- STEP 7: Payment (Online Card) ---
        pay_res = self.client.post(f"/api/appointments/{appointment_id}/pay", json={
            "payment_method": "online_card"
        })
        self.assertEqual(pay_res.status_code, 200)
        pay_data = pay_res.get_json()
        self.assertTrue(pay_data["success"])
        self.assertEqual(pay_data["current_step"], 8)

        # --- STEP 8: View Records, Reports & Vitals History ---
        login_patient = self.client.post("/api/auth/login", json={
            "email": "ram@demo.com",
            "password": "ram123"
        })
        self.assertEqual(login_patient.status_code, 200)
        self.assertTrue(login_patient.get_json()["success"])

        vitals_res = self.client.get("/api/patient/vitals-history")
        self.assertEqual(vitals_res.status_code, 200)
        vitals_list = vitals_res.get_json()["vitals_history"]
        self.assertGreater(len(vitals_list), 0)

        # --- STEP 9: Feedback, Rating & Satisfaction / Issue Resolution ---
        # 9A: Feedback rating
        fb_res = self.client.post(f"/api/appointments/{appointment_id}/feedback", json={
            "rating": 5,
            "tags": "Punctual, Compassionate Care",
            "comments": "Superb home nursing service!",
            "is_satisfied": True
        })
        self.assertEqual(fb_res.status_code, 200)
        self.assertTrue(fb_res.get_json()["success"])

        # 9B: Issue Resolution option test
        issue_res = self.client.post(f"/api/appointments/{appointment_id}/issue", json={
            "category": "Billing / Payment Discrepancy",
            "description": "Invoice question regarding consumables.",
            "desired_resolution": "Senior Medical Officer Call"
        })
        self.assertEqual(issue_res.status_code, 200)
        issue_data = issue_res.get_json()
        self.assertTrue(issue_data["success"])

        # Admin resolves issue
        issues_list_res = self.client.get("/api/issues")
        self.assertEqual(issues_list_res.status_code, 200)
        open_issues = issues_list_res.get_json()["issues"]
        self.assertGreater(len(open_issues), 0)
        latest_ticket_id = open_issues[0]["id"]

        resolve_res = self.client.post(f"/api/issues/{latest_ticket_id}/resolve", json={
            "status": "Resolved",
            "admin_notes": "Explained billing components and issued courtesy credit."
        })
        self.assertEqual(resolve_res.status_code, 200)
        self.assertTrue(resolve_res.get_json()["success"])

    def test_patient_can_only_access_own_profile_and_not_staff_or_admin(self):
        """After a patient logs in, they can only access their own profile and cannot access staff or admin profiles."""
        with app.app_context():
            init_db(force_reseed=True)

        reg_res = self.client.post("/api/auth/register", json={
            "name": "Unique Patient",
            "email": "unique.patient@example.com",
            "password": "Password123!",
            "role": "patient",
            "phone": "+977 9800000001",
            "age": 29,
            "gender": "Male",
            "blood_group": "AB+",
            "address": "Baneshwor, Kathmandu"
        })
        self.assertEqual(reg_res.status_code, 200)
        user_id = reg_res.get_json()["user"]["id"]

        # 1. Patient can access their own profile
        profile_res = self.client.get("/api/patient/profile")
        self.assertEqual(profile_res.status_code, 200)
        profile_data = profile_res.get_json()
        self.assertTrue(profile_data["success"])
        self.assertEqual(profile_data["profile"]["name"], "Unique Patient")
        self.assertEqual(profile_data["profile"]["email"], "unique.patient@example.com")
        self.assertEqual(profile_data["profile"]["blood_group"], "AB+")

        # 2. Patient can update their own profile
        update_res = self.client.post("/api/patient/profile", json={
            "name": "Unique Patient Updated",
            "phone": "+977 9800000002",
            "age": 30,
            "gender": "Male",
            "blood_group": "AB+",
            "address": "Patan, Lalitpur"
        })
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.get_json()["user"]["name"], "Unique Patient Updated")
        self.assertEqual(update_res.get_json()["user"]["address"], "Patan, Lalitpur")

        # 3. Patient CANNOT access healthcare staff directory (doctor, nurse profiles)
        staff_res = self.client.get("/api/professionals")
        self.assertEqual(staff_res.status_code, 403)
        self.assertIn("Access Denied", staff_res.get_json()["message"])

        # 4. Patient CANNOT switch role to doctor, nurse, or admin via demo-switch
        for forbidden_role in ["admin", "nurse", "doctor", "therapist", "pharmacist", "doctor_sunil"]:
            switch_res = self.client.post("/api/auth/demo-switch", json={"role": forbidden_role})
            self.assertEqual(switch_res.status_code, 403)
            self.assertIn("Access Denied", switch_res.get_json()["message"])

    def test_staff_and_admin_can_login_to_their_respective_portals(self):
        """Staff (Doctor, Nurse, Pharmacist) and Admin can log in to access their respective systems."""
        with app.app_context():
            init_db(force_reseed=True)

        # 1. Staff / Admin login WITHOUT PIN fails with 403
        no_pin = self.client.post("/api/auth/login", json={
            "email": "sandeep@demo.com",
            "password": "admin123"
        })
        self.assertEqual(no_pin.status_code, 403)
        self.assertIn("Hospital Clearance Required", no_pin.get_json()["message"])

        # 2. Staff login with WRONG PIN fails with 403
        wrong_pin = self.client.post("/api/auth/login", json={
            "email": "dr.binod@demo.com",
            "password": "doctor123",
            "staff_pin": "9999"
        })
        self.assertEqual(wrong_pin.status_code, 403)
        self.assertIn("Hospital Clearance Required", wrong_pin.get_json()["message"])

        # 3. Admin login with correct PIN (2026) succeeds
        admin_login = self.client.post("/api/auth/login", json={
            "email": "sandeep@demo.com",
            "password": "admin123",
            "staff_pin": "2026"
        })
        self.assertEqual(admin_login.status_code, 200)
        admin_data = admin_login.get_json()
        self.assertTrue(admin_data["success"])
        self.assertEqual(admin_data["user"]["role"], "admin")

        # Admin can access issues and professionals list
        issues_res = self.client.get("/api/issues")
        self.assertEqual(issues_res.status_code, 200)

        # 4. Doctor login with correct PIN (2026) succeeds
        self.client.post("/api/auth/logout")
        doc_login = self.client.post("/api/auth/login", json={
            "email": "dr.binod@demo.com",
            "password": "doctor123",
            "staff_pin": "2026"
        })
        self.assertEqual(doc_login.status_code, 200)
        doc_data = doc_login.get_json()
        self.assertTrue(doc_data["success"])
        self.assertEqual(doc_data["user"]["role"], "professional")

        # 5. Nurse login with correct PIN (2026) succeeds
        self.client.post("/api/auth/logout")
        nurse_login = self.client.post("/api/auth/login", json={
            "email": "nurse.rama@demo.com",
            "password": "nurse123",
            "staff_pin": "2026"
        })
        self.assertEqual(nurse_login.status_code, 200)
        nurse_data = nurse_login.get_json()
        self.assertTrue(nurse_data["success"])
        self.assertEqual(nurse_data["user"]["role"], "professional")

        # 6. Patient login DOES NOT require a PIN and succeeds
        self.client.post("/api/auth/logout")
        patient_login = self.client.post("/api/auth/login", json={
            "email": "ram@demo.com",
            "password": "ram123"
        })
        self.assertEqual(patient_login.status_code, 200)
        self.assertTrue(patient_login.get_json()["success"])

    def test_patient_alias_login_and_appointment_sync(self):
        """Verify patient alias resolution, resilient demo passwords, and appointment sync."""
        # 1. Alias patient@demo.com should resolve to ram@demo.com
        self.client.post("/api/auth/logout")
        alias_login = self.client.post("/api/auth/login", json={
            "email": "patient@demo.com",
            "password": "ram123"
        })
        self.assertEqual(alias_login.status_code, 200)
        data = alias_login.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["email"], "ram@demo.com")

        # 2. Book an appointment as patient
        service_res = self.client.get("/api/services")
        service_id = service_res.get_json()["services"][0]["id"]

        booking_res = self.client.post("/api/appointments", json={
            "service_id": service_id,
            "appointment_date": "2026-10-25",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": "456 Lakeside, Pokhara",
            "symptoms": "Post-op wound dressing check"
        })
        self.assertEqual(booking_res.status_code, 200)
        book_data = booking_res.get_json()
        self.assertTrue(book_data["success"])
        app_id = book_data["appointment_id"]
        app_num = book_data["appointment_number"]

        # 3. Admin view should list this appointment
        self.client.post("/api/auth/logout")
        admin_login = self.client.post("/api/auth/login", json={
            "email": "sandeep@demo.com",
            "password": "admin123",
            "staff_pin": "2026"
        })
        self.assertTrue(admin_login.get_json()["success"])

        apps_res = self.client.get("/api/appointments")
        self.assertEqual(apps_res.status_code, 200)
        apps_data = apps_res.get_json()
        self.assertTrue(apps_data["success"])
        app_nums = [a["appointment_number"] for a in apps_data["appointments"]]
        self.assertIn(app_num, app_nums)

        # 4. Sync endpoint should seamlessly ingest appointments
        sync_res = self.client.post("/api/appointments/sync", json={
            "appointments": [{
                "appointment_number": "HC-SYNC-9999",
                "patient_name": "Synced Patient",
                "patient_phone": "+977 9800000000",
                "patient_email": "synced@demo.com",
                "service_title": "Elderly Companion Care",
                "service_fee": 1200,
                "appointment_date": "2026-10-26",
                "time_slot": "02:00 PM - 03:00 PM",
                "address": "Sync St, Kathmandu",
                "symptoms": "Assistance needed",
                "status": "Pending",
                "current_step": 3
            }]
        })
        self.assertEqual(sync_res.status_code, 200)
        self.assertTrue(sync_res.get_json()["success"])

        # Check that synced appointment is in appointments list
        check_apps = self.client.get("/api/appointments")
        synced_nums = [a["appointment_number"] for a in check_apps.get_json()["appointments"]]
        self.assertIn("HC-SYNC-9999", synced_nums)

if __name__ == "__main__":
    unittest.main()
