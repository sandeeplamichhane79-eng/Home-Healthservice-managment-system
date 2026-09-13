"""
End-to-End Automated Workflow Verification Test
Tests all 9 steps of the Home Healthcare Management System lifecycle.
"""

import unittest
import json
import io
import uuid
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

    def test_step2_to_step9_complete_lifecycle(self):
        """Steps 2 to 9: Complete End-to-End Workflow Lifecycle"""

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

if __name__ == "__main__":
    unittest.main()
