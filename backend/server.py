"""ShiftPe backend - matching students with shop owners."""
from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import random
import httpx
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("shiftpe")

# ---------------- Utility ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def ensure_tz(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

# ---------------- Models ----------------
class GoogleSessionIn(BaseModel):
    session_id: str

class PhoneSendOtpIn(BaseModel):
    phone: str

class PhoneVerifyOtpIn(BaseModel):
    phone: str
    code: str

class ProfileSetupIn(BaseModel):
    role: str  # "student" | "shop_owner"
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = ""
    photo_base64: Optional[str] = None  # base64 image; if None we use Unsplash fallback
    # student fields
    qualification: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = []
    available_hours: Optional[str] = None
    expected_pay: Optional[int] = None
    # shop owner fields
    shop_name: Optional[str] = None
    help_needed: Optional[str] = None
    duration: Optional[str] = None
    no_of_days: Optional[str] = None
    pay_offered: Optional[int] = None
    required_gender: Optional[str] = "any"
    required_qualification: Optional[str] = None
    required_experience: Optional[str] = None
    message: Optional[str] = ""

class SwipeIn(BaseModel):
    target_user_id: str
    direction: str  # "like" | "pass"

class MessageIn(BaseModel):
    text: str

class BioSuggestIn(BaseModel):
    role: str
    name: Optional[str] = ""
    skills: Optional[List[str]] = []
    help_needed: Optional[str] = ""
    qualification: Optional[str] = ""

# ---------------- Auth helpers ----------------
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires = ensure_tz(session.get("expires_at"))
    if expires and expires < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def upsert_user(email: Optional[str], phone: Optional[str], name: str, picture: Optional[str]) -> Dict[str, Any]:
    query = {}
    if email:
        query["email"] = email
    elif phone:
        query["phone"] = phone
    user = await db.users.find_one(query, {"_id": 0}) if query else None
    if user:
        return user
    user = {
        "user_id": make_id("u"),
        "email": email,
        "phone": phone,
        "name": name,
        "picture": picture,
        "role": None,
        "has_profile": False,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user.copy())
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

async def create_session_for_user(user_id: str, token: Optional[str] = None) -> str:
    token = token or f"st_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return token

# ---------------- Auth endpoints ----------------
@api_router.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn):
    """Verify Emergent session_id and create our own session."""
    async with httpx.AsyncClient(timeout=20.0) as h:
        r = await h.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    user = await upsert_user(email=data.get("email"), phone=None, name=data.get("name") or "User", picture=data.get("picture"))
    token = await create_session_for_user(user["user_id"], token=data.get("session_token"))
    return {"token": token, "user": user}

# Mocked OTP store
@api_router.post("/auth/phone/send-otp")
async def phone_send_otp(payload: PhoneSendOtpIn):
    # MOCKED: always returns success. Magic OTP is 123456.
    await db.phone_otps.update_one(
        {"phone": payload.phone},
        {"$set": {"phone": payload.phone, "code": "123456", "created_at": now_utc()}},
        upsert=True,
    )
    return {"sent": True, "mock_code": "123456"}

@api_router.post("/auth/phone/verify-otp")
async def phone_verify_otp(payload: PhoneVerifyOtpIn):
    rec = await db.phone_otps.find_one({"phone": payload.phone}, {"_id": 0})
    if not rec or rec.get("code") != payload.code:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    user = await upsert_user(email=None, phone=payload.phone, name=f"User {payload.phone[-4:]}", picture=None)
    token = await create_session_for_user(user["user_id"])
    return {"token": token, "user": user}

