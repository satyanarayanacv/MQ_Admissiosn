"""Iteration 5: edit/delete applicants, CSV bulk import, document upload/download.

Tests go through the public Expo preview URL so we exercise what the mobile
client sees.  Reuses the seeded roles.
"""
import io
import os
import uuid

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL / EXPO_BACKEND_URL must be set"

CREDS = {
    "admin":    ("admin",    "Admin@123456"),
    "reviewer": ("reviewer", "Review@123456"),
    "lecturer": ("lecturer", "Lecture@12345"),
    "office":   ("office",   "Office@123456"),
}


def _login(u, p):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": u, "password": p},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tokens():
    return {role: _login(u, p) for role, (u, p) in CREDS.items()}


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- helpers to seed and clean per-class applicants
def _create_app(tokens, app_no, first="TEST", last="User"):
    r = requests.post(
        f"{BASE_URL}/api/applicants",
        headers=H(tokens["office"]),
        json={"application_no": app_no, "first_name": first, "last_name": last,
              "course": "B.Tech Computer Science", "total_fee": 10000, "quota": "CQ"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _delete_app(tokens, app_no):
    requests.delete(f"{BASE_URL}/api/applicants/{app_no}", headers=H(tokens["admin"]))


# =====================================================================
# PATCH /api/applicants/{application_no}
# =====================================================================
class TestEditApplicant:
    app_no = f"APP-TEST-EDIT-{uuid.uuid4().hex[:4].upper()}"

    @classmethod
    def teardown_class(cls):
        # best-effort cleanup - class scoped teardown gets fixtures via new session
        try:
            tok = _login(*CREDS["admin"])
            requests.delete(f"{BASE_URL}/api/applicants/{cls.app_no}", headers={"Authorization": f"Bearer {tok}"})
        except Exception:
            pass

    def test_setup_create(self, tokens):
        _create_app(tokens, self.app_no)

    def test_admin_edits_fields(self, tokens):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/{self.app_no}",
            headers=H(tokens["admin"]),
            json={"first_name": "TESTedit", "email": "TEST_edit@example.com",
                  "mobile": "9999900001", "quota": "MQ", "total_fee": 25000},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["first_name"] == "TESTedit"
        assert d["email"] == "TEST_edit@example.com"
        assert d["mobile"] == "9999900001"
        assert d["quota"] == "MQ"
        assert d["total_fee"] == 25000
        assert "_id" not in d
        # GET verify persistence
        g = requests.get(f"{BASE_URL}/api/applicants", headers=H(tokens["admin"])).json()
        row = next((x for x in g if x["application_no"] == self.app_no), None)
        assert row and row["first_name"] == "TESTedit" and row["quota"] == "MQ"

    def test_office_edits_course_and_last_name(self, tokens):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/{self.app_no}",
            headers=H(tokens["office"]),
            json={"course": "B.Com", "last_name": "OfficeEdit"},
        )
        assert r.status_code == 200
        assert r.json()["course"] == "B.Com"
        assert r.json()["last_name"] == "OfficeEdit"

    @pytest.mark.parametrize("role", ["reviewer", "lecturer"])
    def test_forbidden_roles(self, tokens, role):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/{self.app_no}",
            headers=H(tokens[role]),
            json={"first_name": "Nope"},
        )
        assert r.status_code == 403

    def test_empty_body_400(self, tokens):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/{self.app_no}",
            headers=H(tokens["admin"]),
            json={},
        )
        assert r.status_code == 400

    def test_unknown_applicant_404(self, tokens):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/APP-NOSUCH-999",
            headers=H(tokens["admin"]),
            json={"first_name": "X"},
        )
        assert r.status_code == 404


# =====================================================================
# DELETE /api/applicants/{application_no}
# =====================================================================
class TestDeleteApplicant:
    app_no = f"APP-TEST-DEL-{uuid.uuid4().hex[:4].upper()}"

    def test_setup(self, tokens):
        _create_app(tokens, self.app_no)

    @pytest.mark.parametrize("role", ["office", "reviewer", "lecturer"])
    def test_non_admin_forbidden(self, tokens, role):
        r = requests.delete(f"{BASE_URL}/api/applicants/{self.app_no}", headers=H(tokens[role]))
        assert r.status_code == 403

    def test_admin_deletes_and_gone(self, tokens):
        r = requests.delete(f"{BASE_URL}/api/applicants/{self.app_no}", headers=H(tokens["admin"]))
        assert r.status_code == 200 and r.json().get("ok") is True
        # verify actually removed
        g = requests.get(f"{BASE_URL}/api/applicants", headers=H(tokens["admin"])).json()
        assert not any(x["application_no"] == self.app_no for x in g)

    def test_delete_unknown_404(self, tokens):
        r = requests.delete(f"{BASE_URL}/api/applicants/APP-NOSUCH-DEL-9", headers=H(tokens["admin"]))
        assert r.status_code == 404


