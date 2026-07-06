from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import math
import asyncio
import httpx
import re
import unicodedata
from pathlib import Path
from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ATHENS_TZ = ZoneInfo("Europe/Athens")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
ENABLE_USAGE_METRICS = os.environ.get("ENABLE_USAGE_METRICS", "false").strip().lower() in {"1", "true", "yes", "on"}
GOOGLE_DAILY_BUDGET_CALLS = int(os.environ.get("GOOGLE_DAILY_BUDGET_CALLS", "500"))
GOOGLE_DAILY_BUDGET_EUR = float(os.environ.get("GOOGLE_DAILY_BUDGET_EUR", "1.0"))
ENABLE_LIVE_GOOGLE_PLACES = os.environ.get("ENABLE_LIVE_GOOGLE_PLACES", "false").strip().lower() in {"1", "true", "yes", "on"}
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


NEARBY_CACHE_TTL_SECONDS = 604800      # 7 days — shops rarely change
DETAIL_CACHE_TTL_SECONDS = 604800      # 7 days
AUTOCOMPLETE_CACHE_TTL_SECONDS = 86400 # 1 day
GEOCODE_CACHE_TTL_SECONDS = 2592000    # 30 days
PHOTO_CACHE_TTL_SECONDS = 2592000      # 30 days
PHOTO_DETAIL_LIMIT = 3

