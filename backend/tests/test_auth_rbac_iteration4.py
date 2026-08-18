"""Iteration 4 regression: auth, RBAC, courses, staff, reports.

Covers the new JWT + role-based access control layer plus the pre-existing
applicant/dashboard/reports flows.  All requests go through the public
Expo preview URL so we test what the mobile client sees.
"""
import os
import time
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


def login(username: str, password: str) -> tuple[int, dict]:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    return r.status_code, body


@pytest.fixture(scope="session")
def tokens() -> dict[str, str]:
    out = {}
    for role, (u, p) in CREDS.items():
        code, body = login(u, p)
        assert code == 200, f"login {role} failed: {code} {body}"
        assert "access_token" in body and body.get("user", {}).get("role") == role
        out[role] = body["access_token"]
    return out


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------- auth
class TestAuth:
    def test_login_by_email(self):
        code, body = login("admin@admissions.edu", "Admin@123456")
        assert code == 200 and body["user"]["username"] == "admin"

    def test_login_bad_password(self):
        code, _ = login("admin", "wrong-pass")
        assert code == 401

    def test_me_without_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers("not-a-jwt"))
        assert r.status_code == 401

    def test_me_ok(self, tokens):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin" and d["username"] == "admin" and "id" in d


# ---------------------------------------------------------------- RBAC on staff & courses
class TestRBACAdminOnly:
    @pytest.mark.parametrize("role", ["reviewer", "lecturer", "office"])
    def test_staff_list_forbidden(self, tokens, role):
        r = requests.get(f"{BASE_URL}/api/staff", headers=headers(tokens[role]))
        assert r.status_code == 403

    @pytest.mark.parametrize("role", ["reviewer", "lecturer", "office"])
    def test_course_create_forbidden(self, tokens, role):
        r = requests.post(
            f"{BASE_URL}/api/courses",
            headers=headers(tokens[role]),
            json={"code": "XYZ", "name": "Blocked"},
        )
        assert r.status_code == 403

    @pytest.mark.parametrize("role", ["reviewer", "lecturer", "office"])
    def test_course_delete_forbidden(self, tokens, role):
        r = requests.delete(f"{BASE_URL}/api/courses/BTCS", headers=headers(tokens[role]))
        assert r.status_code == 403


class TestRBACWriteRoles:
    def test_reviewer_cannot_create_applicant(self, tokens):
        r = requests.post(
            f"{BASE_URL}/api/applicants",
            headers=headers(tokens["reviewer"]),
            json={"application_no": "APP-RBAC-1", "first_name": "X"},
        )
        assert r.status_code == 403

    def test_office_cannot_patch_stage(self, tokens):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/APP-26041/stage",
            headers=headers(tokens["office"]),
            json={"stage": "Under review"},
        )
        assert r.status_code == 403

    def test_reviewer_cannot_add_payment(self, tokens):
        r = requests.post(
            f"{BASE_URL}/api/applicants/APP-26041/payments",
            headers=headers(tokens["reviewer"]),
            json={"amount": 100, "mode": "UPI"},
        )
        assert r.status_code == 403

    def test_all_roles_can_patch_documents(self, tokens):
        for role in ("admin", "reviewer", "lecturer", "office"):
            r = requests.patch(
                f"{BASE_URL}/api/applicants/APP-26041/documents",
                headers=headers(tokens[role]),
                json={"document": "Identity proof", "received": True},
            )
            assert r.status_code == 200, f"{role} doc patch: {r.status_code} {r.text}"


# ---------------------------------------------------------------- reads (auth required)
class TestReads:
    def test_dashboard_needs_auth(self):
        assert requests.get(f"{BASE_URL}/api/dashboard").status_code == 401

    def test_dashboard_ok(self, tokens):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=headers(tokens["reviewer"]))
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "admitted", "under_review", "documents_pending", "fees_collected", "recent", "alerts"):
            assert k in d

    def test_applicants_filters(self, tokens):
        h = headers(tokens["admin"])
        assert requests.get(f"{BASE_URL}/api/applicants", headers=h).status_code == 200
        r = requests.get(f"{BASE_URL}/api/applicants", headers=h, params={"q": "Aarav"})
        assert r.status_code == 200 and any("Aarav" in x["first_name"] for x in r.json())
        r = requests.get(f"{BASE_URL}/api/applicants", headers=h, params={"stage": "Admitted"})
        assert all(x["stage"] == "Admitted" for x in r.json())
        r = requests.get(f"{BASE_URL}/api/applicants", headers=h, params={"quota": "MQ"})
        assert all(x["quota"] == "MQ" for x in r.json())

    def test_reports_shape(self, tokens):
        r = requests.get(f"{BASE_URL}/api/reports", headers=headers(tokens["lecturer"]))
        assert r.status_code == 200
        d = r.json()
        for k in ("by_stage", "by_quota", "by_course", "fees", "share_text"):
            assert k in d
        for k in ("expected", "collected", "outstanding", "collection_rate"):
            assert k in d["fees"]
        assert "ADMISSIONS SUMMARY" in d["share_text"]


