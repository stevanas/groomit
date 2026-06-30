from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
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


class ReviewCreate(BaseModel):
    place_id: str
    place_name: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""


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
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "created_at": datetime.now(timezone.utc),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    return user


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ----------------------------- Places -----------------------------
SEED_SHOPS = [
    {"id": "seed_1", "name": "Happy Tails Grooming", "address": "221 Baker St, London", "latitude": 37.7849, "longitude": -122.4094, "category": "groomer", "rating": 4.8, "user_rating_count": 214, "image_url": "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True},
    {"id": "seed_2", "name": "The Modern Pet Co.", "address": "88 Market St", "latitude": 37.7790, "longitude": -122.4150, "category": "shop", "rating": 4.6, "user_rating_count": 132, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True},
    {"id": "seed_3", "name": "Pampered Paws Spa", "address": "12 Garden Ave", "latitude": 37.7700, "longitude": -122.4000, "category": "groomer", "rating": 4.9, "user_rating_count": 301, "image_url": "https://images.unsplash.com/photo-1611173622933-91942d394b04?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": False},
    {"id": "seed_4", "name": "Whiskers & Co Supplies", "address": "45 Oak Lane", "latitude": 37.7920, "longitude": -122.4030, "category": "shop", "rating": 4.3, "user_rating_count": 89, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True},
    {"id": "seed_5", "name": "Furry Friends Boutique", "address": "9 Sunset Blvd", "latitude": 37.7660, "longitude": -122.4180, "category": "shop", "rating": 4.5, "user_rating_count": 156, "image_url": "https://images.unsplash.com/photo-1778653202386-06d020d905df?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True},
    {"id": "seed_6", "name": "Pawsh Grooming Studio", "address": "300 Pine St", "latitude": 37.7980, "longitude": -122.4120, "category": "groomer", "rating": 4.7, "user_rating_count": 178, "image_url": "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "open_now": True},
]


def _classify(types, name):
    name_l = (name or "").lower()
    if any(w in name_l for w in ["groom", "spa", "salon", "wash"]):
        return "groomer"
    t = types or []
    if "pet_store" in t:
        return "shop"
    return "groomer" if "groomer" in name_l else "shop"


async def _google_text_search(query, lat, lng, radius):
    url = "https://places.googleapis.com/v1/places:searchText"
    field_mask = ("places.id,places.displayName,places.formattedAddress,places.location,"
                  "places.types,places.rating,places.userRatingCount,places.photos,places.currentOpeningHours")
    payload = {
        "textQuery": query,
        "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius)}},
        "maxResultCount": 20,
    }
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
    async with httpx.AsyncClient(timeout=15.0) as hc:
        resp = await hc.post(url, json=payload, headers=headers)
    if resp.status_code != 200:
        logger.error("Google places error %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="Places provider error")
    out = []
    for p in resp.json().get("places", []):
        name = p.get("displayName", {}).get("text", "")
        photos = p.get("photos", [])
        loc = p.get("location", {})
        out.append({
            "id": p.get("id"),
            "name": name,
            "address": p.get("formattedAddress", ""),
            "latitude": loc.get("latitude"),
            "longitude": loc.get("longitude"),
            "category": _classify(p.get("types"), name),
            "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount", 0),
            "photo_name": photos[0]["name"] if photos else None,
            "image_url": None,
            "open_now": p.get("currentOpeningHours", {}).get("openNow"),
        })
    return out


@api_router.get("/places/nearby")
async def places_nearby(lat: float, lng: float, radius: int = 5000,
                        category: Literal["all", "shop", "groomer"] = "all"):
    if GOOGLE_MAPS_API_KEY:
        if category == "groomer":
            query = "pet groomer"
        elif category == "shop":
            query = "pet store"
        else:
            query = "pet store and pet groomer"
        results = await _google_text_search(query, lat, lng, radius)
        if category != "all":
            results = [r for r in results if r["category"] == category]
        return {"results": results, "source": "google"}
    # Fallback seed data (no key configured)
    results = [dict(s) for s in SEED_SHOPS]
    if category != "all":
        results = [r for r in results if r["category"] == category]
    return {"results": results, "source": "seed"}


@api_router.get("/places/{place_id}")
async def place_details(place_id: str):
    base = None
    if place_id.startswith("seed_"):
        base = next((dict(s) for s in SEED_SHOPS if s["id"] == place_id), None)
        if not base:
            raise HTTPException(status_code=404, detail="Not found")
        base["website"] = "https://example.com"
        base["phone"] = "+1 555 0123"
        base["google_reviews"] = []
        base["photos"] = [base.get("image_url")]
    elif GOOGLE_MAPS_API_KEY:
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        field_mask = ("id,displayName,formattedAddress,location,types,rating,userRatingCount,"
                      "internationalPhoneNumber,websiteUri,reviews,photos,currentOpeningHours")
        headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.get(url, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Places provider error")
        p = resp.json()
        name = p.get("displayName", {}).get("text", "")
        loc = p.get("location", {})
        base = {
            "id": p.get("id"),
            "name": name,
            "address": p.get("formattedAddress", ""),
            "latitude": loc.get("latitude"),
            "longitude": loc.get("longitude"),
            "category": _classify(p.get("types"), name),
            "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount", 0),
            "phone": p.get("internationalPhoneNumber", ""),
            "website": p.get("websiteUri", ""),
            "open_now": p.get("currentOpeningHours", {}).get("openNow"),
            "photos": [ph["name"] for ph in p.get("photos", [])[:6]],
            "image_url": None,
            "google_reviews": [
                {
                    "author": r.get("authorAttribution", {}).get("displayName", "Google user"),
                    "rating": r.get("rating"),
                    "text": r.get("text", {}).get("text", ""),
                } for r in p.get("reviews", [])[:5]
            ],
        }
    else:
        raise HTTPException(status_code=404, detail="Not found")

    app_reviews = await db.reviews.find({"place_id": place_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    base["app_reviews"] = app_reviews
    if app_reviews:
        base["app_rating"] = round(sum(r["rating"] for r in app_reviews) / len(app_reviews), 1)
        base["app_review_count"] = len(app_reviews)
    else:
        base["app_rating"] = None
        base["app_review_count"] = 0
    return base


@api_router.get("/places/photo")
async def place_photo(name: str, max_width: int = 800):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=404, detail="No provider")
    url = f"https://places.googleapis.com/v1/{name}/media"
    params = {"key": GOOGLE_MAPS_API_KEY, "maxWidthPx": max_width}
    async with httpx.AsyncClient(timeout=20.0) as hc:
        resp = await hc.get(url, params=params)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Photo error")
    return StreamingResponse(iter([resp.content]),
                             media_type=resp.headers.get("Content-Type", "image/jpeg"))


# ----------------------------- Reviews -----------------------------
@api_router.post("/reviews")
async def add_review(body: ReviewCreate, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    doc = {
        "id": str(uuid.uuid4()),
        "place_id": body.place_id,
        "place_name": body.place_name,
        "rating": body.rating,
        "comment": body.comment,
        "user_id": user["user_id"],
        "author": user.get("name") or user.get("email"),
        "picture": user.get("picture", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(dict(doc))
    return doc


@api_router.get("/reviews/{place_id}")
async def get_reviews(place_id: str):
    reviews = await db.reviews.find({"place_id": place_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"reviews": reviews}


# ----------------------------- Favorites -----------------------------
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
    return {"message": "PawFind API", "places_provider": "google" if GOOGLE_MAPS_API_KEY else "seed"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