GOOGLE_CALL_METRICS = {
    "text_search": 0,
    "place_details": 0,
    "photo": 0,
    "autocomplete": 0,
    "geocode": 0,
}
GOOGLE_ESTIMATED_UNITS = {
    "text_search": 10,
    "place_details": 5,
    "photo": 2,
    "autocomplete": 1,
    "geocode": 1,
}
GOOGLE_ESTIMATED_EUR = {
    "text_search": 0.050,
    "place_details": 0.025,
    "photo": 0.007,
    "autocomplete": 0.003,
    "geocode": 0.002,
}
CACHE_METRICS = {
    "nearby": {"hits": 0, "misses": 0},
    "details": {"hits": 0, "misses": 0},
    "autocomplete": {"hits": 0, "misses": 0},
    "geocode": {"hits": 0, "misses": 0},
    "photo": {"hits": 0, "misses": 0},
}
BLOCKED_METRICS = {
    "total": 0,
    "calls_cap": 0,
    "eur_cap": 0,
    "by_endpoint": {
        "text_search": 0,
        "place_details": 0,
        "photo": 0,
        "autocomplete": 0,
        "geocode": 0,
    },
}
GOOGLE_USAGE_WINDOW = {"date": datetime.now(timezone.utc).date().isoformat(), "calls": 0, "spent_eur": 0.0}
ALERT_THRESHOLDS = (0.70, 0.85, 1.00)
ALERT_STATE = {"date": GOOGLE_USAGE_WINDOW["date"], "fired": set()}
PHOTO_RESPONSE_HEADERS = {"Cache-Control": f"public, max-age={PHOTO_CACHE_TTL_SECONDS}"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _cache_key(bucket: str, key: Tuple[Any, ...]) -> str:
    return bucket + "|" + "|".join("" if k is None else str(k) for k in key)


async def _cache_get(bucket: str, key: Tuple[Any, ...]):
    """Persistent MongoDB cache read (shared across users, survives restarts)."""
    entry = await db.api_cache.find_one({"_id": _cache_key(bucket, key)})
    if entry:
        exp = entry.get("expires_at")
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp is None or exp > _utcnow():
            CACHE_METRICS[bucket]["hits"] += 1
            return entry["value"]
    CACHE_METRICS[bucket]["misses"] += 1
    return None


async def _cache_put(bucket: str, key: Tuple[Any, ...], value: Any, ttl_seconds: int):
    cid = _cache_key(bucket, key)
    await db.api_cache.replace_one(
        {"_id": cid},
        {"_id": cid, "bucket": bucket, "value": value, "expires_at": _utcnow() + timedelta(seconds=ttl_seconds)},
        upsert=True,
    )


def _reset_usage_if_needed():
    current_date = _utcnow().date().isoformat()
    if GOOGLE_USAGE_WINDOW["date"] == current_date:
        return
    GOOGLE_USAGE_WINDOW["date"] = current_date
    GOOGLE_USAGE_WINDOW["calls"] = 0
    GOOGLE_USAGE_WINDOW["spent_eur"] = 0.0
    for metric in GOOGLE_CALL_METRICS:
        GOOGLE_CALL_METRICS[metric] = 0
    for metric in CACHE_METRICS.values():
        metric["hits"] = 0
        metric["misses"] = 0


def _record_google_call(metric: str):
    _reset_usage_if_needed()
    GOOGLE_USAGE_WINDOW["calls"] += 1
    GOOGLE_CALL_METRICS[metric] += 1
    GOOGLE_USAGE_WINDOW["spent_eur"] += GOOGLE_ESTIMATED_EUR[metric]
    _maybe_log_budget_alerts()
    # Persist so the daily cap survives backend restarts (best-effort, non-blocking).
    try:
        asyncio.get_running_loop().create_task(_persist_usage())
    except RuntimeError:
        pass


async def _persist_usage():
    try:
        await db.api_usage.replace_one(
            {"_id": "google_daily"},
            {"_id": "google_daily", "date": GOOGLE_USAGE_WINDOW["date"],
             "calls": GOOGLE_USAGE_WINDOW["calls"], "spent_eur": GOOGLE_USAGE_WINDOW["spent_eur"]},
            upsert=True,
        )
    except Exception:
        pass


async def _load_usage():
    """Restore today's usage counters from Mongo on startup so a restart can't reset the daily cap."""
    try:
        doc = await db.api_usage.find_one({"_id": "google_daily"})
        today = datetime.now(timezone.utc).date().isoformat()
        if doc and doc.get("date") == today:
            GOOGLE_USAGE_WINDOW["date"] = today
            GOOGLE_USAGE_WINDOW["calls"] = int(doc.get("calls", 0))
            GOOGLE_USAGE_WINDOW["spent_eur"] = float(doc.get("spent_eur", 0.0))
    except Exception:
        pass


def _maybe_log_budget_alerts():
    _reset_usage_if_needed()
    if ALERT_STATE["date"] != GOOGLE_USAGE_WINDOW["date"]:
        ALERT_STATE["date"] = GOOGLE_USAGE_WINDOW["date"]
        ALERT_STATE["fired"] = set()
    cap = max(GOOGLE_DAILY_BUDGET_EUR, 0.0001)
    usage_ratio = GOOGLE_USAGE_WINDOW["spent_eur"] / cap
    for threshold in ALERT_THRESHOLDS:
        key = int(threshold * 100)
        if usage_ratio >= threshold and key not in ALERT_STATE["fired"]:
            ALERT_STATE["fired"].add(key)
            logger.warning(
                "Google budget alert: %s%% reached (spent=%.3f EUR / cap=%.3f EUR, calls=%s)",
                key,
                GOOGLE_USAGE_WINDOW["spent_eur"],
                GOOGLE_DAILY_BUDGET_EUR,
                GOOGLE_USAGE_WINDOW["calls"],
            )


def _budget_reason(metric: Optional[str] = None) -> Optional[str]:
    _reset_usage_if_needed()
    if GOOGLE_USAGE_WINDOW["calls"] >= GOOGLE_DAILY_BUDGET_CALLS:
        return "calls_cap"
    if metric is None:
        return "eur_cap" if GOOGLE_USAGE_WINDOW["spent_eur"] >= GOOGLE_DAILY_BUDGET_EUR else None
    return "eur_cap" if (GOOGLE_USAGE_WINDOW["spent_eur"] + GOOGLE_ESTIMATED_EUR[metric]) > GOOGLE_DAILY_BUDGET_EUR else None


def _record_budget_block(metric: str, reason: str):
    BLOCKED_METRICS["total"] += 1
    if reason in ("calls_cap", "eur_cap"):
        BLOCKED_METRICS[reason] += 1
    if metric in BLOCKED_METRICS["by_endpoint"]:
        BLOCKED_METRICS["by_endpoint"][metric] += 1


def _google_budget_reached(metric: Optional[str] = None) -> bool:
    _reset_usage_if_needed()
    if GOOGLE_USAGE_WINDOW["calls"] >= GOOGLE_DAILY_BUDGET_CALLS:
        return True
    if metric is None:
        return GOOGLE_USAGE_WINDOW["spent_eur"] >= GOOGLE_DAILY_BUDGET_EUR
    return (GOOGLE_USAGE_WINDOW["spent_eur"] + GOOGLE_ESTIMATED_EUR[metric]) > GOOGLE_DAILY_BUDGET_EUR


def _budget_cap_detail(endpoint: str, metric: Optional[str] = None) -> str:
    projected = GOOGLE_USAGE_WINDOW["spent_eur"]
    if metric:
        projected += GOOGLE_ESTIMATED_EUR[metric]
    return (
        f"Google API budget cap reached for {endpoint} "
        f"(spent={GOOGLE_USAGE_WINDOW['spent_eur']:.3f} EUR, projected={projected:.3f} EUR, cap={GOOGLE_DAILY_BUDGET_EUR:.3f} EUR)"
    )


def _google_usage_payload() -> dict:
    _reset_usage_if_needed()
    estimated_units = {
        key: GOOGLE_CALL_METRICS[key] * GOOGLE_ESTIMATED_UNITS[key]
        for key in GOOGLE_CALL_METRICS
    }
    estimated_eur = {
        key: round(GOOGLE_CALL_METRICS[key] * GOOGLE_ESTIMATED_EUR[key], 4)
        for key in GOOGLE_CALL_METRICS
    }
    remaining_calls = max(0, GOOGLE_DAILY_BUDGET_CALLS - GOOGLE_USAGE_WINDOW["calls"])
    remaining_eur = max(0.0, GOOGLE_DAILY_BUDGET_EUR - GOOGLE_USAGE_WINDOW["spent_eur"])
    current_block_reason = _budget_reason(None)
    return {
        "enabled": ENABLE_USAGE_METRICS,
        "date": GOOGLE_USAGE_WINDOW["date"],
        "daily_budget_calls": GOOGLE_DAILY_BUDGET_CALLS,
        "daily_budget_eur": GOOGLE_DAILY_BUDGET_EUR,
        "google_calls_today": GOOGLE_USAGE_WINDOW["calls"],
        "estimated_spend_eur": round(GOOGLE_USAGE_WINDOW["spent_eur"], 4),
        "calls": dict(GOOGLE_CALL_METRICS),
        "estimated_units": estimated_units,
        "estimated_units_total": sum(estimated_units.values()),
        "estimated_eur": estimated_eur,
        "cache": CACHE_METRICS,
        "budget": {
            "reached": current_block_reason is not None,
            "reason": current_block_reason,
            "remaining_calls": remaining_calls,
            "remaining_eur": round(remaining_eur, 4),
        },
        "blocked": {
            "total": BLOCKED_METRICS["total"],
            "calls_cap": BLOCKED_METRICS["calls_cap"],
            "eur_cap": BLOCKED_METRICS["eur_cap"],
            "by_endpoint": dict(BLOCKED_METRICS["by_endpoint"]),
        },
    }


def _rounded_coord(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(value, 1)


def _bbox(lat: float, lng: float, radius_m: float) -> Dict[str, Dict[str, float]]:
    """Rectangle bounding box around a center point, used as a hard location restriction
    so the provider only returns places within the search area (not far-away matches)."""
    dlat = radius_m / 111320.0
    dlng = radius_m / (111320.0 * max(math.cos(math.radians(lat)), 0.01))
    return {
        "low": {"latitude": lat - dlat, "longitude": lng - dlng},
        "high": {"latitude": lat + dlat, "longitude": lng + dlng},
    }


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    s = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(s), math.sqrt(1 - s))


def _combined_category_query(categories: List[str]) -> str:
    normalized = list(dict.fromkeys(categories or ["all"]))
    if "all" in normalized:
        return "pet store pet groomer veterinary clinic pet pharmacy"
    query_parts = {
        "groomer": "pet groomer",
        "shop": "pet store",
        "groomerShop": "pet grooming pet store",
        "vet": "veterinary clinic",
        "pharmacy": "pet pharmacy animal pharmacy",
    }
    return " ".join(query_parts[category] for category in normalized if category in query_parts)


def _ensure_metrics_enabled():
    if not ENABLE_USAGE_METRICS:
        raise HTTPException(status_code=404, detail="Usage metrics disabled")


def _normalize_photo_entries(photos: Optional[List[Any]]) -> List[str]:
    normalized: List[str] = []
    for photo in photos or []:
        if isinstance(photo, str) and photo:
            normalized.append(photo)
    return normalized[:PHOTO_DETAIL_LIMIT]

async def _detail_from_nearby_cache(place_id: str) -> Optional[dict]:
    entry = await db.api_cache.find_one({"bucket": "nearby", "value.results.id": str(place_id)})
    if not entry:
        return None
    exp = entry.get("expires_at")
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp is not None and exp <= _utcnow():
        return None
    payload = entry.get("value") or {}
    for place in payload.get("results", []):
        if str(place.get("id")) != str(place_id):
            continue
        photo_name = place.get("photo_name")
        photo_entries = [photo_name] if photo_name else []
        return {
            "id": place.get("id"),
            "name": place.get("name", ""),
            "address": place.get("address", ""),
            "latitude": place.get("latitude"),
            "longitude": place.get("longitude"),
            "category": _normalize_category(place.get("category")),
            "rating": place.get("rating"),
            "user_rating_count": place.get("user_rating_count", 0),
            "phone": "",
            "website": "",
            "open_now": place.get("open_now"),
            "photos": _normalize_photo_entries(photo_entries),
            "image_url": place.get("image_url"),
            "schedule": place.get("schedule"),
            "schedule_text": [],
            "tags": place.get("tags", []),
            "emergency": place.get("emergency", False),
            "emergency_source": place.get("emergency_source"),
            "google_reviews": [],
            "source": "budget_cap_cached_summary",
        }
    return None


def _google_places_enabled() -> bool:
    return bool(GOOGLE_MAPS_API_KEY) and ENABLE_LIVE_GOOGLE_PLACES


# ----------------------------- Models -----------------------------
class SessionRequest(BaseModel):
    session_id: str


class FavoriteToggle(BaseModel):
    place_id: str
    name: str
    address: str = ""
    category: str = "shop"
    rating: Optional[float] = None
    image_url: Optional[str] = None
    photo_name: Optional[str] = None


# ----------------------------- Auth helpers -----------------------------
async def get_current_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@api_router.post("/auth/session")
async def auth_session(req: SessionRequest):
    async with httpx.AsyncClient(timeout=15.0) as hc:
        resp = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": req.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = resp.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name", ""),
            "picture": data.get("picture", ""), "created_at": datetime.now(timezone.utc),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(default=None)):
    return await get_current_user(authorization)


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ----------------------------- Seed (Greek / Athens) -----------------------------
# schedule: 7 entries, index 0 = Monday .. 6 = Sunday
def _sched(weekday="09:00-18:00", sat="09:00-15:00", closed_days=(6,)):
    out = []
    for i in range(7):
        if i in closed_days:
            out.append({"closed": True, "open": None, "close": None})
        elif i == 5:
            o, c = sat.split("-")
            out.append({"closed": False, "open": o, "close": c})
        else:
            o, c = weekday.split("-")
            out.append({"closed": False, "open": o, "close": c})
    return out


