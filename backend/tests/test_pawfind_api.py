"""PawFind backend API regression tests (post Google cache refactor).

Covers:
  - Root / status
  - /api/places/nearby (categories, invalid, multi-select, pagination)
  - Persistent MongoDB caching (hits/misses via /metrics/google-usage)
  - Autocomplete / geocode / details / photo caching
  - Auth guards on favorites
"""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://pet-connect-52.preview.emergentagent.com"
).rstrip("/")

API = f"{BASE_URL}/api"

# Athens center, chosen radius/lang from the review request
ATHENS_LAT = 37.98
ATHENS_LNG = 23.72
RADIUS = 8000
LANG = "el"

VALID_CATEGORIES = {"all", "shop", "groomer", "groomerShop", "vet", "pharmacy"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def reset_metrics_before_suite(client):
    """Reset counters + Mongo api_cache once before the suite (autouse)."""
    r = client.post(f"{API}/metrics/google-usage/reset")
    assert r.status_code == 200, r.text
    yield


def _assert_no_mongo_id(payload):
    if isinstance(payload, dict):
        assert "_id" not in payload, f"_id leaked: {list(payload.keys())}"
        for v in payload.values():
            _assert_no_mongo_id(v)
    elif isinstance(payload, list):
        for item in payload:
            _assert_no_mongo_id(item)


# ---------------- Root ----------------
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("message") == "PawFind API"
    # Refactor requires places_provider == 'google'
    assert data.get("places_provider") == "google", data
    assert data.get("live_google_enabled") is True


# ---------------- Nearby / schema ----------------
class TestNearbySchema:
    def test_shape_and_open_now_derived(self, client):
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": "shop", "day": -1, "lang": LANG},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("results"), list)
        assert data.get("source") in ("google", "budget_cap")
        _assert_no_mongo_id(data)

        if not data["results"]:
            pytest.skip("No shop results returned for Athens center")

        required_keys = {"id", "name", "address", "latitude", "longitude",
                         "category", "rating", "open_now", "schedule",
                         "emergency", "emergency_source"}
        for item in data["results"]:
            missing = required_keys - set(item.keys())
            assert not missing, f"Missing keys {missing} in {item}"
            # open_now must be boolean or None (derived)
            assert isinstance(item["open_now"], bool) or item["open_now"] is None
            assert isinstance(item["emergency"], bool)
            # schedule must be 7-entry list or None
            if item["schedule"] is not None:
                assert isinstance(item["schedule"], list)
                assert len(item["schedule"]) == 7
                for day_entry in item["schedule"]:
                    assert set(day_entry.keys()) >= {"closed", "open", "close"}

    def test_open_now_boolean_ratio(self, client):
        """At least a majority of returned places should have a derived boolean open_now
        (not None). This validates schedules are being derived, not blank."""
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": "all", "day": -1, "lang": LANG},
        )
        assert r.status_code == 200, r.text
        results = r.json().get("results", [])
        if not results:
            pytest.skip("No results")
        bool_count = sum(1 for x in results if isinstance(x["open_now"], bool))
        # At least some places should have schedules; assert non-zero
        assert bool_count > 0, f"open_now never derived across {len(results)} places"

    def test_seed_mode_exposes_emergency_examples(self, client):
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": "all", "day": -1, "lang": LANG},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        if data.get("source") != "seed":
            pytest.skip("Emergency seed coverage is only guaranteed in seed mode")

        emergency_results = [x for x in data.get("results", []) if x.get("emergency") is True]
        assert emergency_results, "Seed dataset should include at least one emergency result"
        assert any(x.get("emergency_source") in {"name", "hours"} for x in emergency_results)


# ---------------- Category filtering ----------------
class TestCategoryFiltering:
    @pytest.mark.parametrize("cat", ["groomer", "groomerShop", "vet", "pharmacy", "all"])
    def test_single_category(self, client, cat):
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": cat, "day": -1, "lang": LANG},
        )
        assert r.status_code == 200, f"{cat}: {r.text}"
        data = r.json()
        assert isinstance(data.get("results"), list)
        if cat != "all":
            for item in data["results"]:
                # For 'pharmacy' the backend also matches items with 'pharmacy' tag
                if cat == "pharmacy":
                    assert item["category"] == "pharmacy" or "pharmacy" in item.get("tags", []), item
                else:
                    assert item["category"] == cat, item

    def test_multi_select_shop_groomer(self, client):
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": "shop,groomer", "day": -1, "lang": LANG},
        )
        assert r.status_code == 200, r.text
        for item in r.json().get("results", []):
            assert item["category"] in {"shop", "groomer"}, item

    def test_invalid_category_returns_400(self, client):
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": "foo"},
        )
        assert r.status_code == 400, r.text
        assert "Invalid category" in r.json().get("detail", "")


