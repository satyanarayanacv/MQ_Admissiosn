from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Annotated, Any, Optional
import logging
import os

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Admissions Management API")
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "720"))
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

STAGES = ["New", "Documents", "Under review", "Admitted"]
DOCUMENTS = ["Identity proof", "Mark sheets", "Transfer certificate", "Fee receipt"]


class Role(str, Enum):
    admin = "admin"
    reviewer = "reviewer"
    lecturer = "lecturer"
    office = "office"


# ------------------------------------------------------------------ models
class ApplicantCreate(BaseModel):
    application_no: str = Field(min_length=2)
    first_name: str = Field(min_length=1)
    last_name: str = ""
    course: str = ""
    academic_year: str = "2026-27"
    email: str = ""
    mobile: str = ""
    quota: str = "CQ"
    phase: Optional[int] = None
    total_fee: float = 0


class StageUpdate(BaseModel):
    stage: str


class DocumentUpdate(BaseModel):
    document: str
    received: bool


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    mode: str = "UPI"


class CourseCreate(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    department: str = ""
    seats: int = Field(default=60, ge=0)
    fee: float = Field(default=0, ge=0)
    academic_year: str = "2026-27"


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    seats: Optional[int] = None
    fee: Optional[float] = None
    academic_year: Optional[str] = None


class PublicUser(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: Role
    disabled: bool = False


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    role: Role = Role.office


# ------------------------------------------------------------------ helpers
def clean(doc: dict[str, Any]) -> dict[str, Any]:
    doc.pop("_id", None)
    return doc


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def public_user(doc: dict) -> PublicUser:
    return PublicUser(
        id=str(doc["_id"]),
        username=doc["username"],
        email=doc["email"],
        role=doc["role"],
        disabled=doc.get("disabled", False),
    )


def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["_id"]),
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


async def authenticate(login: str, password: str) -> Optional[dict]:
    login = login.strip().lower()
    doc = await db.users.find_one({"$or": [{"username": login}, {"email": login}]})
    if not doc or doc.get("disabled") or not verify_password(password, doc["password_hash"]):
        return None
    return doc


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    from bson import ObjectId

    error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise error
        doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except (jwt.InvalidTokenError, ValueError):
        raise error
    if not doc or doc.get("disabled"):
        raise error
    return doc


def require_roles(*allowed: Role):
    async def dependency(user: Annotated[dict, Depends(get_current_user)]):
        if user["role"] not in [r.value for r in allowed]:
            raise HTTPException(403, "You do not have permission for this action")
        return user

    return dependency


CurrentUser = Annotated[dict, Depends(get_current_user)]


# ------------------------------------------------------------------ seeding
async def seed_users() -> None:
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True)
    accounts = [
        (os.environ.get("ADMIN_USERNAME", "admin"), os.environ.get("ADMIN_EMAIL", "admin@admissions.edu"), os.environ.get("ADMIN_PASSWORD", "Admin@123456"), Role.admin),
        ("reviewer", "reviewer@admissions.edu", "Review@123456", Role.reviewer),
        ("lecturer", "lecturer@admissions.edu", "Lecture@12345", Role.lecturer),
        ("office", "office@admissions.edu", "Office@123456", Role.office),
    ]
    for username, email, password, role in accounts:
        await db.users.update_one(
            {"$or": [{"username": username.lower()}, {"email": email.lower()}]},
            {"$setOnInsert": {
                "username": username.lower(),
                "email": email.lower(),
                "password_hash": hash_password(password),
                "role": role.value,
                "disabled": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )


async def seed_courses() -> None:
    if await db.courses.count_documents({}):
        return
    samples = [
        {"code": "BTCS", "name": "B.Tech Computer Science", "department": "Engineering", "seats": 120, "fee": 120000, "academic_year": "2026-27"},
        {"code": "BCOM", "name": "B.Com Finance", "department": "Commerce", "seats": 90, "fee": 95000, "academic_year": "2026-27"},
        {"code": "BBA", "name": "BBA Business Analytics", "department": "Management", "seats": 60, "fee": 108000, "academic_year": "2026-27"},
        {"code": "BAECO", "name": "B.A. Economics", "department": "Humanities", "seats": 60, "fee": 88000, "academic_year": "2026-27"},
    ]
    await db.courses.insert_many(samples)


async def seed_if_empty() -> None:
    if await db.applicants.count_documents({}):
        return
    now = datetime.now(timezone.utc).isoformat()
    samples = [
        {"application_no": "APP-26041", "first_name": "Aarav", "last_name": "Mehta", "course": "B.Tech Computer Science", "academic_year": "2026-27", "email": "aarav.mehta@example.com", "mobile": "+91 98765 43210", "quota": "CQ", "phase": 1, "stage": "Under review", "score": 86, "updated_at": now, "documents": {"Identity proof": True, "Mark sheets": True, "Transfer certificate": False, "Fee receipt": False}, "total_fee": 120000, "paid": 60000, "activity": ["Application submitted", "Identity proof verified", "Moved to Under review"]},
        {"application_no": "APP-26038", "first_name": "Ishita", "last_name": "Rao", "course": "B.Com Finance", "academic_year": "2026-27", "email": "ishita.rao@example.com", "mobile": "+91 98111 22334", "quota": "MQ", "phase": None, "stage": "Documents", "score": 74, "updated_at": now, "documents": {"Identity proof": True, "Mark sheets": False, "Transfer certificate": False, "Fee receipt": False}, "total_fee": 95000, "paid": 0, "activity": ["Application submitted", "Missing mark sheets"]},
        {"application_no": "APP-26035", "first_name": "Kabir", "last_name": "Shah", "course": "BBA Business Analytics", "academic_year": "2026-27", "email": "kabir.shah@example.com", "mobile": "+91 90001 11990", "quota": "CQ", "phase": 2, "stage": "Admitted", "score": 92, "updated_at": now, "documents": {"Identity proof": True, "Mark sheets": True, "Transfer certificate": True, "Fee receipt": True}, "total_fee": 108000, "paid": 108000, "activity": ["Application submitted", "Admitted to Phase-II"]},
        {"application_no": "APP-26029", "first_name": "Naina", "last_name": "Joseph", "course": "B.A. Economics", "academic_year": "2026-27", "email": "naina.joseph@example.com", "mobile": "+91 98888 77665", "quota": "CQ", "phase": 3, "stage": "New", "score": 0, "updated_at": now, "documents": {"Identity proof": False, "Mark sheets": False, "Transfer certificate": False, "Fee receipt": False}, "total_fee": 88000, "paid": 0, "activity": ["Application created"]},
    ]
    await db.applicants.insert_many(samples)


@app.on_event("startup")
async def _startup():
    await seed_users()
    await seed_courses()
    await seed_if_empty()


# ------------------------------------------------------------------ auth routes
@api.post("/auth/login", response_model=Token)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = await authenticate(form.username, form.password)
    if not user:
        raise HTTPException(401, "Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    return Token(access_token=create_access_token(user), user=public_user(user))


@api.get("/auth/me", response_model=PublicUser)
async def me(user: CurrentUser):
    return public_user(user)


# ------------------------------------------------------------------ staff routes (admin)
@api.get("/staff")
async def list_staff(_: Annotated[dict, Depends(require_roles(Role.admin))]):
    docs = await db.users.find({}, {"password_hash": 0}).sort("created_at", 1).to_list(200)
    return [public_user(d).model_dump() for d in docs]


@api.post("/staff", status_code=201)
async def create_staff(body: UserCreate, _: Annotated[dict, Depends(require_roles(Role.admin))]):
    doc = {
        "username": body.username.lower(),
        "email": str(body.email).lower(),
        "password_hash": hash_password(body.password),
        "role": body.role.value,
        "disabled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Username or email already exists")
    doc["_id"] = result.inserted_id
    return public_user(doc).model_dump()


@api.delete("/staff/{username}")
async def delete_staff(username: str, admin: Annotated[dict, Depends(require_roles(Role.admin))]):
    if username.lower() == admin["username"]:
        raise HTTPException(400, "You cannot remove your own account")
    result = await db.users.delete_one({"username": username.lower()})
    if not result.deleted_count:
        raise HTTPException(404, "Staff member not found")
    return {"ok": True}


# ------------------------------------------------------------------ course routes
@api.get("/courses")
async def list_courses(_: CurrentUser):
    return await db.courses.find({}, {"_id": 0}).sort("code", 1).to_list(200)


@api.post("/courses", status_code=201)
async def create_course(body: CourseCreate, _: Annotated[dict, Depends(require_roles(Role.admin))]):
    if await db.courses.find_one({"code": body.code.upper()}):
        raise HTTPException(409, "Course code already exists")
    item = body.model_dump()
    item["code"] = item["code"].upper()
    await db.courses.insert_one(item)
    return clean(item)


@api.patch("/courses/{code}")
async def update_course(code: str, body: CourseUpdate, _: Annotated[dict, Depends(require_roles(Role.admin))]):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(400, "Nothing to update")
    result = await db.courses.find_one_and_update({"code": code.upper()}, {"$set": changes}, return_document=ReturnDocument.AFTER)
    if not result:
        raise HTTPException(404, "Course not found")
    return clean(result)


@api.delete("/courses/{code}")
async def delete_course(code: str, _: Annotated[dict, Depends(require_roles(Role.admin))]):
    result = await db.courses.delete_one({"code": code.upper()})
    if not result.deleted_count:
        raise HTTPException(404, "Course not found")
    return {"ok": True}


# ------------------------------------------------------------------ dashboard + applicants
@api.get("/dashboard")
async def dashboard(_: CurrentUser):
    docs = await db.applicants.find({}, {"_id": 0}).to_list(500)
    docs_pending = sum(not all(x["documents"].values()) for x in docs)
    return {
        "total": len(docs),
        "admitted": sum(x["stage"] == "Admitted" for x in docs),
        "under_review": sum(x["stage"] == "Under review" for x in docs),
        "documents_pending": docs_pending,
        "fees_collected": sum(x.get("paid", 0) for x in docs),
        "recent": sorted(docs, key=lambda x: x["updated_at"], reverse=True)[:4],
        "alerts": [{"title": "Documents need attention", "detail": f"{docs_pending} applications have missing documents.", "tone": "ochre"}],
    }


@api.get("/applicants")
async def applicants(_: CurrentUser, q: str = Query(default=""), stage: str = Query(default=""), quota: str = Query(default="")):
    query: dict[str, Any] = {}
    if stage:
        query["stage"] = stage
    if quota:
        query["quota"] = quota
    rows = await db.applicants.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    if q:
        term = q.lower()
        rows = [x for x in rows if term in f"{x['first_name']} {x['last_name']} {x['application_no']} {x['course']}".lower()]
    return rows


@api.post("/applicants")
async def create_applicant(payload: ApplicantCreate, _: Annotated[dict, Depends(require_roles(Role.admin, Role.office))]):
    if await db.applicants.find_one({"application_no": payload.application_no}):
        raise HTTPException(409, "Application number already exists")
    item = payload.model_dump() | {
        "stage": "New",
        "score": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "documents": {"Identity proof": False, "Mark sheets": False, "Transfer certificate": False, "Fee receipt": False},
        "paid": 0,
        "activity": ["Application created"],
    }
    await db.applicants.insert_one(item)
    return clean(item)


@api.patch("/applicants/{application_no}/stage")
async def update_stage(application_no: str, payload: StageUpdate, _: Annotated[dict, Depends(require_roles(Role.admin, Role.reviewer, Role.lecturer))]):
    if payload.stage not in STAGES:
        raise HTTPException(400, "Invalid stage")
    result = await db.applicants.find_one_and_update(
        {"application_no": application_no},
        {"$set": {"stage": payload.stage, "updated_at": datetime.now(timezone.utc).isoformat()}, "$push": {"activity": f"Moved to {payload.stage}"}},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(404, "Applicant not found")
    return clean(result)


@api.patch("/applicants/{application_no}/documents")
async def update_document(application_no: str, payload: DocumentUpdate, _: Annotated[dict, Depends(require_roles(Role.admin, Role.reviewer, Role.lecturer, Role.office))]):
    if payload.document not in DOCUMENTS:
        raise HTTPException(400, "Invalid document name")
    result = await db.applicants.find_one_and_update(
        {"application_no": application_no},
        {"$set": {f"documents.{payload.document}": payload.received, "updated_at": datetime.now(timezone.utc).isoformat()},
         "$push": {"activity": f"{payload.document} marked {'received' if payload.received else 'missing'}"}},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(404, "Applicant not found")
    return clean(result)


@api.post("/applicants/{application_no}/payments")
async def add_payment(application_no: str, payload: PaymentCreate, _: Annotated[dict, Depends(require_roles(Role.admin, Role.office))]):
    current = await db.applicants.find_one({"application_no": application_no}, {"_id": 0, "paid": 1, "total_fee": 1})
    if not current:
        raise HTTPException(404, "Applicant not found")
    if current.get("total_fee", 0) and current.get("paid", 0) + payload.amount > current["total_fee"]:
        raise HTTPException(400, "Payment exceeds the remaining fee balance")
    result = await db.applicants.find_one_and_update(
        {"application_no": application_no},
        {"$inc": {"paid": payload.amount}, "$push": {"activity": f"Payment received · ₹{payload.amount:,.0f} ({payload.mode})"}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(404, "Applicant not found")
    return clean(result)


# ------------------------------------------------------------------ reports
@api.get("/reports")
async def reports(_: CurrentUser):
    docs = await db.applicants.find({}, {"_id": 0}).to_list(1000)
    total = len(docs)
    by_stage = {s: sum(x["stage"] == s for x in docs) for s in STAGES}
    quotas = sorted({x.get("quota", "CQ") for x in docs})
    by_quota = {qk: sum(x.get("quota", "CQ") == qk for x in docs) for qk in quotas}

    course_map: dict[str, dict] = {}
    for x in docs:
        c = x.get("course") or "Unassigned"
        entry = course_map.setdefault(c, {"course": c, "applicants": 0, "admitted": 0, "expected": 0, "collected": 0})
        entry["applicants"] += 1
        entry["admitted"] += 1 if x["stage"] == "Admitted" else 0
        entry["expected"] += x.get("total_fee", 0)
        entry["collected"] += x.get("paid", 0)
    by_course = sorted(course_map.values(), key=lambda e: e["applicants"], reverse=True)

    expected = sum(x.get("total_fee", 0) for x in docs)
    collected = sum(x.get("paid", 0) for x in docs)
    fees = {"expected": expected, "collected": collected, "outstanding": max(0, expected - collected), "collection_rate": round((collected / expected * 100) if expected else 0, 1)}

    lines = [
        "ADMISSIONS SUMMARY · 2026-27",
        f"Total applications: {total}",
        f"Admitted: {by_stage['Admitted']} · Under review: {by_stage['Under review']} · Documents: {by_stage['Documents']} · New: {by_stage['New']}",
        f"Fees collected: ₹{collected:,.0f} of ₹{expected:,.0f} ({fees['collection_rate']}%)",
        f"Outstanding: ₹{fees['outstanding']:,.0f}",
        "",
        "By course:",
    ]
    for e in by_course:
        lines.append(f"  {e['course']} — {e['applicants']} applied, {e['admitted']} admitted, ₹{e['collected']:,.0f} collected")
    share_text = "\n".join(lines)

    return {"total": total, "by_stage": by_stage, "by_quota": by_quota, "by_course": by_course, "fees": fees, "share_text": share_text}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
