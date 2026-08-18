from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import logging
import os
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Admissions Management API")
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

STAGES = ["New", "Documents", "Under review", "Admitted"]
DOCUMENTS = ["Identity proof", "Mark sheets", "Transfer certificate", "Fee receipt"]

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

class StageUpdate(BaseModel):
    stage: str

class DocumentUpdate(BaseModel):
    document: str
    received: bool

class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    mode: str = "UPI"

def clean(doc: dict[str, Any]) -> dict[str, Any]:
    doc.pop("_id", None)
    return doc

async def seed_if_empty() -> None:
    if await db.applicants.count_documents({}):
        return
    now = datetime.now(timezone.utc).isoformat()
    samples = [
        {"application_no":"APP-26041","first_name":"Aarav","last_name":"Mehta","course":"B.Tech Computer Science","academic_year":"2026-27","email":"aarav.mehta@example.com","mobile":"+91 98765 43210","quota":"CQ","phase":1,"stage":"Under review","score":86,"updated_at":now,"documents":{"Identity proof":True,"Mark sheets":True,"Transfer certificate":False,"Fee receipt":False},"total_fee":120000,"paid":60000,"activity":["Application submitted","Identity proof verified","Moved to Under review"]},
        {"application_no":"APP-26038","first_name":"Ishita","last_name":"Rao","course":"B.Com Finance","academic_year":"2026-27","email":"ishita.rao@example.com","mobile":"+91 98111 22334","quota":"MQ","phase":None,"stage":"Documents","score":74,"updated_at":now,"documents":{"Identity proof":True,"Mark sheets":False,"Transfer certificate":False,"Fee receipt":False},"total_fee":95000,"paid":0,"activity":["Application submitted","Missing mark sheets"]},
        {"application_no":"APP-26035","first_name":"Kabir","last_name":"Shah","course":"BBA Business Analytics","academic_year":"2026-27","email":"kabir.shah@example.com","mobile":"+91 90001 11990","quota":"CQ","phase":2,"stage":"Admitted","score":92,"updated_at":now,"documents":{"Identity proof":True,"Mark sheets":True,"Transfer certificate":True,"Fee receipt":True},"total_fee":108000,"paid":108000,"activity":["Application submitted","Admitted to Phase-II"]},
        {"application_no":"APP-26029","first_name":"Naina","last_name":"Joseph","course":"B.A. Economics","academic_year":"2026-27","email":"naina.joseph@example.com","mobile":"+91 98888 77665","quota":"CQ","phase":3,"stage":"New","score":0,"updated_at":now,"documents":{"Identity proof":False,"Mark sheets":False,"Transfer certificate":False,"Fee receipt":False},"total_fee":88000,"paid":0,"activity":["Application created"]},
    ]
    await db.applicants.insert_many(samples)

@api.get("/")
async def root():
    return {"message": "Admissions Management API", "status": "ready"}

@api.get("/dashboard")
async def dashboard():
    await seed_if_empty()
    docs = await db.applicants.find({}, {"_id": 0}).to_list(500)
    return {"total": len(docs), "admitted": sum(x["stage"] == "Admitted" for x in docs), "under_review": sum(x["stage"] == "Under review" for x in docs), "documents_pending": sum(not all(x["documents"].values()) for x in docs), "fees_collected": sum(x.get("paid", 0) for x in docs), "recent": sorted(docs, key=lambda x: x["updated_at"], reverse=True)[:4], "alerts": [{"title": "Documents need attention", "detail": f"{sum(not all(x['documents'].values()) for x in docs)} applications have missing documents.", "tone": "ochre"}]}

@api.get("/applicants")
async def applicants(q: str = Query(default=""), stage: str = Query(default=""), quota: str = Query(default="")):
    await seed_if_empty()
    query: dict[str, Any] = {}
    if stage: query["stage"] = stage
    if quota: query["quota"] = quota
    rows = await db.applicants.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    if q:
        term = q.lower()
        rows = [x for x in rows if term in f"{x['first_name']} {x['last_name']} {x['application_no']} {x['course']}".lower()]
    return rows

@api.post("/applicants")
async def create_applicant(payload: ApplicantCreate):
    await seed_if_empty()
    if await db.applicants.find_one({"application_no": payload.application_no}):
        raise HTTPException(409, "Application number already exists")
    item = payload.model_dump() | {"stage": "New", "score": 0, "updated_at": datetime.now(timezone.utc).isoformat(), "documents": {"Identity proof": False, "Mark sheets": False, "Transfer certificate": False, "Fee receipt": False}, "total_fee": 0, "paid": 0, "activity": ["Application created"]}
    await db.applicants.insert_one(item)
    return clean(item)

@api.patch("/applicants/{application_no}/stage")
async def update_stage(application_no: str, payload: StageUpdate):
    if payload.stage not in STAGES: raise HTTPException(400, "Invalid stage")
    result = await db.applicants.find_one_and_update({"application_no": application_no}, {"$set": {"stage": payload.stage, "updated_at": datetime.now(timezone.utc).isoformat()}, "$push": {"activity": f"Moved to {payload.stage}"}}, return_document=ReturnDocument.AFTER)
    if not result: raise HTTPException(404, "Applicant not found")
    return clean(result)

@api.patch("/applicants/{application_no}/documents")
async def update_document(application_no: str, payload: DocumentUpdate):
    if payload.document not in DOCUMENTS:
        raise HTTPException(400, "Invalid document name")
    result = await db.applicants.find_one_and_update({"application_no": application_no}, {"$set": {f"documents.{payload.document}": payload.received, "updated_at": datetime.now(timezone.utc).isoformat()}}, return_document=ReturnDocument.AFTER)
    if not result: raise HTTPException(404, "Applicant not found")
    return clean(result)

@api.post("/applicants/{application_no}/payments")
async def add_payment(application_no: str, payload: PaymentCreate):
    current = await db.applicants.find_one({"application_no": application_no}, {"_id": 0, "paid": 1, "total_fee": 1})
    if not current: raise HTTPException(404, "Applicant not found")
    if current.get("total_fee", 0) and current.get("paid", 0) + payload.amount > current["total_fee"]:
        raise HTTPException(400, "Payment exceeds the remaining fee balance")
    result = await db.applicants.find_one_and_update({"application_no": application_no}, {"$inc": {"paid": payload.amount}, "$push": {"activity": f"Payment received · ₹{payload.amount:,.0f} ({payload.mode})"}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}, return_document=ReturnDocument.AFTER)
    if not result: raise HTTPException(404, "Applicant not found")
    return clean(result)

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()