SAMPLE_REVIEWS_GROOMER = [
    {"author": "Μαρία Π.", "rating": 5, "text": "Φανταστική περιποίηση για τον σκύλο μου! Πολύ ευγενικό προσωπικό."},
    {"author": "Giorgos K.", "rating": 4, "text": "Καλό κούρεμα, λίγο ακριβό αλλά αξίζει."},
]
SAMPLE_REVIEWS_SHOP = [
    {"author": "Ελένη Δ.", "rating": 5, "text": "Τεράστια ποικιλία προϊόντων και πολύ καλές τιμές."},
    {"author": "Nikos T.", "rating": 4, "text": "Εξυπηρετικοί και βρήκα ό,τι ήθελα για τη γάτα μου."},
]

SEED_SHOPS = [
    {"id": "seed_1", "name": "Happy Tails Κομμωτήριο Κατοικιδίων", "address": "Ερμού 25, Αθήνα", "latitude": 37.9772, "longitude": 23.7290, "category": "groomer", "rating": 4.8, "user_rating_count": 214, "image_url": "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210001", "website": "https://example.gr", "schedule": _sched(closed_days=(6,)), "reviews": SAMPLE_REVIEWS_GROOMER},
    {"id": "seed_2", "name": "Pet City Κολωνάκι", "address": "Σκουφά 52, Κολωνάκι", "latitude": 37.9790, "longitude": 23.7400, "category": "groomerShop", "rating": 4.6, "user_rating_count": 132, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210002", "website": "https://example.gr", "schedule": _sched(closed_days=()), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_3", "name": "Pampered Paws Spa", "address": "Πατησίων 110, Αθήνα", "latitude": 37.9930, "longitude": 23.7330, "category": "groomer", "rating": 4.9, "user_rating_count": 301, "image_url": "https://images.unsplash.com/photo-1611173622933-91942d394b04?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": False, "phone": "+30 210 3210003", "website": "https://example.gr", "schedule": _sched(closed_days=(0, 6)), "reviews": SAMPLE_REVIEWS_GROOMER},
    {"id": "seed_4", "name": "Ζωοφιλία Pet Shop", "address": "Λ. Κηφισίας 18, Αμπελόκηποι", "latitude": 37.9870, "longitude": 23.7560, "category": "shop", "rating": 4.3, "user_rating_count": 89, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210004", "website": "https://example.gr", "schedule": _sched(closed_days=(6,)), "reviews": SAMPLE_REVIEWS_SHOP, "tags": ["pharmacy"]},
    {"id": "seed_5", "name": "Furry Friends Boutique", "address": "Αδριανού 8, Μοναστηράκι", "latitude": 37.9760, "longitude": 23.7250, "category": "groomerShop", "rating": 4.5, "user_rating_count": 156, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210005", "website": "https://example.gr", "schedule": _sched(closed_days=()), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_6", "name": "Pawsh Grooming Studio", "address": "Πλ. Βικτωρίας 3, Αθήνα", "latitude": 37.9930, "longitude": 23.7300, "category": "groomer", "rating": 4.7, "user_rating_count": 178, "image_url": "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210006", "website": "https://example.gr", "schedule": _sched(closed_days=(0,)), "reviews": SAMPLE_REVIEWS_GROOMER},
    {"id": "seed_7", "name": "PetPharm Εφημερεύον Κτηνιατρικό Φαρμακείο", "address": "Σταδίου 22, Αθήνα", "latitude": 37.9785, "longitude": 23.7335, "category": "pharmacy", "rating": 4.6, "user_rating_count": 94, "image_url": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210007", "website": "https://example.gr", "schedule": _sched(closed_days=(6,)), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_8", "name": "Φαρμακείο Ζωής", "address": "Ακαδημίας 45, Αθήνα", "latitude": 37.9800, "longitude": 23.7380, "category": "pharmacy", "rating": 4.4, "user_rating_count": 61, "image_url": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": False, "phone": "+30 210 3210008", "website": "https://example.gr", "schedule": _sched(weekday="08:30-21:00", closed_days=(6,)), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_9", "name": "Animal Health Pharmacy", "address": "Λ. Αλεξάνδρας 10, Αθήνα", "latitude": 37.9900, "longitude": 23.7500, "category": "pharmacy", "rating": 4.8, "user_rating_count": 143, "image_url": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210009", "website": "https://example.gr", "schedule": _sched(closed_days=()), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_10", "name": "Κτηνιατρική Κλινική Αθηνών", "address": "Σόλωνος 60, Αθήνα", "latitude": 37.9825, "longitude": 23.7425, "category": "vet", "rating": 4.7, "user_rating_count": 188, "image_url": "https://images.unsplash.com/photo-1530023367847-a683933f4178?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210010", "website": "https://example.gr", "schedule": _sched(weekday="09:00-20:00", closed_days=(6,)), "schedule_text": ["Δευτέρα - Παρασκευή: 09:00 - 20:00", "Εφημερία / επείγοντα 24ωρο"], "reviews": SAMPLE_REVIEWS_GROOMER},
]

SEED_CITY_CENTERS = {
    "athens": {"latitude": 37.9838, "longitude": 23.7275, "label": "Athens"},
    "αθήνα": {"latitude": 37.9838, "longitude": 23.7275, "label": "Αθήνα"},
    "thessaloniki": {"latitude": 40.6401, "longitude": 22.9444, "label": "Thessaloniki"},
    "θεσσαλονίκη": {"latitude": 40.6401, "longitude": 22.9444, "label": "Θεσσαλονίκη"},
    "patra": {"latitude": 38.2466, "longitude": 21.7346, "label": "Patra"},
    "πάτρα": {"latitude": 38.2466, "longitude": 21.7346, "label": "Πάτρα"},
    "heraklion": {"latitude": 35.3387, "longitude": 25.1442, "label": "Heraklion"},
    "ηράκλειο": {"latitude": 35.3387, "longitude": 25.1442, "label": "Ηράκλειο"},
}


def _seed_geocode(q: str) -> Dict[str, Any]:
    query = (q or "").strip()
    query_l = query.lower()
    if not query_l:
        return {"latitude": 37.9838, "longitude": 23.7275, "label": "Αθήνα", "source": "seed_default"}

    for key, center in SEED_CITY_CENTERS.items():
        if key in query_l:
            return {
                "latitude": center["latitude"],
                "longitude": center["longitude"],
                "label": center["label"],
                "source": "seed_city",
            }

    matches = []
    for s in SEED_SHOPS:
        hay = f"{s.get('name', '')} {s.get('address', '')}".lower()
        if query_l in hay:
            matches.append((float(s["latitude"]), float(s["longitude"])))

    if matches:
        lat = sum(m[0] for m in matches) / len(matches)
        lng = sum(m[1] for m in matches) / len(matches)
        return {"latitude": lat, "longitude": lng, "label": query, "source": "seed_match"}

    return {"latitude": 37.9838, "longitude": 23.7275, "label": query or "Αθήνα", "source": "seed_default"}


def _seed_autocomplete(query: str) -> Dict[str, Any]:
    q = (query or "").strip().lower()
    if len(q) < 2:
        return {"suggestions": [], "source": "seed"}

    suggestions: List[Dict[str, Any]] = []
    seen = set()

    for key, center in SEED_CITY_CENTERS.items():
        label_l = str(center.get("label", "")).lower()
        if q in key or q in label_l:
            desc = str(center.get("label", "")).strip()
            if desc and desc not in seen:
                seen.add(desc)
                suggestions.append({
                    "place_id": f"seed_city_{desc.lower()}",
                    "description": desc,
                    "main": desc,
                    "secondary": "Greece",
                })

    for s in SEED_SHOPS:
        name = str(s.get("name", "")).strip()
        address = str(s.get("address", "")).strip()
        hay = f"{name} {address}".lower()
        if q not in hay:
            continue
        desc = address or name
        if not desc or desc in seen:
            continue
        seen.add(desc)
        suggestions.append({
            "place_id": f"seed_{s.get('id')}",
            "description": desc,
            "main": desc,
            "secondary": "Seed location",
        })

    suggestions.sort(key=lambda it: (0 if it["description"].lower().startswith(q) else 1, len(it["description"])))
    return {"suggestions": suggestions[:8], "source": "seed"}


def _classify(types, name):
    name_l = (name or "").lower()
    t = types or []
    t_set = set(t)
    vet_kw = ["vet", "veterinarian", "veterinary", "κτηνιάτρ", "veterinario", "pet clinic"]
    groom_kw = ["groom", "spa", "salon", "wash", "κομμωτ", "καλλωπ", "περιποί"]
    store_kw = ["shop", "store", "petshop", "είδη", "κατάστημα", "supplies", "pet_store"]
    pharma_kw = ["pharmacy", "φαρμακείο", "φαρμ", "ζωοφαρμακε", "pet pharma", "animal pharma", "veterinary pharma"]
    vet_type_signals = {"veterinary_care", "veterinarian"}
    groom_type_signals = {"pet_grooming_service", "grooming", "hair_care"}
    store_type_signals = {"pet_store", "store"}
    pharmacy_type_signals = {"pharmacy", "drugstore"}
    has_vet = bool(t_set & vet_type_signals) or any(w in name_l for w in vet_kw)
    has_groom = bool(t_set & groom_type_signals) or any(w in name_l for w in groom_kw)
    has_store = bool(t_set & store_type_signals) or any(w in name_l for w in store_kw)
    has_pharma = bool(t_set & pharmacy_type_signals) or any(w in name_l for w in pharma_kw)
    # Primary category: pet-specific signals win over pharmacy.
    # Only classify as pharmacy when there are no other pet-specific signals.
    if has_vet:
        return "vet"
    if has_groom and has_store:
        return "groomerShop"
    if has_groom:
        return "groomer"
    if has_store:
        return "shop"
    if has_pharma:
        return "pharmacy"
    return "shop"


def _get_tags(types, name) -> list:
    """Secondary tags that can apply on top of any primary category."""
    name_l = (name or "").lower()
    t = types or []
    pharma_kw = ["pharmacy", "φαρμακείο", "φαρμ", "ζωοφαρμακε", "pet pharma", "animal pharma", "veterinary pharma"]
    tags = []
    if ("pharmacy" in t) or any(w in name_l for w in pharma_kw):
        tags.append("pharmacy")
    return tags


EMERGENCY_KEYWORDS = [
    "emergency",
    "emergencies",
    "urgent",
    "urgency",
    "after hours",
    "after-hours",
    "on call",
    "on-call",
    "24h emergency",
    "24/7 emergency",
    "24 hour emergency",
    "24-hour emergency",
    "24ωρ",
    "24ωρο",
    "24ωρη",
    "24ωρης",
    "εφημερ",
    "επειγον",
    "επειγοντ",
    "κεντρο επειγοντων",
]


def _normalize_search_text(text: Optional[str]) -> str:
    if not text:
        return ""
    lowered = text.casefold()
    # Strip diacritics so Greek keywords match with/without tonos.
    lowered = "".join(
        ch for ch in unicodedata.normalize("NFD", lowered)
        if unicodedata.category(ch) != "Mn"
    )
    lowered = re.sub(r"[^a-z0-9\u0370-\u03ff\u1f00-\u1fff]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _contains_emergency_keyword(text: Optional[str]) -> bool:
    normalized = _normalize_search_text(text)
    if not normalized:
        return False
    return any(keyword in normalized for keyword in EMERGENCY_KEYWORDS)


def _derive_emergency(name: Optional[str], weekday_descriptions: Optional[List[str]] = None) -> Dict[str, Any]:
    if _contains_emergency_keyword(name):
        return {"emergency": True, "emergency_source": "name"}

    for line in weekday_descriptions or []:
        if _contains_emergency_keyword(line):
            return {"emergency": True, "emergency_source": "hours"}

    return {"emergency": False, "emergency_source": None}


def _normalize_category(cat: Optional[str]) -> str:
    if cat == "both":
        return "groomerShop"
    return cat or "shop"


def _seed_card(s):
    emergency_meta = _derive_emergency(s.get("name"), s.get("schedule_text"))
    return {k: s[k] for k in ["id", "name", "address", "latitude", "longitude", "category",
                              "rating", "user_rating_count", "image_url", "open_now"]} | {
        "schedule": s["schedule"],
        "tags": s.get("tags", []),
        "emergency": emergency_meta["emergency"],
        "emergency_source": emergency_meta["emergency_source"],
    }


def _matches_category(place_cat: Optional[str], place_tags: list, selected_cats: list) -> bool:
    place_cat = _normalize_category(place_cat)
    if "all" in selected_cats:
        return True
    for c in selected_cats:
        if c == "groomer" and place_cat == "groomer":
            return True
        if c == "shop" and place_cat == "shop":
            return True
        if c == "groomerShop" and place_cat == "groomerShop":
            return True
        if c == "vet" and place_cat == "vet":
            return True
        if c == "pharmacy" and (place_cat == "pharmacy" or "pharmacy" in place_tags):
            return True
    return False


def _open_now_from_schedule(schedule):
    """Derive open/closed from the weekly (Monday-indexed) schedule using Athens local time.
    Lets us cache places for days without stale live-hours calls."""
    if not schedule:
        return None
    now = datetime.now(ATHENS_TZ)
    idx = now.weekday()  # Monday=0 .. Sunday=6 — matches schedule indexing
    try:
        day = schedule[idx]
    except (IndexError, TypeError):
        return None
    if not day or day.get("closed"):
        return False
    o, c = day.get("open"), day.get("close")
    if not o or not c:
        return None
    cur = now.strftime("%H:%M")
    if c < o:  # overnight range (e.g., 20:00-02:00)
        return cur >= o or cur <= c
    return o <= cur <= c


def _periods_to_schedule(periods):
    """Google regularOpeningHours.periods -> 7-entry Monday-indexed schedule."""
    if not periods:
        return None
    sched = [{"closed": True, "open": None, "close": None} for _ in range(7)]
    for p in periods:
        o = p.get("open")
        if not o:
            continue
        gday = o.get("day", 0)  # Google: 0 = Sunday
        mon = (gday + 6) % 7    # Monday-indexed
        otime = f"{o.get('hour', 0):02d}:{o.get('minute', 0):02d}"
        c = p.get("close")
        if c and c.get("day") == gday:
            ctime = f"{c.get('hour', 0):02d}:{c.get('minute', 0):02d}"
        else:
            ctime = "23:59"  # overnight or 24h
        e = sched[mon]
        if e["closed"]:
            e["closed"], e["open"], e["close"] = False, otime, ctime
        else:
            if otime < e["open"]:
                e["open"] = otime
            if ctime > e["close"]:
                e["close"] = ctime
    return sched


async def _google_text_search(query, lat, lng, radius, lang, page_token=None):
    reason = _budget_reason("text_search")
    if reason:
        _record_budget_block("text_search", reason)
        raise HTTPException(status_code=503, detail=_budget_cap_detail("places search", "text_search"))
    url = "https://places.googleapis.com/v1/places:searchText"
    field_mask = ("places.id,places.displayName,places.formattedAddress,places.location,"
                  "places.types,places.rating,places.userRatingCount,places.photos,"
                  "places.regularOpeningHours,nextPageToken")
    payload = {
        "textQuery": query, "languageCode": lang,
        "locationRestriction": {"rectangle": _bbox(lat, lng, float(radius))},
        "pageSize": 20,
    }
    if page_token:
        payload["pageToken"] = page_token
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
    async with httpx.AsyncClient(timeout=15.0) as hc:
        resp = await hc.post(url, json=payload, headers=headers)
    _record_google_call("text_search")
    if resp.status_code != 200:
        logger.error("Google places error %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="Places provider error")
    data = resp.json()
    out = []
    for p in data.get("places", []):
        name = p.get("displayName", {}).get("text", "")
        photos = p.get("photos", [])
        loc = p.get("location", {})
        p_types = p.get("types", [])
        cat = _classify(p_types, name)
        opening_hours = p.get("regularOpeningHours", {})
        sched = _periods_to_schedule(opening_hours.get("periods"))
        emergency_meta = _derive_emergency(name, opening_hours.get("weekdayDescriptions", []))
        out.append({
            "id": p.get("id"), "name": name, "address": p.get("formattedAddress", ""),
            "latitude": loc.get("latitude"), "longitude": loc.get("longitude"),
            "category": cat, "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount", 0),
            "photo_name": photos[0]["name"] if photos else None, "image_url": None,
            "open_now": _open_now_from_schedule(sched),
            "schedule": sched,
            "tags": _get_tags(p_types, name),
            "emergency": emergency_meta["emergency"],
            "emergency_source": emergency_meta["emergency_source"],
        })
    return out, data.get("nextPageToken")


async def _google_text_search_for_category(query, lat, lng, radius, lang, category: Optional[str], page_token=None):
    out, token = await _google_text_search(query, lat, lng, radius, lang, page_token)
    if not category or category == "all":
        return out, token
    normalized_category = _normalize_category(category)
    for item in out:
        item["category"] = normalized_category
    return out, token


@api_router.get("/places/autocomplete")
async def places_autocomplete(input: str, lang: str = "el",
                              lat: Optional[float] = None, lng: Optional[float] = None):
    """Google Places Autocomplete (New) -> location suggestions for the search box."""
    query = input.strip()
    if len(query) < 2:
        return {"suggestions": []}

    if not _google_places_enabled():
        return _seed_autocomplete(query)

    cache_key = (input.strip().lower()[:80], lang, _rounded_coord(lat), _rounded_coord(lng))
    cached = await _cache_get("autocomplete", cache_key)
    if cached is not None:
        return cached
    reason = _budget_reason("autocomplete")
    if reason:
        _record_budget_block("autocomplete", reason)
        return _seed_autocomplete(query) | {"source": "budget_cap_seed"}
    url = "https://places.googleapis.com/v1/places:autocomplete"
    body = {"input": input, "languageCode": lang, "includedRegionCodes": ["gr"]}
    if lat is not None and lng is not None:
        body["locationBias"] = {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 50000.0}}
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY}
    async with httpx.AsyncClient(timeout=10.0) as hc:
        resp = await hc.post(url, json=body, headers=headers)
    _record_google_call("autocomplete")
    if resp.status_code != 200:
        logger.error("Autocomplete error %s: %s", resp.status_code, resp.text[:200])
        return _seed_autocomplete(query) | {"source": "seed_fallback"}
    out = []
    for s in resp.json().get("suggestions", []):
        pp = s.get("placePrediction")
        if not pp:
            continue
        sf = pp.get("structuredFormat", {})
        out.append({
            "place_id": pp.get("placeId"),
            "description": pp.get("text", {}).get("text", ""),
            "main": sf.get("mainText", {}).get("text", ""),
            "secondary": sf.get("secondaryText", {}).get("text", ""),
        })
    response = {"suggestions": out, "source": "google"}
    await _cache_put("autocomplete", cache_key, response, AUTOCOMPLETE_CACHE_TTL_SECONDS)
    return response


@api_router.get("/places/geocode")
async def geocode(q: str, lang: str = "el"):
    cache_key = (q.strip().lower()[:120], lang)
    cached = await _cache_get("geocode", cache_key)
    if cached is not None:
        return cached
    if _google_places_enabled() and q.strip():
        reason = _budget_reason("geocode")
        if reason:
            _record_budget_block("geocode", reason)
            fallback = {"latitude": 37.9838, "longitude": 23.7275, "label": q or "Αθήνα", "source": "budget_cap"}
            await _cache_put("geocode", cache_key, fallback, GEOCODE_CACHE_TTL_SECONDS)
            return fallback
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": q, "key": GOOGLE_MAPS_API_KEY, "language": lang}
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.get(url, params=params)
        _record_google_call("geocode")
        data = resp.json()
        if data.get("results"):
            r = data["results"][0]
            loc = r["geometry"]["location"]
            response = {"latitude": loc["lat"], "longitude": loc["lng"], "label": r.get("formatted_address", q)}
            await _cache_put("geocode", cache_key, response, GEOCODE_CACHE_TTL_SECONDS)
            return response
    fallback = _seed_geocode(q)
    await _cache_put("geocode", cache_key, fallback, GEOCODE_CACHE_TTL_SECONDS)
    return fallback


@api_router.get("/places/nearby")
async def places_nearby(lat: float, lng: float, radius: int = 8000,
                        category: str = "all",
                        day: int = -1, lang: str = "el", page_token: Optional[str] = None):
    # Handle comma-separated categories (multi-select)
    categories = [c.strip() for c in category.split(",") if c.strip()]
    if not categories:
        categories = ["all"]
    
    # Validate categories
    valid_cats = {"all", "shop", "groomer", "groomerShop", "vet", "pharmacy"}
    for c in categories:
        if c not in valid_cats:
            raise HTTPException(status_code=400, detail=f"Invalid category: {c}")

    if _google_places_enabled():
        target_categories = ["groomer", "shop", "groomerShop", "vet", "pharmacy"] if "all" in categories else categories
        cache_key = (
            _rounded_coord(lat),
            _rounded_coord(lng),
            min(radius, 50000),
            ",".join(sorted(target_categories)),
            day,
            lang,
            page_token or "",
        )
        cached = await _cache_get("nearby", cache_key)
        if cached is not None:
            return cached

        reason = _budget_reason("text_search")
        if reason:
            _record_budget_block("text_search", reason)
            return {"results": [], "next_page_token": None, "source": "budget_cap"}

        query = _combined_category_query(target_categories)
        forced_category = target_categories[0] if len(target_categories) == 1 else None
        merged, merged_next = await _google_text_search_for_category(
            query,
            lat,
            lng,
            radius,
            lang,
            forced_category,
            page_token,
        )

        results = []
        radius_km = min(radius, 50000) / 1000.0
        for r in merged:
            r["category"] = _normalize_category(r.get("category"))
            rlat, rlng = r.get("latitude"), r.get("longitude")
            if rlat is None or rlng is None:
                continue
            if _haversine_km(lat, lng, rlat, rlng) > radius_km:
                continue  # drop far-away matches the provider may still include
            if _matches_category(r["category"], r.get("tags", []), categories):
                results.append(r)

        response = {"results": results, "next_page_token": merged_next, "source": "google"}
        await _cache_put("nearby", cache_key, response, NEARBY_CACHE_TTL_SECONDS)
        return response
    
    # Seed fallback — select places matching any of the categories
    results = []
    for s in SEED_SHOPS:
        s_cat = _normalize_category(s["category"])
        s_tags = s.get("tags", [])
        if not _matches_category(s_cat, s_tags, categories):
            continue
        if 0 <= day <= 6 and s["schedule"][day]["closed"]:
            continue
        card = _seed_card(s)
        card["category"] = s_cat
        results.append(card)
    return {"results": results, "next_page_token": None, "source": "seed"}


@api_router.get("/places/photo")
async def place_photo(name: str, max_width: int = 800):
    if not _google_places_enabled():
        raise HTTPException(status_code=404, detail="No provider")
    cache_key = (name, max(200, min(max_width, 1600)))
    cached = await _cache_get("photo", cache_key)
    if cached is not None:
        return Response(content=cached["content"], media_type=cached["media_type"], headers=PHOTO_RESPONSE_HEADERS)
    reason = _budget_reason("photo")
    if reason:
        _record_budget_block("photo", reason)
        raise HTTPException(status_code=503, detail=_budget_cap_detail("photo", "photo"))
    url = f"https://places.googleapis.com/v1/{name}/media"
    params = {"key": GOOGLE_MAPS_API_KEY, "maxWidthPx": cache_key[1]}
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as hc:
        resp = await hc.get(url, params=params)
    _record_google_call("photo")
    if resp.status_code != 200:
        logger.error("Photo error %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Photo error")
    media_type = resp.headers.get("Content-Type", "image/jpeg")
    payload = {"content": resp.content, "media_type": media_type}
    await _cache_put("photo", cache_key, payload, PHOTO_CACHE_TTL_SECONDS)
    return Response(content=resp.content, media_type=media_type, headers=PHOTO_RESPONSE_HEADERS)


@api_router.get("/places/{place_id}")
async def place_details(place_id: str, lang: str = "el"):
    cache_key = (place_id, lang)
    cached = await _cache_get("details", cache_key)
    if cached is not None:
        return cached
    if place_id.startswith("seed_"):
        s = next((x for x in SEED_SHOPS if x["id"] == place_id), None)
        if not s:
            raise HTTPException(status_code=404, detail="Not found")
        emergency_meta = _derive_emergency(s.get("name"), s.get("schedule_text"))
        response = {
            "id": s["id"], "name": s["name"], "address": s["address"],
            "latitude": s["latitude"], "longitude": s["longitude"], "category": _normalize_category(s["category"]),
            "rating": s["rating"], "user_rating_count": s["user_rating_count"],
            "phone": s["phone"], "website": s["website"], "open_now": s["open_now"],
            "image_url": s["image_url"], "photos": _normalize_photo_entries([s["image_url"]]),
            "schedule": s["schedule"], "schedule_text": s.get("schedule_text"),
            "tags": s.get("tags", []),
            "emergency": emergency_meta["emergency"],
            "emergency_source": emergency_meta["emergency_source"],
            "google_reviews": s["reviews"],
        }
        await _cache_put("details", cache_key, response, DETAIL_CACHE_TTL_SECONDS)
        return response
    if _google_places_enabled():
        reason = _budget_reason("place_details")
        if reason:
            _record_budget_block("place_details", reason)
            fallback = await _detail_from_nearby_cache(place_id)
            if fallback:
                await _cache_put("details", cache_key, fallback, DETAIL_CACHE_TTL_SECONDS)
                return fallback
            raise HTTPException(status_code=503, detail=_budget_cap_detail("place details", "place_details"))
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        field_mask = ("id,displayName,formattedAddress,location,types,rating,userRatingCount,"
                      "internationalPhoneNumber,websiteUri,reviews,photos,regularOpeningHours")
        headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.get(url, headers=headers, params={"languageCode": lang})
        _record_google_call("place_details")
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Places provider error")
        p = resp.json()
        name = p.get("displayName", {}).get("text", "")
        loc = p.get("location", {})
        oh = p.get("regularOpeningHours", {})
        sched = _periods_to_schedule(oh.get("periods"))
        emergency_meta = _derive_emergency(name, oh.get("weekdayDescriptions", []))
        response = {
            "id": p.get("id"), "name": name, "address": p.get("formattedAddress", ""),
            "latitude": loc.get("latitude"), "longitude": loc.get("longitude"),
            "category": _classify(p.get("types"), name), "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount", 0),
            "phone": p.get("internationalPhoneNumber", ""), "website": p.get("websiteUri", ""),
            "open_now": _open_now_from_schedule(sched),
            "photos": [ph["name"] for ph in p.get("photos", [])[:PHOTO_DETAIL_LIMIT]], "image_url": None,
            "schedule": sched, "schedule_text": oh.get("weekdayDescriptions", []),
            "tags": _get_tags(p.get("types", []), name),
            "emergency": emergency_meta["emergency"],
            "emergency_source": emergency_meta["emergency_source"],
            "google_reviews": [
                {"author": r.get("authorAttribution", {}).get("displayName", "Google"),
                 "rating": r.get("rating"), "text": r.get("text", {}).get("text", "")}
                for r in p.get("reviews", [])[:6]
            ],
        }
        await _cache_put("details", cache_key, response, DETAIL_CACHE_TTL_SECONDS)
        return response
    raise HTTPException(status_code=404, detail="Not found")


@api_router.get("/metrics/google-usage")
async def google_usage_metrics():
    _ensure_metrics_enabled()
    return _google_usage_payload()


@api_router.post("/metrics/google-usage/reset")
async def reset_google_usage_metrics():
    _ensure_metrics_enabled()
    GOOGLE_USAGE_WINDOW["date"] = _utcnow().date().isoformat()
    GOOGLE_USAGE_WINDOW["calls"] = 0
    GOOGLE_USAGE_WINDOW["spent_eur"] = 0.0
    await _persist_usage()
    for metric in GOOGLE_CALL_METRICS:
        GOOGLE_CALL_METRICS[metric] = 0
    BLOCKED_METRICS["total"] = 0
    BLOCKED_METRICS["calls_cap"] = 0
    BLOCKED_METRICS["eur_cap"] = 0
    for endpoint in BLOCKED_METRICS["by_endpoint"]:
        BLOCKED_METRICS["by_endpoint"][endpoint] = 0
    for metric in CACHE_METRICS.values():
        metric["hits"] = 0
        metric["misses"] = 0
    await db.api_cache.delete_many({})
    return JSONResponse({"ok": True, "usage": _google_usage_payload()})


# ----------------------------- Favorites (server, optional auth) -----------------------------
@api_router.get("/favorites")
async def list_favorites(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    favs = await db.favorites.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    return {"favorites": favs}


@api_router.post("/favorites")
async def toggle_favorite(body: FavoriteToggle, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    existing = await db.favorites.find_one({"user_id": user["user_id"], "place_id": body.place_id})
    if existing:
        await db.favorites.delete_one({"user_id": user["user_id"], "place_id": body.place_id})
        return {"favorited": False}
    doc = body.dict()
    doc["user_id"] = user["user_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.favorites.insert_one(dict(doc))
    return {"favorited": True}


@api_router.get("/")
async def root():
    is_non_prod = ENVIRONMENT != "production"
    return {
        "message": "PawFind API",
        "places_provider": "google" if _google_places_enabled() else "seed",
        "seed_first": not _google_places_enabled(),
        "live_google_enabled": _google_places_enabled(),
        "live_google_disabled": not ENABLE_LIVE_GOOGLE_PLACES,
    }


app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.favorites.create_index([("user_id", 1), ("place_id", 1)], unique=True)
    await db.api_cache.create_index("expires_at", expireAfterSeconds=0)
    await db.api_cache.create_index("bucket")
    await _load_usage()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
