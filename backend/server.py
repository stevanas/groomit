from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
    {"id": "seed_2", "name": "Pet City Κολωνάκι", "address": "Σκουφά 52, Κολωνάκι", "latitude": 37.9790, "longitude": 23.7400, "category": "both", "rating": 4.6, "user_rating_count": 132, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210002", "website": "https://example.gr", "schedule": _sched(closed_days=()), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_3", "name": "Pampered Paws Spa", "address": "Πατησίων 110, Αθήνα", "latitude": 37.9930, "longitude": 23.7330, "category": "groomer", "rating": 4.9, "user_rating_count": 301, "image_url": "https://images.unsplash.com/photo-1611173622933-91942d394b04?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": False, "phone": "+30 210 3210003", "website": "https://example.gr", "schedule": _sched(closed_days=(0, 6)), "reviews": SAMPLE_REVIEWS_GROOMER},
    {"id": "seed_4", "name": "Ζωοφιλία Pet Shop", "address": "Λ. Κηφισίας 18, Αμπελόκηποι", "latitude": 37.9870, "longitude": 23.7560, "category": "shop", "rating": 4.3, "user_rating_count": 89, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210004", "website": "https://example.gr", "schedule": _sched(closed_days=(6,)), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_5", "name": "Furry Friends Boutique", "address": "Αδριανού 8, Μοναστηράκι", "latitude": 37.9760, "longitude": 23.7250, "category": "both", "rating": 4.5, "user_rating_count": 156, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210005", "website": "https://example.gr", "schedule": _sched(closed_days=()), "reviews": SAMPLE_REVIEWS_SHOP},
    {"id": "seed_6", "name": "Pawsh Grooming Studio", "address": "Πλ. Βικτωρίας 3, Αθήνα", "latitude": 37.9930, "longitude": 23.7300, "category": "groomer", "rating": 4.7, "user_rating_count": 178, "image_url": "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True, "phone": "+30 210 3210006", "website": "https://example.gr", "schedule": _sched(closed_days=(0,)), "reviews": SAMPLE_REVIEWS_GROOMER},
]


def _classify(types, name):
    name_l = (name or "").lower()
    t = types or []
    groom_kw = ["groom", "spa", "salon", "wash", "κομμωτ", "καλλωπ", "περιποί"]
    store_kw = ["shop", "store", "petshop", "είδη", "κατάστημα", "supplies", "pet_store"]
    has_groom = any(w in name_l for w in groom_kw)
    has_store = ("pet_store" in t) or any(w in name_l for w in store_kw)
    if has_groom and has_store:
        return "both"
    if has_groom:
        return "groomer"
    return "shop"


def _seed_card(s):
    return {k: s[k] for k in ["id", "name", "address", "latitude", "longitude", "category",
                              "rating", "user_rating_count", "image_url", "open_now"]} | {"schedule": s["schedule"]}


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
    url = "https://places.googleapis.com/v1/places:searchText"
    field_mask = ("places.id,places.displayName,places.formattedAddress,places.location,"
                  "places.types,places.rating,places.userRatingCount,places.photos,"
                  "places.currentOpeningHours,places.regularOpeningHours,nextPageToken")
    payload = {
        "textQuery": query, "languageCode": lang,
        "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius)}},
        "pageSize": 20,
    }
    if page_token:
        payload["pageToken"] = page_token
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
    async with httpx.AsyncClient(timeout=15.0) as hc:
        resp = await hc.post(url, json=payload, headers=headers)
    if resp.status_code != 200:
        logger.error("Google places error %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="Places provider error")
    data = resp.json()
    out = []
    for p in data.get("places", []):
        name = p.get("displayName", {}).get("text", "")
        photos = p.get("photos", [])
        loc = p.get("location", {})
        out.append({
            "id": p.get("id"), "name": name, "address": p.get("formattedAddress", ""),
            "latitude": loc.get("latitude"), "longitude": loc.get("longitude"),
            "category": _classify(p.get("types"), name), "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount", 0),
            "photo_name": photos[0]["name"] if photos else None, "image_url": None,
            "open_now": p.get("currentOpeningHours", {}).get("openNow"),
            "schedule": _periods_to_schedule(p.get("regularOpeningHours", {}).get("periods")),
        })
    return out, data.get("nextPageToken")


@api_router.get("/places/autocomplete")
async def places_autocomplete(input: str, lang: str = "el",
                              lat: Optional[float] = None, lng: Optional[float] = None):
    """Google Places Autocomplete (New) -> location suggestions for the search box."""
    if not (GOOGLE_MAPS_API_KEY and input.strip()):
        return {"suggestions": []}
    url = "https://places.googleapis.com/v1/places:autocomplete"
    body = {"input": input, "languageCode": lang, "includedRegionCodes": ["gr"]}
    if lat is not None and lng is not None:
        body["locationBias"] = {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 50000.0}}
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY}
    async with httpx.AsyncClient(timeout=10.0) as hc:
        resp = await hc.post(url, json=body, headers=headers)
    if resp.status_code != 200:
        logger.error("Autocomplete error %s: %s", resp.status_code, resp.text[:200])
        return {"suggestions": []}
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
    return {"suggestions": out}