# =====================================================================
# POST /api/applicants/import
# =====================================================================
class TestImport:
    prefix = f"APP-TEST-IMP-{uuid.uuid4().hex[:4].upper()}"

    @classmethod
    def teardown_class(cls):
        try:
            tok = _login(*CREDS["admin"])
            h = {"Authorization": f"Bearer {tok}"}
            for i in (1, 2, 3):
                requests.delete(f"{BASE_URL}/api/applicants/{cls.prefix}-{i}", headers=h)
        except Exception:
            pass

    @pytest.mark.parametrize("role", ["office", "reviewer", "lecturer"])
    def test_non_admin_forbidden(self, tokens, role):
        r = requests.post(
            f"{BASE_URL}/api/applicants/import",
            headers=H(tokens[role]),
            json={"csv_text": "application_no,first_name\nX-1,X"},
        )
        assert r.status_code == 403

    def test_admin_imports_reports_and_persists(self, tokens):
        csv_text = (
            "application_no,first_name,last_name,course,email,mobile,quota,total_fee\n"
            f"{self.prefix}-1,Alice,Alpha,B.Com,alice@example.com,9990000001,CQ,10000\n"
            f"{self.prefix}-2,Bob,Beta,BBA,bob@example.com,9990000002,MQ,15000\n"
            ",Nomeans,X,,,,,\n"                          # missing app_no -> error
            f"{self.prefix}-3,,Nolast,,,,,\n"            # missing first_name -> error
        )
        r = requests.post(
            f"{BASE_URL}/api/applicants/import",
            headers=H(tokens["admin"]),
            json={"csv_text": csv_text},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 2
        assert data["skipped"] == 0
        assert len(data["errors"]) == 2
        # duplicate run -> skip
        r2 = requests.post(
            f"{BASE_URL}/api/applicants/import",
            headers=H(tokens["admin"]),
            json={"csv_text": csv_text},
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["created"] == 0 and d2["skipped"] == 2
        # verify listing
        g = requests.get(f"{BASE_URL}/api/applicants", headers=H(tokens["admin"])).json()
        found = {x["application_no"] for x in g if x["application_no"].startswith(self.prefix)}
        assert f"{self.prefix}-1" in found and f"{self.prefix}-2" in found


# =====================================================================
# Upload / Download documents
# =====================================================================
class TestDocumentUploadDownload:
    app_no = f"APP-TEST-DOC-{uuid.uuid4().hex[:4].upper()}"
    _stored = {}  # role -> filename for cleanup context

    @classmethod
    def teardown_class(cls):
        try:
            tok = _login(*CREDS["admin"])
            requests.delete(f"{BASE_URL}/api/applicants/{cls.app_no}", headers={"Authorization": f"Bearer {tok}"})
        except Exception:
            pass

    def test_setup(self, tokens):
        _create_app(tokens, self.app_no)

    @pytest.mark.parametrize("role,doc", [
        ("admin", "Identity proof"),
        ("office", "Mark sheets"),
        ("reviewer", "Transfer certificate"),
        ("lecturer", "Fee receipt"),
    ])
    def test_upload_allowed_all_roles(self, tokens, role, doc):
        payload = f"file-content-{role}-{uuid.uuid4().hex}".encode()
        files = {"file": (f"{role}.txt", io.BytesIO(payload), "text/plain")}
        data = {"document": doc}
        r = requests.post(
            f"{BASE_URL}/api/applicants/{self.app_no}/documents/upload",
            headers=H(tokens[role]),
            data=data,
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["documents"][doc] is True
        assert body["document_files"][doc]["name"] == f"{role}.txt"
        assert "path" in body["document_files"][doc]
        # download using token
        d = requests.get(f"{BASE_URL}/api/files/{self.app_no}/{doc}",
                         params={"token": tokens[role]}, timeout=60)
        assert d.status_code == 200, d.text
        assert d.content == payload

    def test_invalid_document_name_400(self, tokens):
        r = requests.post(
            f"{BASE_URL}/api/applicants/{self.app_no}/documents/upload",
            headers=H(tokens["admin"]),
            data={"document": "Not A Real Doc"},
            files={"file": ("x.txt", io.BytesIO(b"x"), "text/plain")},
        )
        assert r.status_code == 400

    def test_unknown_applicant_404(self, tokens):
        r = requests.post(
            f"{BASE_URL}/api/applicants/APP-NOSUCH-UP/documents/upload",
            headers=H(tokens["admin"]),
            data={"document": "Identity proof"},
            files={"file": ("x.txt", io.BytesIO(b"x"), "text/plain")},
        )
        assert r.status_code == 404

    def test_download_missing_token_401(self):
        r = requests.get(f"{BASE_URL}/api/files/{self.app_no}/Identity proof")
        assert r.status_code == 401

    def test_download_bad_token_401(self):
        r = requests.get(f"{BASE_URL}/api/files/{self.app_no}/Identity proof",
                         params={"token": "not-a-jwt"})
        assert r.status_code == 401

    def test_download_no_file_for_doc_404(self, tokens):
        # create a fresh applicant so no file exists
        fresh = f"APP-TEST-NOFILE-{uuid.uuid4().hex[:4].upper()}"
        _create_app(tokens, fresh)
        try:
            r = requests.get(f"{BASE_URL}/api/files/{fresh}/Identity proof",
                             params={"token": tokens["admin"]})
            assert r.status_code == 404
        finally:
            _delete_app(tokens, fresh)


# =====================================================================
# Regression sanity - existing endpoints still respond
# =====================================================================
class TestRegression:
    def test_dashboard(self, tokens):
        assert requests.get(f"{BASE_URL}/api/dashboard", headers=H(tokens["admin"])).status_code == 200

    def test_applicants_list_and_filter(self, tokens):
        r = requests.get(f"{BASE_URL}/api/applicants", headers=H(tokens["admin"]),
                         params={"stage": "Admitted"})
        assert r.status_code == 200
        assert all(x["stage"] == "Admitted" for x in r.json())

    def test_courses_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/courses", headers=H(tokens["office"]))
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_staff_list_admin(self, tokens):
        r = requests.get(f"{BASE_URL}/api/staff", headers=H(tokens["admin"]))
        assert r.status_code == 200 and len(r.json()) >= 4

    def test_reports(self, tokens):
        r = requests.get(f"{BASE_URL}/api/reports", headers=H(tokens["lecturer"]))
        assert r.status_code == 200
        assert "share_text" in r.json()