@api_router.get("/auth/me")
async def auth_me(user=None, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return {"user": user}

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# ---------------- Profile ----------------
@api_router.post("/profile/setup")
async def profile_setup(payload: ProfileSetupIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if payload.role not in ("student", "shop_owner"):
        raise HTTPException(status_code=400, detail="Invalid role")
    profile = {
        "user_id": user["user_id"],
        "role": payload.role,
        "name": payload.name,
        "age": payload.age,
        "gender": payload.gender,
        "city": payload.city,
        "bio": payload.bio or "",
        "photo_base64": payload.photo_base64,
        "qualification": payload.qualification,
        "experience": payload.experience,
        "skills": payload.skills or [],
        "available_hours": payload.available_hours,
        "expected_pay": payload.expected_pay,
        "shop_name": payload.shop_name,
        "help_needed": payload.help_needed,
        "duration": payload.duration,
        "no_of_days": payload.no_of_days,
        "pay_offered": payload.pay_offered,
        "required_gender": payload.required_gender or "any",
        "required_qualification": payload.required_qualification,
        "required_experience": payload.required_experience,
        "message": payload.message or "",
        "updated_at": now_utc(),
        # Use a fallback Unsplash image if user did not upload
        "photo_url": None if payload.photo_base64 else (
            "https://images.unsplash.com/photo-1667655861998-46fe4c29a4cf?w=600"
            if payload.role == "student"
            else "https://images.unsplash.com/photo-1599978395458-d4ce49ea5e56?w=600"
        ),
    }
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": profile}, upsert=True)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"role": payload.role, "has_profile": True, "name": payload.name, "picture": payload.photo_base64 or profile["photo_url"]}},
    )
    return {"ok": True, "profile": profile}

@api_router.get("/profile/me")
async def profile_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"profile": profile, "user": user}