@api_router.get("/places/geocode")
async def geocode(q: str, lang: str = "el"):
    if GOOGLE_MAPS_API_KEY and q.strip():
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": q, "key": GOOGLE_MAPS_API_KEY, "language": lang}
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.get(url, params=params)
        data = resp.json()
        if data.get("results"):
            r = data["results"][0]
            loc = r["geometry"]["location"]
            return {"latitude": loc["lat"], "longitude": loc["lng"], "label": r.get("formatted_address", q)}
    # Fallback: Athens center
    return {"latitude": 37.9838, "longitude": 23.7275, "label": q or "Αθήνα"}


@api_router.get("/places/nearby")
async def places_nearby(lat: float, lng: float, radius: int = 8000,
                        category: Literal["all", "shop", "groomer", "both"] = "all",
                        day: int = -1, lang: str = "el", page_token: Optional[str] = None):
    if GOOGLE_MAPS_API_KEY:
        query = {"groomer": "pet groomer", "shop": "pet store",
                 "both": "pet store and grooming"}.get(category, "pet store and pet groomer")
        results, next_token = await _google_text_search(query, lat, lng, radius, lang, page_token)
        # Filter by category. "both" must show ONLY combo stores; groomer/shop also include "both".
        if category == "groomer":
            results = [r for r in results if r["category"] in ("groomer", "both")]
        elif category == "shop":
            results = [r for r in results if r["category"] in ("shop", "both")]
        elif category == "both":
            results = [r for r in results if r["category"] == "both"]
        return {"results": results, "next_page_token": next_token, "source": "google"}
    # Seed fallback — selecting groomer/shop also includes "both" stores
    def _matches(scat, q):
        if q == "all":
            return True
        if q == "both":
            return scat == "both"
        if q == "groomer":
            return scat in ("groomer", "both")
        if q == "shop":
            return scat in ("shop", "both")
        return True

    results = []
    for s in SEED_SHOPS:
        if not _matches(s["category"], category):
            continue
        if 0 <= day <= 6 and s["schedule"][day]["closed"]:
            continue
        results.append(_seed_card(s))
    return {"results": results, "next_page_token": None, "source": "seed"}


@api_router.get("/places/photo")
async def place_photo(name: str, max_width: int = 800):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=404, detail="No provider")
    url = f"https://places.googleapis.com/v1/{name}/media"
    params = {"key": GOOGLE_MAPS_API_KEY, "maxWidthPx": max_width}
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as hc:
        resp = await hc.get(url, params=params)
    if resp.status_code != 200:
        logger.error("Photo error %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Photo error")
    return StreamingResponse(iter([resp.content]), media_type=resp.headers.get("Content-Type", "image/jpeg"))


@api_router.get("/places/{place_id}")
async def place_details(place_id: str, lang: str = "el"):
    if place_id.startswith("seed_"):
        s = next((x for x in SEED_SHOPS if x["id"] == place_id), None)
        if not s:
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "id": s["id"], "name": s["name"], "address": s["address"],
            "latitude": s["latitude"], "longitude": s["longitude"], "category": s["category"],
            "rating": s["rating"], "user_rating_count": s["user_rating_count"],
            "phone": s["phone"], "website": s["website"], "open_now": s["open_now"],
            "image_url": s["image_url"], "photos": [s["image_url"]],
            "schedule": s["schedule"], "schedule_text": None,
            "google_reviews": s["reviews"],
        }
    if GOOGLE_MAPS_API_KEY:
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        field_mask = ("id,displayName,formattedAddress,location,types,rating,userRatingCount,"
                      "internationalPhoneNumber,websiteUri,reviews,photos,regularOpeningHours")
        headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.get(url, headers=headers, params={"languageCode": lang})
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Places provider error")
        p = resp.json()
        name = p.get("displayName", {}).get("text", "")
        loc = p.get("location", {})
        oh = p.get("regularOpeningHours", {})
        return {
            "id": p.get("id"), "name": name, "address": p.get("formattedAddress", ""),
            "latitude": loc.get("latitude"), "longitude": loc.get("longitude"),
            "category": _classify(p.get("types"), name), "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount", 0),
            "phone": p.get("internationalPhoneNumber", ""), "website": p.get("websiteUri", ""),
            "open_now": oh.get("openNow"),
            "photos": [ph["name"] for ph in p.get("photos", [])[:6]], "image_url": None,
            "schedule": None, "schedule_text": oh.get("weekdayDescriptions", []),
            "google_reviews": [
                {"author": r.get("authorAttribution", {}).get("displayName", "Google"),
                 "rating": r.get("rating"), "text": r.get("text", {}).get("text", "")}
                for r in p.get("reviews", [])[:6]
            ],
        }
    raise HTTPException(status_code=404, detail="Not found")


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
    return {"message": "GR-oom It API", "places_provider": "google" if GOOGLE_MAPS_API_KEY else "seed"}


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
