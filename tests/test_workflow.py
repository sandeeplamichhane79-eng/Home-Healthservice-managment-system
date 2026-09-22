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

    def test_newly_registered_patient_logout_and_login_cycle(self):
        """Verify newly registered patient can repeatedly log out and log back in with same credentials."""
        test_email = f"patient_{uuid.uuid4().hex[:6]}@example.com"
        test_pass = "MySecretPass1"
        test_phone = "+977 9812345699"

        # 1. Register new patient
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Sunita Shrestha",
            "email": test_email,
            "password": test_pass,
            "phone": test_phone,
            "age": 32,
            "gender": "Female",
            "blood_group": "A+",
            "address": "Baluwatar, Kathmandu",
            "role": "patient"
        })
        self.assertEqual(reg_res.status_code, 200)
        self.assertTrue(reg_res.get_json()["success"])

        # 2. Verify initial logged in state
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.get_json()["user"]["name"], "Sunita Shrestha")

        # 3. Log out
        logout_res = self.client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)

        # Confirm session is cleared
        me_after_logout = self.client.get("/api/auth/me")
        self.assertFalse(me_after_logout.get_json()["success"])

        # 4. Log in again with the EXACT same email and password
        login1 = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_pass
        })
        self.assertEqual(login1.status_code, 200)
        self.assertTrue(login1.get_json()["success"])
        self.assertEqual(login1.get_json()["user"]["email"], test_email.lower())

        # 5. Log out again and test case-insensitive login (e.g. capitalized email)
        self.client.post("/api/auth/logout")
        login_upper = self.client.post("/api/auth/login", json={
            "email": test_email.upper(),
            "password": test_pass
        })
        self.assertEqual(login_upper.status_code, 200)
        self.assertTrue(login_upper.get_json()["success"])

        # 6. Log out again and test login by phone number (without country code)
        self.client.post("/api/auth/logout")
        login_phone = self.client.post("/api/auth/login", json={
            "email": "9812345699",
            "password": test_pass
        })
        self.assertEqual(login_phone.status_code, 200)
        self.assertTrue(login_phone.get_json()["success"])

        # 7. Test sync_patient endpoint (used for cross-serverless container recovery)
        self.client.post("/api/auth/logout")
        sync_res = self.client.post("/api/auth/sync-patient", json={
            "name": "Restored Patient",
            "email": "restored@example.com",
            "password": "RestoredPass123",
            "phone": "+977 9801122334",
            "age": 40,
            "gender": "Male",
            "blood_group": "B+",
            "address": "Pulchowk, Lalitpur"
        })
        self.assertEqual(sync_res.status_code, 200)
        self.assertTrue(sync_res.get_json()["success"])

        # Immediate login with the synced account
        login_restored = self.client.post("/api/auth/login", json={
            "email": "restored@example.com",
            "password": "RestoredPass123"
        })
        self.assertEqual(login_restored.status_code, 200)
        self.assertTrue(login_restored.get_json()["success"])
        self.assertEqual(login_restored.get_json()["user"]["name"], "Restored Patient")

    def test_admin_assignment_staff_dashboard_and_patient_response_workflow(self):
        """
        Verify:
        1. Patient books an appointment.
        2. Admin views appointments and assigns a doctor/nurse.
        3. Assigned staff logs in and sees the visit on their dashboard.
        4. Staff responds with ETA and direct clinical message to patient.
        5. Patient sees the staff response and ETA in their health records.
        6. Staff checks in and completes clinical service.
        """
        # Step 1: Patient logs in and creates appointment
        self.client.post("/api/auth/logout")
        pat_login = self.client.post("/api/auth/login", json={
            "email": "ram@demo.com",
            "password": "ram123"
        })
        self.assertTrue(pat_login.get_json()["success"])
        patient_id = pat_login.get_json()["user"]["id"]

        book_res = self.client.post("/api/appointments", json={
            "service_id": 1,
            "appointment_date": "2026-10-01",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": "Baneshwor, Kathmandu",
            "symptoms": "Post-surgery wound care and general health check",
            "emergency_contact_name": "Sita",
            "emergency_contact_phone": "+977 9801122334"
        })
        self.assertEqual(book_res.status_code, 200)
        app_id = book_res.get_json()["appointment_id"]
        app_num = book_res.get_json()["appointment_number"]

        # Step 2: Admin logs in and assigns Dr. Sunil (or doctor)
        self.client.post("/api/auth/logout")
        admin_login = self.client.post("/api/auth/login", json={
            "email": "sandeep@demo.com",
            "password": "admin123",
            "staff_pin": "2026"
        })
        self.assertTrue(admin_login.get_json()["success"])

        # Fetch staff list to get Dr. Sunil's ID
        staff_res = self.client.get("/api/professionals")
        self.assertTrue(staff_res.get_json()["success"])
        staff_list = staff_res.get_json()["professionals"]
        self.assertGreater(len(staff_list), 0)
        target_staff = staff_list[0]
        target_staff_id = target_staff["id"]
        target_staff_name = target_staff["name"]

        # Admin assigns target staff
        assign_res = self.client.post(f"/api/appointments/{app_id}/assign", json={
            "professional_id": target_staff_id
        })
        self.assertEqual(assign_res.status_code, 200)
        assign_data = assign_res.get_json()
        self.assertTrue(assign_data["success"])
        self.assertEqual(assign_data["appointment"]["status"], "Assigned")
        self.assertEqual(assign_data["appointment"]["professional_id"], target_staff_id)
        self.assertIn(target_staff_name, assign_data["appointment"]["staff_response"])

        # Step 3: Assigned staff logs in and views their dashboard
        self.client.post("/api/auth/logout")
        staff_login = self.client.post("/api/auth/login", json={
            "email": target_staff["email"],
            "password": "doctor123" if "dr." in target_staff["email"].lower() else "nurse123",
            "staff_pin": "2026"
        })
        # If demo password differs, fallback to target_staff or session
        if not staff_login.get_json()["success"]:
            staff_login = self.client.post("/api/auth/login", json={
                "email": target_staff["email"],
                "password": "pass",
                "staff_pin": "2026"
            })

        pro_apps = self.client.get("/api/appointments")
        self.assertEqual(pro_apps.status_code, 200)
        assigned_ids = [a["id"] for a in pro_apps.get_json()["appointments"]]
        self.assertIn(app_id, assigned_ids)

        # Step 4: Staff sends ETA and update directly to patient
        respond_res = self.client.post(f"/api/appointments/{app_id}/respond", json={
            "staff_response": "I have reviewed your medical notes and am heading to your home with the wound care kit.",
            "eta": "20 mins",
            "status": "On the Way"
        })
        self.assertEqual(respond_res.status_code, 200)
        resp_data = respond_res.get_json()
        self.assertTrue(resp_data["success"])
        self.assertEqual(resp_data["appointment"]["status"], "In-Progress")
        self.assertEqual(resp_data["appointment"]["eta"], "20 mins")

        # Step 5: Patient logs in and verifies receiving staff response and ETA
        self.client.post("/api/auth/logout")
        self.client.post("/api/auth/login", json={
            "email": "ram@demo.com",
            "password": "ram123"
        })
        pat_apps = self.client.get("/api/appointments")
        self.assertEqual(pat_apps.status_code, 200)
        found_app = next((a for a in pat_apps.get_json()["appointments"] if a["id"] == app_id), None)
        self.assertIsNotNone(found_app)
        self.assertEqual(found_app["status"], "In-Progress")
        self.assertEqual(found_app["eta"], "20 mins")
        self.assertEqual(found_app["staff_response"], "I have reviewed your medical notes and am heading to your home with the wound care kit.")
        self.assertEqual(found_app["professional_name"], target_staff_name)

        # Step 6: Staff starts visit and completes clinical care
        self.client.post("/api/auth/logout")
        self.client.post("/api/auth/login", json={
            "email": target_staff["email"],
            "password": "doctor123" if "dr." in target_staff["email"].lower() else "nurse123",
            "staff_pin": "2026"
        })
        start_res = self.client.post(f"/api/appointments/{app_id}/start-visit")
        self.assertEqual(start_res.status_code, 200)
        self.assertTrue(start_res.get_json()["success"])

        comp_res = self.client.post(f"/api/appointments/{app_id}/complete-service", json={
            "blood_pressure": "122/80",
            "pulse_rate": 74,
            "temperature": 98.4,
            "spo2": 99,
            "blood_sugar": 96.0,
            "respiration_rate": 16,
            "clinical_notes": "Wound dressing changed. Clean healing observed.",
            "treatment_given": "Antiseptic cleaning, sterile dressing.",
            "doctor_name": target_staff_name,
            "diagnosis": "Healing post-op incision",
            "medicines": [{"name": "Amoxicillin 500mg", "dosage": "1 tab", "frequency": "1-0-1", "duration": "3 days", "instructions": "After food"}]
        })
        self.assertEqual(comp_res.status_code, 200)
        self.assertTrue(comp_res.get_json()["success"])
        self.assertEqual(comp_res.get_json()["current_step"], 7)

    def test_public_exploration_and_protected_action_gates(self):
        """Test public endpoints allow unauthenticated discovery and protected endpoints require login."""
        # 1. Ensure logged out
        self.client.post("/api/auth/logout")

        # 2. Public exploration: Services, Doctors, and Reviews must be accessible without login
        svc_res = self.client.get("/api/services")
        self.assertEqual(svc_res.status_code, 200)
        svc_data = svc_res.get_json()
        self.assertTrue(svc_data["success"])
        self.assertGreater(len(svc_data["services"]), 0)

        docs_res = self.client.get("/api/public/doctors")
        self.assertEqual(docs_res.status_code, 200)
        docs_data = docs_res.get_json()
        self.assertTrue(docs_data["success"])
        self.assertGreater(len(docs_data["doctors"]), 0)
        # Verify doctor public fields
        doc = docs_data["doctors"][0]
        self.assertIn("name", doc)
        self.assertIn("specialization", doc)
        self.assertIn("rating", doc)

        revs_res = self.client.get("/api/public/reviews")
        self.assertEqual(revs_res.status_code, 200)
        revs_data = revs_res.get_json()
        self.assertTrue(revs_data["success"])
        self.assertGreater(len(revs_data["reviews"]), 0)
        # Verify review public fields
        rev = revs_data["reviews"][0]
        self.assertIn("patient_display_name", rev)
        self.assertIn("rating", rev)

        # 3. Protected actions: Booking without login must be rejected (401)
        unauth_book = self.client.post("/api/appointments", json={
            "service_id": svc_data["services"][0]["id"],
            "appointment_date": "2026-10-15",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": "Lazimpat, Kathmandu",
            "symptoms": "Routine Checkup"
        })
        self.assertEqual(unauth_book.status_code, 401)

        # 4. Login as patient and verify booking succeeds through gate
        login_res = self.client.post("/api/auth/login", json={
            "email": "ram@demo.com",
            "password": "ram123"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.get_json()["success"])

        auth_book = self.client.post("/api/appointments", json={
            "service_id": svc_data["services"][0]["id"],
            "appointment_date": "2026-10-15",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": "Lazimpat, Kathmandu",
            "symptoms": "Routine Checkup"
        })
        self.assertEqual(auth_book.status_code, 200)
        self.assertTrue(auth_book.get_json()["success"])

        # 5. Logout returns user to guest state
        logout_res = self.client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)
        me_res = self.client.get("/api/auth/me")
        self.assertFalse(me_res.get_json()["success"])

    def test_all_staff_ratings_displayed_and_dynamic_feedback_fluctuation(self):
        """Verify rating number is available across all staff roles and dynamically increases/decreases upon feedback."""
        with app.app_context():
            init_db(force_reseed=True)

        # 1. Verify /api/public/doctors and /api/professionals returns numeric ratings & review counts for all staff roles
        doc_res = self.client.get("/api/public/doctors")
        self.assertEqual(doc_res.status_code, 200)
        docs = doc_res.get_json()["doctors"]
        self.assertGreater(len(docs), 0)
        roles_found = {d.get("role") for d in docs}
        self.assertIn("professional", roles_found)

        for d in docs:
            self.assertIn("rating", d)
            self.assertIsInstance(d["rating"], (int, float))
            self.assertGreaterEqual(d["rating"], 1.0)
            self.assertLessEqual(d["rating"], 5.0)
            self.assertIn("review_count", d)
            self.assertGreaterEqual(d["review_count"], 4)

        # 2. Authenticate as admin and verify all staff demo switches return rating and review count
        login_adm0 = self.client.post("/api/auth/login", json={"email": "sandeep@demo.com", "password": "admin123", "staff_pin": "2026"})
        self.assertEqual(login_adm0.status_code, 200)

        for role_key in ["nurse", "doctor", "therapist", "pharmacist"]:
            sw_res = self.client.post("/api/auth/demo-switch", json={"role": role_key})
            self.assertEqual(sw_res.status_code, 200)
            user_data = sw_res.get_json()["user"]
            self.assertIn("rating", user_data)
            self.assertIsInstance(user_data["rating"], (int, float))
            self.assertIn("review_count", user_data)

        # 3. Create appointment as patient Ram
        login_pat = self.client.post("/api/auth/login", json={"email": "ram@demo.com", "password": "ram123"})
        self.assertEqual(login_pat.status_code, 200)

        book_res = self.client.post("/api/appointments", json={
            "service_id": 1,
            "appointment_date": "2026-10-25",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": "Baluwatar, Kathmandu",
            "symptoms": "Post-surgery wound dressing"
        })
        self.assertEqual(book_res.status_code, 200)
        app_id = book_res.get_json()["appointment_id"]

        # 4. Admin assigns Nurse Rama (id=4, initial baseline rating 4.95)
        login_adm = self.client.post("/api/auth/login", json={"email": "sandeep@demo.com", "password": "admin123", "staff_pin": "2026"})
        self.assertEqual(login_adm.status_code, 200)

        assign_res = self.client.post(f"/api/appointments/{app_id}/assign", json={"professional_id": 4})
        self.assertEqual(assign_res.status_code, 200)

        # 5. Patient logs in and submits a 1-star review (ghatna paryo)
        login_pat2 = self.client.post("/api/auth/login", json={"email": "ram@demo.com", "password": "ram123"})
        self.assertEqual(login_pat2.status_code, 200)

        fb_res_low = self.client.post(f"/api/appointments/{app_id}/feedback", json={
            "rating": 1,
            "tags": "Delayed",
            "comments": "Arrived later than expected",
            "is_satisfied": False,
            "professional_id": 4
        })
        self.assertEqual(fb_res_low.status_code, 200)
        fb_data_low = fb_res_low.get_json()
        self.assertTrue(fb_data_low["success"])
        new_rating_low = fb_data_low["professional_rating"]
        self.assertLess(new_rating_low, 4.95, f"Rating should decrease after 1-star feedback, got {new_rating_low}")
        self.assertEqual(fb_data_low["review_count"], 5)
        self.assertIn("Rama's clinical rating is now", fb_data_low["message"])

        # 6. Verify public directory immediately reflects the decreased rating
        doc_res2 = self.client.get("/api/public/doctors")
        nurse_rama = next(d for d in doc_res2.get_json()["doctors"] if d["id"] == 4)
        self.assertEqual(nurse_rama["rating"], new_rating_low)
        self.assertEqual(nurse_rama["review_count"], 5)

        # 7. Create second appointment and submit 5-star review (badhna paryo)
        book_res2 = self.client.post("/api/appointments", json={
            "service_id": 2,
            "appointment_date": "2026-10-26",
            "time_slot": "02:00 PM - 03:00 PM",
            "address": "Baluwatar, Kathmandu",
            "symptoms": "Doctor consultation"
        })
        app_id2 = book_res2.get_json()["appointment_id"]

        # Admin assigns Dr. Binod (id=3, initial baseline 4.98)
        self.client.post("/api/auth/login", json={"email": "sandeep@demo.com", "password": "admin123", "staff_pin": "2026"})
        self.client.post(f"/api/appointments/{app_id2}/assign", json={"professional_id": 3})

        # Patient submits 5-star review
        self.client.post("/api/auth/login", json={"email": "ram@demo.com", "password": "ram123"})
        fb_res_high = self.client.post(f"/api/appointments/{app_id2}/feedback", json={
            "rating": 5,
            "tags": "Highly Skilled, Clear Explanations",
            "comments": "Excellent diagnostic and bedside manner!",
            "is_satisfied": True,
            "professional_id": 3
        })
        self.assertEqual(fb_res_high.status_code, 200)
        fb_data_high = fb_res_high.get_json()
        self.assertTrue(fb_data_high["success"])
        self.assertGreaterEqual(fb_data_high["professional_rating"], 4.98)
        self.assertEqual(fb_data_high["review_count"], 6)

    def test_banke_nepalgunj_appointment_location_coordinates(self):
        """Verify appointment booking stores and returns Banke Nepalgunj GPS coordinates."""
        with app.app_context():
            init_db(force_reseed=True)

        # Login as patient Ram
        login = self.client.post("/api/auth/login", json={"email": "ram@demo.com", "password": "ram123"})
        self.assertTrue(login.get_json()["success"])

        # Book appointment with Banke Nepalgunj coordinates
        nepalgunj_lat = 28.0560
        nepalgunj_lng = 81.6210
        nepalgunj_addr = "Dhamboji Chowk, Nepalgunj-2, Banke"

        book_res = self.client.post("/api/appointments", json={
            "service_id": 1,
            "appointment_date": "2026-10-30",
            "time_slot": "10:00 AM - 11:00 AM",
            "address": nepalgunj_addr,
            "latitude": nepalgunj_lat,
            "longitude": nepalgunj_lng,
            "symptoms": "Home BP checkup in Nepalgunj"
        })
        self.assertEqual(book_res.status_code, 200)
        book_data = book_res.get_json()
        self.assertTrue(book_data["success"])
        app_id = book_data["appointment_id"]

        # Fetch appointment details
        detail_res = self.client.get(f"/api/appointments/{app_id}")
        self.assertEqual(detail_res.status_code, 200)
        appt = detail_res.get_json()["appointment"]
        self.assertEqual(appt["address"], nepalgunj_addr)
        self.assertAlmostEqual(appt["latitude"], nepalgunj_lat, places=4)
        self.assertAlmostEqual(appt["longitude"], nepalgunj_lng, places=4)

if __name__ == "__main__":
    unittest.main()