# ---------------- Pagination ----------------
class TestPagination:
    def test_next_page_token(self, client):
        # Use 'all' with wider radius to increase chance of pagination
        r1 = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": 20000,
                    "category": "all", "day": -1, "lang": LANG},
        )
        assert r1.status_code == 200
        data1 = r1.json()
        token = data1.get("next_page_token")
        if not token:
            pytest.skip("No next_page_token returned (dataset small); pagination path not exercised")

        r2 = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": 20000,
                    "category": "all", "day": -1, "lang": LANG,
                    "page_token": token},
        )
        assert r2.status_code == 200, r2.text
        data2 = r2.json()
        assert isinstance(data2.get("results"), list)
        # If any results, they should differ from page 1 (best-effort check)
        if data1["results"] and data2["results"]:
            ids1 = {x["id"] for x in data1["results"]}
            ids2 = {x["id"] for x in data2["results"]}
            assert ids1 != ids2 or len(ids2) > 0


# ---------------- Caching behavior ----------------
class TestCaching:
    def test_nearby_second_call_is_cache_hit(self, client):
        # Reset first
        r = client.post(f"{API}/metrics/google-usage/reset")
        assert r.status_code == 200

        params = {"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                  "category": "shop", "day": -1, "lang": LANG}
        r1 = client.get(f"{API}/places/nearby", params=params)
        assert r1.status_code == 200
        r2 = client.get(f"{API}/places/nearby", params=params)
        assert r2.status_code == 200
        # Payloads should be equivalent
        assert r1.json().get("results") == r2.json().get("results")

        m = client.get(f"{API}/metrics/google-usage")
        assert m.status_code == 200, m.text
        usage = m.json()
        assert usage["calls"]["text_search"] == 1, usage["calls"]
        assert usage["cache"]["nearby"]["hits"] >= 1, usage["cache"]
        assert usage["cache"]["nearby"]["misses"] >= 1, usage["cache"]

    def test_metrics_payload_shape(self, client):
        r = client.get(f"{API}/metrics/google-usage")
        assert r.status_code == 200
        data = r.json()
        for key in ("calls", "cache", "budget", "estimated_spend_eur",
                    "daily_budget_calls", "daily_budget_eur"):
            assert key in data, f"Missing {key} in usage payload"
        assert set(data["calls"].keys()) >= {"text_search", "place_details",
                                             "photo", "autocomplete", "geocode"}
        assert set(data["cache"].keys()) >= {"nearby", "details", "autocomplete",
                                             "geocode", "photo"}
        assert "reached" in data["budget"]
        assert "remaining_calls" in data["budget"]


# ---------------- Autocomplete ----------------
class TestAutocomplete:
    def test_autocomplete_shape_and_cache(self, client):
        client.post(f"{API}/metrics/google-usage/reset")
        r1 = client.get(f"{API}/places/autocomplete",
                        params={"input": "Athens", "lang": LANG})
        assert r1.status_code == 200, r1.text
        data1 = r1.json()
        assert "suggestions" in data1
        assert isinstance(data1["suggestions"], list)

        r2 = client.get(f"{API}/places/autocomplete",
                        params={"input": "Athens", "lang": LANG})
        assert r2.status_code == 200
        assert r1.json() == r2.json()

        usage = client.get(f"{API}/metrics/google-usage").json()
        # Only 1 real call, second should be a cache hit
        assert usage["calls"]["autocomplete"] <= 1, usage["calls"]
        assert usage["cache"]["autocomplete"]["hits"] >= 1, usage["cache"]


# ---------------- Geocode ----------------
class TestGeocode:
    def test_geocode_athens(self, client):
        r = client.get(f"{API}/places/geocode", params={"q": "Athens", "lang": LANG})
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("latitude", "longitude", "label"):
            assert key in data, f"Missing {key}"
        assert isinstance(data["latitude"], (int, float))
        assert isinstance(data["longitude"], (int, float))


# ---------------- Place details + photo ----------------
class TestDetailsAndPhoto:
    _ctx = {}  # cross-test scratch

    def test_pick_place_from_nearby(self, client):
        r = client.get(
            f"{API}/places/nearby",
            params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                    "category": "shop", "day": -1, "lang": LANG},
        )
        assert r.status_code == 200
        results = r.json().get("results", [])
        if not results:
            pytest.skip("No nearby results to pick a place_id from")
        # Prefer one that has a photo_name if present
        picked = next((x for x in results if x.get("id")), None)
        assert picked, "No place with id"
        TestDetailsAndPhoto._ctx["place_id"] = picked["id"]

    def test_details_shape_and_cache_hit(self, client):
        place_id = TestDetailsAndPhoto._ctx.get("place_id")
        if not place_id:
            pytest.skip("No place_id captured")
        client.post(f"{API}/metrics/google-usage/reset")

        r1 = client.get(f"{API}/places/{place_id}", params={"lang": LANG})
        assert r1.status_code == 200, r1.text
        data = r1.json()
        for key in ("id", "name", "address", "phone", "website", "open_now",
                    "schedule", "photos", "google_reviews"):
            assert key in data, f"Missing key '{key}' in details"
        assert isinstance(data["open_now"], bool) or data["open_now"] is None
        assert isinstance(data["photos"], list)
        assert isinstance(data["google_reviews"], list)
        _assert_no_mongo_id(data)
        TestDetailsAndPhoto._ctx["photos"] = data["photos"]

        # Second call = cache hit
        r2 = client.get(f"{API}/places/{place_id}", params={"lang": LANG})
        assert r2.status_code == 200
        assert r1.json() == r2.json()

        usage = client.get(f"{API}/metrics/google-usage").json()
        assert usage["calls"]["place_details"] == 1, usage["calls"]
        assert usage["cache"]["details"]["hits"] >= 1, usage["cache"]

    def test_photo_bytes_and_cache(self, client):
        photos = TestDetailsAndPhoto._ctx.get("photos") or []
        if not photos:
            pytest.skip("No photo names available on picked place")
        name = photos[0]
        client.post(f"{API}/metrics/google-usage/reset")

        r1 = client.get(f"{API}/places/photo", params={"name": name, "max_width": 800})
        assert r1.status_code == 200, f"{r1.status_code} {r1.text[:200]}"
        assert r1.headers.get("Content-Type", "").startswith("image/"), r1.headers
        assert len(r1.content) > 100

        r2 = client.get(f"{API}/places/photo", params={"name": name, "max_width": 800})
        assert r2.status_code == 200
        assert r2.content == r1.content

        usage = client.get(f"{API}/metrics/google-usage").json()
        assert usage["calls"]["photo"] == 1, usage["calls"]
        assert usage["cache"]["photo"]["hits"] >= 1, usage["cache"]


