"""PawFind backend API tests - public + auth-guarded endpoints."""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://pet-connect-52.preview.emergentagent.com"
).rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _assert_no_mongo_id(payload):
    """Recursively check no '_id' field present in JSON."""
    if isinstance(payload, dict):
        assert "_id" not in payload, f"_id leaked in dict keys: {list(payload.keys())}"
        for v in payload.values():
            _assert_no_mongo_id(v)
    elif isinstance(payload, list):
        for item in payload:
            _assert_no_mongo_id(item)


# ---------- Root ----------
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "PawFind API"
    assert data.get("places_provider") in ("seed", "google")


# ---------- Places nearby ----------
class TestPlacesNearby:
    def test_nearby_all(self, client):
        r = client.get(f"{API}/places/nearby",
                       params={"lat": 37.7749, "lng": -122.4194, "radius": 5000, "category": "all"})
        assert r.status_code == 200
        data = r.json()
        assert "results" in data and isinstance(data["results"], list)
        assert data["source"] in ("seed", "google")
        # With empty key, must serve seed (6 items)
        if data["source"] == "seed":
            assert len(data["results"]) == 6
            ids = {x["id"] for x in data["results"]}
            assert {"seed_1", "seed_2", "seed_3", "seed_4", "seed_5", "seed_6"}.issubset(ids)
        _assert_no_mongo_id(data)

    def test_nearby_shop(self, client):
        r = client.get(f"{API}/places/nearby",
                       params={"lat": 37.7749, "lng": -122.4194, "category": "shop"})
        assert r.status_code == 200
        data = r.json()
        assert all(x["category"] == "shop" for x in data["results"])
        if data["source"] == "seed":
            assert len(data["results"]) == 3

    def test_nearby_groomer(self, client):
        r = client.get(f"{API}/places/nearby",
                       params={"lat": 37.7749, "lng": -122.4194, "category": "groomer"})
        assert r.status_code == 200
        data = r.json()
        assert all(x["category"] == "groomer" for x in data["results"])
        if data["source"] == "seed":
            assert len(data["results"]) == 3

    def test_nearby_invalid_category(self, client):
        r = client.get(f"{API}/places/nearby",
                       params={"lat": 37.7749, "lng": -122.4194, "category": "invalid"})
        assert r.status_code == 422


# ---------- Place details ----------
class TestPlaceDetails:
    def test_seed_1_details(self, client):
        r = client.get(f"{API}/places/seed_1")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "seed_1"
        assert data["name"] == "Happy Tails Grooming"
        assert "app_reviews" in data and isinstance(data["app_reviews"], list)
        assert "app_rating" in data
        assert "app_review_count" in data
        assert "google_reviews" in data and isinstance(data["google_reviews"], list)
        assert "website" in data and "phone" in data
        _assert_no_mongo_id(data)

    def test_unknown_seed(self, client):
        r = client.get(f"{API}/places/seed_999")
        assert r.status_code == 404

    def test_non_seed_no_key(self, client):
        # With empty GOOGLE_MAPS_API_KEY, non-seed ids should 404
        r = client.get(f"{API}/places/ChIJsomethingrandom")
        assert r.status_code == 404


# ---------- Reviews ----------
class TestReviews:
    def test_get_reviews_initial(self, client):
        r = client.get(f"{API}/reviews/seed_1")
        assert r.status_code == 200
        data = r.json()
        assert "reviews" in data and isinstance(data["reviews"], list)
        _assert_no_mongo_id(data)

    def test_post_review_requires_auth(self, client):
        r = client.post(f"{API}/reviews",
                        json={"place_id": "seed_1", "place_name": "Happy Tails",
                              "rating": 5, "comment": "Great!"})
        assert r.status_code == 401

    def test_post_review_invalid_token(self, client):
        r = client.post(f"{API}/reviews",
                        headers={"Authorization": "Bearer invalid_token_xyz"},
                        json={"place_id": "seed_1", "place_name": "Happy Tails",
                              "rating": 5, "comment": "Great!"})
        assert r.status_code == 401


# ---------- Auth guards ----------
class TestAuthGuards:
    def test_me_no_auth(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_bearer(self, client):
        r = client.get(f"{API}/auth/me",
                       headers={"Authorization": "Bearer bogus_token"})
        assert r.status_code == 401

    def test_me_malformed_header(self, client):
        r = client.get(f"{API}/auth/me",
                       headers={"Authorization": "NotBearer foo"})
        assert r.status_code == 401

    def test_favorites_get_no_auth(self, client):
        r = client.get(f"{API}/favorites")
        assert r.status_code == 401

    def test_favorites_post_no_auth(self, client):
        r = client.post(f"{API}/favorites",
                        json={"place_id": "seed_1", "name": "Happy Tails"})
        assert r.status_code == 401

    def test_session_invalid_id(self, client):
        r = client.post(f"{API}/auth/session",
                        json={"session_id": "definitely_invalid_session_xyz_123"})
        assert r.status_code == 401

    def test_logout_no_auth_is_ok(self, client):
        # logout endpoint tolerates missing auth (best-effort cleanup)
        r = client.post(f"{API}/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True