# ---------------------------------------------------------------- courses CRUD
class TestCourses:
    code = f"TST{uuid.uuid4().hex[:4].upper()}"

    def test_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/courses", headers=headers(tokens["office"]))
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_create_conflict_and_patch_delete(self, tokens):
        h = headers(tokens["admin"])
        payload = {"code": self.code, "name": "TEST_Course", "department": "QA", "seats": 5, "fee": 1000}
        r = requests.post(f"{BASE_URL}/api/courses", headers=h, json=payload)
        assert r.status_code == 201, r.text
        # duplicate
        assert requests.post(f"{BASE_URL}/api/courses", headers=h, json=payload).status_code == 409
        # patch
        r = requests.patch(f"{BASE_URL}/api/courses/{self.code}", headers=h, json={"seats": 42})
        assert r.status_code == 200 and r.json()["seats"] == 42
        # GET-verify persistence
        listing = requests.get(f"{BASE_URL}/api/courses", headers=h).json()
        assert any(c["code"] == self.code and c["seats"] == 42 for c in listing)
        # delete
        assert requests.delete(f"{BASE_URL}/api/courses/{self.code}", headers=h).status_code == 200
        assert requests.delete(f"{BASE_URL}/api/courses/{self.code}", headers=h).status_code == 404


# ---------------------------------------------------------------- staff CRUD
class TestStaff:
    uname = f"tstaff{uuid.uuid4().hex[:6]}"

    def test_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/staff", headers=headers(tokens["admin"]))
        assert r.status_code == 200 and len(r.json()) >= 4

    def test_create_duplicate_and_delete(self, tokens):
        h = headers(tokens["admin"])
        body = {"username": self.uname, "email": f"{self.uname}@example.com", "password": "TmpPass1234", "role": "office"}
        r = requests.post(f"{BASE_URL}/api/staff", headers=h, json=body)
        assert r.status_code == 201, r.text
        assert requests.post(f"{BASE_URL}/api/staff", headers=h, json=body).status_code == 409
        # cannot delete self
        assert requests.delete(f"{BASE_URL}/api/staff/admin", headers=h).status_code == 400
        # delete created
        assert requests.delete(f"{BASE_URL}/api/staff/{self.uname}", headers=h).status_code == 200
        assert requests.delete(f"{BASE_URL}/api/staff/{self.uname}", headers=h).status_code == 404


# ---------------------------------------------------------------- applicant flow (create/patch/pay)
class TestApplicantFlow:
    app_no = f"APP-TEST-{uuid.uuid4().hex[:5].upper()}"

    def test_office_creates_applicant(self, tokens):
        r = requests.post(
            f"{BASE_URL}/api/applicants",
            headers=headers(tokens["office"]),
            json={"application_no": self.app_no, "first_name": "TEST", "last_name": "User",
                  "course": "B.Tech Computer Science", "total_fee": 10000, "quota": "CQ"},
        )
        assert r.status_code == 200, r.text
        assert "_id" not in r.json()
        assert requests.post(
            f"{BASE_URL}/api/applicants",
            headers=headers(tokens["office"]),
            json={"application_no": self.app_no, "first_name": "TEST"},
        ).status_code == 409

    def test_reviewer_patches_stage_and_office_pays(self, tokens):
        r = requests.patch(
            f"{BASE_URL}/api/applicants/{self.app_no}/stage",
            headers=headers(tokens["reviewer"]),
            json={"stage": "Under review"},
        )
        assert r.status_code == 200 and r.json()["stage"] == "Under review"
        # invalid stage
        assert requests.patch(
            f"{BASE_URL}/api/applicants/{self.app_no}/stage",
            headers=headers(tokens["reviewer"]),
            json={"stage": "Wrong"},
        ).status_code == 400
        # office payment
        r = requests.post(
            f"{BASE_URL}/api/applicants/{self.app_no}/payments",
            headers=headers(tokens["office"]),
            json={"amount": 1000, "mode": "UPI"},
        )
        assert r.status_code == 200 and r.json()["paid"] == 1000
        # overpayment blocked
        assert requests.post(
            f"{BASE_URL}/api/applicants/{self.app_no}/payments",
            headers=headers(tokens["office"]),
            json={"amount": 999999, "mode": "UPI"},
        ).status_code == 400
