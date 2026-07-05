import importlib

from fastapi.testclient import TestClient


class MockResponse:
    def __init__(self, status_code, payload=None, content=b"", headers=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.content = content
        self.headers = headers or {}
        self.text = text

    def json(self):
        return self._payload


class MockAsyncClient:
    post_calls = []
    get_calls = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json=None, headers=None):
        MockAsyncClient.post_calls.append({"url": url, "json": json, "headers": headers})
        if url.endswith(":searchText"):
            return MockResponse(
                200,
                payload={
                    "places": [
                        {
                            "id": "place_1",
                            "displayName": {"text": "Vet & Groom"},
                            "formattedAddress": "Athens",
                            "location": {"latitude": 37.98, "longitude": 23.72},
                            "types": ["pet_store"],
                            "rating": 4.7,
                            "userRatingCount": 12,
                            "photos": [{"name": "photos/1"}],
                            "currentOpeningHours": {"openNow": True},
                            "regularOpeningHours": {"periods": []},
                        }
                    ],
                    "nextPageToken": None,
                },
            )
        if url.endswith(":autocomplete"):
            return MockResponse(200, payload={"suggestions": []})
        raise AssertionError(f"Unexpected POST {url}")

    async def get(self, url, headers=None, params=None):
        MockAsyncClient.get_calls.append({"url": url, "headers": headers, "params": params})
        if "/media" in url:
            return MockResponse(200, content=b"image-bytes", headers={"Content-Type": "image/jpeg"})
        if "/v1/places/" in url:
            return MockResponse(
                200,
                payload={
                    "id": "place_1",
                    "displayName": {"text": "Vet & Groom"},
                    "formattedAddress": "Athens",
                    "location": {"latitude": 37.98, "longitude": 23.72},
                    "types": ["pet_store"],
                    "rating": 4.7,
                    "userRatingCount": 12,
                    "internationalPhoneNumber": "+30 2100000000",
                    "websiteUri": "https://example.gr",
                    "reviews": [],
                    "photos": [
                        {"name": "photos/1"},
                        {"name": "photos/2"},
                        {"name": "photos/3"},
                        {"name": "photos/4"},
                    ],
                    "regularOpeningHours": {"periods": [], "weekdayDescriptions": []},
                    "currentOpeningHours": {"openNow": True},
                },
            )
        raise AssertionError(f"Unexpected GET {url}")


def load_server(monkeypatch):
    import server

    module = importlib.reload(server)
    monkeypatch.setattr(module.httpx, "AsyncClient", MockAsyncClient)
    monkeypatch.setattr(module, "GOOGLE_MAPS_API_KEY", "test-key")
    monkeypatch.setattr(module, "ENABLE_USAGE_METRICS", True)
    module.GOOGLE_DAILY_BUDGET_CALLS = 500
    module.GOOGLE_DAILY_BUDGET_EUR = 1.0
    return module


def reset_mocks():
    MockAsyncClient.post_calls = []
    MockAsyncClient.get_calls = []


def test_nearby_all_single_upstream_call_and_cache(monkeypatch):
    module = load_server(monkeypatch)
    reset_mocks()
    client = TestClient(module.app)

    client.post("/api/metrics/google-usage/reset")
    params = {"lat": 37.9838, "lng": 23.7275, "category": "all", "lang": "el"}
    first = client.get("/api/places/nearby", params=params)
    second = client.get("/api/places/nearby", params=params)
    metrics = client.get("/api/metrics/google-usage").json()

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(MockAsyncClient.post_calls) == 1
    assert metrics["calls"]["text_search"] == 1
    assert metrics["cache"]["nearby"]["hits"] >= 1


def test_place_details_limits_photos_and_uses_cache(monkeypatch):
    module = load_server(monkeypatch)
    reset_mocks()
    client = TestClient(module.app)

    client.post("/api/metrics/google-usage/reset")
    first = client.get("/api/places/place_1", params={"lang": "el"})
    second = client.get("/api/places/place_1", params={"lang": "el"})
    metrics = client.get("/api/metrics/google-usage").json()

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(first.json()["photos"]) == 3
    assert len(MockAsyncClient.get_calls) == 1
    assert metrics["calls"]["place_details"] == 1
    assert metrics["cache"]["details"]["hits"] >= 1


def test_photo_proxy_uses_cache_headers_and_cache(monkeypatch):
    module = load_server(monkeypatch)
    reset_mocks()
    client = TestClient(module.app)

    client.post("/api/metrics/google-usage/reset")
    first = client.get("/api/places/photo", params={"name": "photos/1", "max_width": 400})
    second = client.get("/api/places/photo", params={"name": "photos/1", "max_width": 400})
    metrics = client.get("/api/metrics/google-usage").json()

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.headers["cache-control"] == "public, max-age=86400"
    assert first.content == b"image-bytes"
    assert len(MockAsyncClient.get_calls) == 1
    assert metrics["calls"]["photo"] == 1
    assert metrics["cache"]["photo"]["hits"] >= 1


def test_euro_budget_blocks_expensive_upstream_calls_but_not_cache(monkeypatch):
    module = load_server(monkeypatch)
    reset_mocks()
    client = TestClient(module.app)

    client.post("/api/metrics/google-usage/reset")
    module.GOOGLE_DAILY_BUDGET_EUR = 0.03

    first = client.get("/api/places/place_1", params={"lang": "el"})
    second = client.get("/api/places/place_1", params={"lang": "el"})
    nearby = client.get("/api/places/nearby", params={"lat": 37.9838, "lng": 23.7275, "category": "all", "lang": "el"})
    photo = client.get("/api/places/photo", params={"name": "photos/2", "max_width": 400})
    metrics = client.get("/api/metrics/google-usage").json()

    assert first.status_code == 200
    assert second.status_code == 200
    assert nearby.status_code == 200
    assert nearby.json()["source"] == "budget_cap"
    assert photo.status_code == 503
    assert metrics["estimated_spend_eur"] == 0.025
    assert len(MockAsyncClient.get_calls) == 1