# ---------------- Swipe deck ----------------
@api_router.get("/swipe/deck")
async def swipe_deck(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("has_profile"):
        raise HTTPException(status_code=400, detail="Setup your profile first")
    me_profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not me_profile:
        raise HTTPException(status_code=400, detail="Profile missing")

    opposite_role = "shop_owner" if user["role"] == "student" else "student"
    # Exclude profiles already swiped
    already = await db.swipes.find({"swiper_id": user["user_id"]}, {"_id": 0, "target_user_id": 1}).to_list(5000)
    excluded = {s["target_user_id"] for s in already}
    excluded.add(user["user_id"])
    cursor = db.profiles.find({"role": opposite_role, "user_id": {"$nin": list(excluded)}}, {"_id": 0}).limit(50)
    deck = await cursor.to_list(50)
    return {"deck": deck}

@api_router.post("/swipe")
async def post_swipe(payload: SwipeIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if payload.direction not in ("like", "pass"):
        raise HTTPException(status_code=400, detail="Invalid direction")
    target = await db.profiles.find_one({"user_id": payload.target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    swipe = {
        "swipe_id": make_id("sw"),
        "swiper_id": user["user_id"],
        "target_user_id": payload.target_user_id,
        "direction": payload.direction,
        "created_at": now_utc(),
    }
    await db.swipes.update_one(
        {"swiper_id": user["user_id"], "target_user_id": payload.target_user_id},
        {"$set": swipe},
        upsert=True,
    )

    matched = False
    match_doc = None
    if payload.direction == "like":
        reciprocal = await db.swipes.find_one({
            "swiper_id": payload.target_user_id,
            "target_user_id": user["user_id"],
            "direction": "like",
        }, {"_id": 0})
        if reciprocal:
            ids = sorted([user["user_id"], payload.target_user_id])
            existing = await db.matches.find_one({"user_ids": ids}, {"_id": 0})
            if existing:
                match_doc = existing
            else:
                match_doc = {
                    "match_id": make_id("m"),
                    "user_ids": ids,
                    "created_at": now_utc(),
                }
                await db.matches.insert_one(match_doc.copy())
                match_doc = await db.matches.find_one({"match_id": match_doc["match_id"]}, {"_id": 0})
            matched = True

    return {"ok": True, "matched": matched, "match": match_doc, "target_profile": target if matched else None}

# ---------------- Matches ----------------
@api_router.get("/matches")
async def get_matches(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    matches = await db.matches.find({"user_ids": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    enriched = []
    for m in matches:
        other_id = [u for u in m["user_ids"] if u != user["user_id"]][0]
        other = await db.profiles.find_one({"user_id": other_id}, {"_id": 0})
        last_msg = await db.messages.find_one({"match_id": m["match_id"]}, {"_id": 0}, sort=[("created_at", -1)])
        enriched.append({
            "match_id": m["match_id"],
            "created_at": m["created_at"],
            "other": other,
            "last_message": last_msg,
        })
    return {"matches": enriched}

@api_router.get("/matches/{match_id}")
async def get_match(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"match_id": match_id, "user_ids": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    other_id = [u for u in m["user_ids"] if u != user["user_id"]][0]
    other = await db.profiles.find_one({"user_id": other_id}, {"_id": 0})
    return {"match": m, "other": other}

# ---------------- Chat ----------------
@api_router.get("/chat/{match_id}/messages")
async def get_messages(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"match_id": match_id, "user_ids": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    msgs = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return {"messages": msgs}

@api_router.post("/chat/{match_id}/messages")
async def post_message(match_id: str, payload: MessageIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"match_id": match_id, "user_ids": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    msg = {
        "message_id": make_id("msg"),
        "match_id": match_id,
        "sender_id": user["user_id"],
        "text": payload.text,
        "created_at": now_utc(),
    }
    await db.messages.insert_one(msg.copy())
    msg = await db.messages.find_one({"message_id": msg["message_id"]}, {"_id": 0})
    # Push to websocket subscribers
    await ws_broadcast(match_id, {"type": "message", "message": _serialize(msg)})
    return {"message": msg}

# ---------------- WebSocket ----------------
ws_connections: Dict[str, List[WebSocket]] = {}

def _serialize(doc):
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

async def ws_broadcast(match_id: str, payload: Dict[str, Any]):
    conns = list(ws_connections.get(match_id, []))
    for ws in conns:
        try:
            await ws.send_json(payload)
        except Exception:
            try:
                ws_connections[match_id].remove(ws)
            except ValueError:
                pass

@app.websocket("/api/ws/chat/{match_id}")
async def websocket_chat(websocket: WebSocket, match_id: str, token: str = ""):
    # Validate session via query token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0}) if token else None
    if not session:
        await websocket.close(code=4401)
        return
    user_id = session["user_id"]
    match = await db.matches.find_one({"match_id": match_id, "user_ids": user_id}, {"_id": 0})
    if not match:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    ws_connections.setdefault(match_id, []).append(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            text = (data or {}).get("text", "").strip()
            if not text:
                continue
            msg = {
                "message_id": make_id("msg"),
                "match_id": match_id,
                "sender_id": user_id,
                "text": text,
                "created_at": now_utc(),
            }
            await db.messages.insert_one(msg.copy())
            msg = await db.messages.find_one({"message_id": msg["message_id"]}, {"_id": 0})
            await ws_broadcast(match_id, {"type": "message", "message": _serialize(msg)})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"ws error: {e}")
    finally:
        try:
            ws_connections.get(match_id, []).remove(websocket)
        except ValueError:
            pass

# ---------------- AI ----------------
@api_router.post("/ai/bio-suggestion")
async def ai_bio_suggestion(payload: BioSuggestIn, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI not configured")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        if payload.role == "student":
            sys_msg = "You write short, warm, authentic bios for a gig-work app called ShiftPe. Bios are for Indian students looking for part-time work. Keep it under 2 sentences, friendly, no emojis, no hashtags."
            prompt = f"Write a bio for {payload.name or 'a student'}. Skills: {', '.join(payload.skills or []) or 'general'}. Qualification: {payload.qualification or 'student'}. Make it sound real and approachable."
        else:
            sys_msg = "You write short, warm, authentic bios for a gig-work app called ShiftPe. Bios are for small shop owners in India who need part-time help. Keep it under 2 sentences, friendly, no emojis, no hashtags."
            prompt = f"Write a bio for a shop owner. Help needed: {payload.help_needed or 'shop assistance'}. Make it inviting to students."

        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=make_id("ai"), system_message=sys_msg).with_model("anthropic", "claude-sonnet-4-6")
        reply = await chat.send_message(UserMessage(text=prompt))
        return {"bio": str(reply).strip()}
    except Exception as e:
        logger.exception("AI bio error")
        raise HTTPException(status_code=500, detail=f"AI error: {e}")

@api_router.post("/ai/match-recommendations")
async def ai_match_recommendations(authorization: Optional[str] = Header(None)):
    """Re-rank current deck via AI to surface best matches first."""
    user = await get_current_user(authorization)
    me = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not me:
        raise HTTPException(status_code=400, detail="No profile")
    opposite_role = "shop_owner" if user["role"] == "student" else "student"
    already = await db.swipes.find({"swiper_id": user["user_id"]}, {"_id": 0, "target_user_id": 1}).to_list(5000)
    excluded = {s["target_user_id"] for s in already}
    excluded.add(user["user_id"])
    deck = await db.profiles.find({"role": opposite_role, "user_id": {"$nin": list(excluded)}}, {"_id": 0}).limit(20).to_list(20)
    if not deck or not EMERGENT_LLM_KEY:
        return {"deck": deck}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        if user["role"] == "student":
            me_summary = f"Student name: {me.get('name')}. Skills: {', '.join(me.get('skills') or [])}. Qualification: {me.get('qualification')}. Expected pay: ₹{me.get('expected_pay')}. City: {me.get('city')}."
        else:
            me_summary = f"Shop owner: {me.get('shop_name')}. Needs: {me.get('help_needed')}. Pay: ₹{me.get('pay_offered')}. Duration: {me.get('duration')}. City: {me.get('city')}."

        candidates_str = "\n".join([
            f"{i+1}. {p.get('name')} | {p.get('city')} | {p.get('skills') or p.get('help_needed')} | pay {p.get('expected_pay') or p.get('pay_offered')}"
            for i, p in enumerate(deck)
        ])
        sys_msg = "You rank job-match candidates. Reply ONLY with a comma-separated list of candidate numbers ranked best-to-worst. No explanation."
        prompt = f"Me: {me_summary}\n\nCandidates:\n{candidates_str}\n\nRank them."
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=make_id("ai"), system_message=sys_msg).with_model("anthropic", "claude-sonnet-4-6")
        reply = str(await chat.send_message(UserMessage(text=prompt))).strip()
        # Parse numbers
        order = []
        for tok in reply.replace("\n", ",").split(","):
            tok = tok.strip()
            if tok.isdigit():
                idx = int(tok) - 1
                if 0 <= idx < len(deck):
                    order.append(idx)
        used = set(order)
        for i in range(len(deck)):
            if i not in used:
                order.append(i)
        ranked = [deck[i] for i in order]
        return {"deck": ranked}
    except Exception as e:
        logger.warning(f"AI rank failed: {e}")
        return {"deck": deck}

# ---------------- Seed ----------------
SEED_STUDENTS = [
    {"name": "Aarav Sharma", "age": 21, "gender": "male", "city": "Bengaluru", "qualification": "B.Com", "skills": ["Cashier", "Inventory"], "available_hours": "3-4 hrs evening", "expected_pay": 200, "bio": "B.Com student looking for evening shifts. Reliable and quick learner.", "photo_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600"},
    {"name": "Priya Iyer", "age": 20, "gender": "female", "city": "Bengaluru", "qualification": "BBA", "skills": ["Customer service", "Billing"], "available_hours": "weekends", "expected_pay": 250, "bio": "Friendly BBA student, available on weekends, great with customers.", "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600"},
    {"name": "Rohan Kumar", "age": 22, "gender": "male", "city": "Bengaluru", "qualification": "B.Sc", "skills": ["Stocking", "Delivery"], "available_hours": "2-3 hrs morning", "expected_pay": 180, "bio": "Fit and energetic, can help with delivery and stocking.", "photo_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600"},
    {"name": "Sneha Reddy", "age": 19, "gender": "female", "city": "Hyderabad", "qualification": "BA English", "skills": ["Tutoring", "Counter sales"], "available_hours": "4-6pm", "expected_pay": 220, "bio": "Calm, organised, good with people. Open to retail or tutoring.", "photo_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600"},
    {"name": "Vikram Singh", "age": 23, "gender": "male", "city": "Delhi", "qualification": "Diploma", "skills": ["Electrical", "Repair"], "available_hours": "flexible", "expected_pay": 300, "bio": "Diploma in electrical. Can help with shop maintenance and repairs.", "photo_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600"},
    {"name": "Anjali Mehta", "age": 21, "gender": "female", "city": "Mumbai", "qualification": "B.Com", "skills": ["Accounting", "Billing"], "available_hours": "evening", "expected_pay": 280, "bio": "Good with numbers, can help with shop accounts and billing.", "photo_url": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600"},
]

SEED_SHOPS = [
    {"shop_name": "Sharma Provision Store", "name": "Ramesh Sharma", "age": 42, "gender": "male", "city": "Bengaluru", "help_needed": "Need a helper at the counter during evening rush", "duration": "3-4 hours", "no_of_days": "Mon-Sat", "pay_offered": 250, "required_gender": "any", "required_qualification": "10th pass", "required_experience": "none", "message": "Friendly shop, will train you on the billing software.", "bio": "Running this provision store for 15 years. Looking for reliable evening help.", "photo_url": "https://images.unsplash.com/photo-1599978395458-d4ce49ea5e56?w=600"},
    {"shop_name": "Lakshmi Tailors", "name": "Lakshmi Devi", "age": 38, "gender": "female", "city": "Bengaluru", "help_needed": "Assistant to take measurements and manage orders", "duration": "5-6 hours", "no_of_days": "3 days/week", "pay_offered": 350, "required_gender": "female", "required_qualification": "12th pass", "required_experience": "none", "message": "Calm environment, mostly women customers.", "bio": "Tailoring shop in Indiranagar. Need a polite assistant.", "photo_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600"},
    {"shop_name": "Chai Point Stall", "name": "Mohan Kumar", "age": 35, "gender": "male", "city": "Hyderabad", "help_needed": "Helper for morning chai rush 7-10am", "duration": "3 hours", "no_of_days": "Mon-Fri", "pay_offered": 200, "required_gender": "any", "required_qualification": "none", "required_experience": "none", "message": "Quick learning, free chai and breakfast!", "bio": "Small chai stall outside tech park. High footfall.", "photo_url": "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=600"},
    {"shop_name": "Bookworm Bookstore", "name": "Suresh Pillai", "age": 50, "gender": "male", "city": "Mumbai", "help_needed": "Someone to help with shelving and assisting customers", "duration": "4-5 hours", "no_of_days": "Weekends", "pay_offered": 300, "required_gender": "any", "required_qualification": "Graduate or pursuing", "required_experience": "none", "message": "Bookworms preferred! Quiet shop, lots of reading time.", "bio": "Indie bookstore near college. Calm and intellectual vibe.", "photo_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600"},
    {"shop_name": "Quick Bites Cafe", "name": "Neha Kapoor", "age": 32, "gender": "female", "city": "Delhi", "help_needed": "Counter staff during lunch rush", "duration": "3 hours", "no_of_days": "5 days/week", "pay_offered": 280, "required_gender": "any", "required_qualification": "any", "required_experience": "preferred but ok", "message": "Free meals during shift. Friendly team.", "bio": "Cafe near corporate offices. Fast-paced.", "photo_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600"},
    {"shop_name": "Florist Lane", "name": "Aditya Roy", "age": 29, "gender": "male", "city": "Bengaluru", "help_needed": "Help arranging flowers and customer service", "duration": "4 hours", "no_of_days": "Tue-Sun", "pay_offered": 270, "required_gender": "any", "required_qualification": "any", "required_experience": "none", "message": "Creative work, learn floral arrangement.", "bio": "Boutique flower shop. Beautiful workspace.", "photo_url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600"},
]

async def seed_data():
    count = await db.profiles.count_documents({})
    if count > 0:
        return
    logger.info("Seeding sample profiles...")
    for s in SEED_STUDENTS:
        uid = make_id("u")
        await db.users.insert_one({
            "user_id": uid, "email": None, "phone": None,
            "name": s["name"], "picture": s["photo_url"],
            "role": "student", "has_profile": True, "created_at": now_utc(),
        })
        await db.profiles.insert_one({
            "user_id": uid, "role": "student", **s,
            "skills": s.get("skills", []),
            "photo_base64": None,
            "experience": "fresher",
            "required_gender": "any",
            "shop_name": None, "help_needed": None, "duration": None, "no_of_days": None, "pay_offered": None,
            "message": "", "updated_at": now_utc(),
        })
    for s in SEED_SHOPS:
        uid = make_id("u")
        await db.users.insert_one({
            "user_id": uid, "email": None, "phone": None,
            "name": s["name"], "picture": s["photo_url"],
            "role": "shop_owner", "has_profile": True, "created_at": now_utc(),
        })
        await db.profiles.insert_one({
            "user_id": uid, "role": "shop_owner", **s,
            "skills": [], "qualification": None, "available_hours": None, "expected_pay": None,
            "experience": None,
            "photo_base64": None,
            "updated_at": now_utc(),
        })
    logger.info("Seeded %d students + %d shop owners", len(SEED_STUDENTS), len(SEED_SHOPS))

# ---------------- Misc ----------------
@api_router.get("/")
async def root():
    return {"app": "ShiftPe", "status": "ok"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_start():
    # Indexes
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=False, sparse=True)
    await db.users.create_index("phone", unique=False, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.profiles.create_index("user_id", unique=True)
    await db.swipes.create_index([("swiper_id", 1), ("target_user_id", 1)], unique=True)
    await db.matches.create_index("user_ids")
    await db.messages.create_index([("match_id", 1), ("created_at", 1)])
    await seed_data()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
