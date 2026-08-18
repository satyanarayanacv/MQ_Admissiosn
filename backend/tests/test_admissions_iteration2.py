import os
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")


def test_admissions_regressions():
    base = BASE_URL.rstrip("/")
    s = requests.Session()
    created = "APP-ITER2-API"
    r = s.post(f"{base}/api/applicants", json={"application_no": created, "first_name": "TEST", "course": "Verification"})
    assert r.status_code in (200, 409)
    if r.status_code == 200:
        assert "_id" not in r.json()
    assert s.get(f"{base}/api/dashboard").status_code == 200
    assert s.get(f"{base}/api/applicants", params={"q": "Aarav"}).status_code == 200
    assert s.patch(f"{base}/api/applicants/APP-26041/documents", json={"document": "Not real", "received": True}).status_code == 400
    assert s.post(f"{base}/api/applicants/APP-26041/payments", json={"amount": 999999, "mode": "UPI"}).status_code == 400