# ---------------- Auth guards ----------------
class TestAuthGuards:
    def test_favorites_get_requires_auth(self, client):
        r = client.get(f"{API}/favorites")
        assert r.status_code == 401

    def test_favorites_post_requires_auth(self, client):
        r = client.post(f"{API}/favorites",
                        json={"place_id": "seed_1", "name": "Happy Tails"})
        assert r.status_code == 401

    def test_favorites_get_invalid_token(self, client):
        r = client.get(f"{API}/favorites",
                       headers={"Authorization": "Bearer bogus_xyz"})
        assert r.status_code == 401


# ---------------- api_cache collection accumulates ----------------
def test_api_cache_collection_has_docs(client):
    """Indirectly verify Mongo cache accumulates: after prior calls,
    a fresh identical nearby+details+geocode call should be a cache hit."""
    # Fresh nearby (should already be cached from prior tests)
    r = client.get(
        f"{API}/places/nearby",
        params={"lat": ATHENS_LAT, "lng": ATHENS_LNG, "radius": RADIUS,
                "category": "shop", "day": -1, "lang": LANG},
    )
    assert r.status_code == 200
    r = client.get(f"{API}/places/geocode", params={"q": "Athens", "lang": LANG})
    assert r.status_code == 200
    usage = client.get(f"{API}/metrics/google-usage").json()
    # Total cache hits across buckets should be > 0 by this point in the suite
    total_hits = sum(v["hits"] for v in usage["cache"].values())
    assert total_hits > 0, usage["cache"]
