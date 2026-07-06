"""One-time migration: re-classify already-saved places by NAME (no Google API calls).
Fixes places that were force-labelled by the last category query that fetched them
(e.g. pure groomers stuck in 'groomerShop'). Falls back to the existing label when
the name gives no clear signal, so nothing is lost."""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from server import _resolve_category, _get_tags

load_dotenv()


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "test_database")]
    changed = 0
    total = 0
    async for d in db.places_geo.find({}, {"name": 1, "category": 1, "tags": 1}):
        total += 1
        name = d.get("name", "")
        current = d.get("category")
        # Name wins; otherwise keep the current (query-derived) label.
        new_cat = _resolve_category(None, name, current)
        new_tags = _get_tags(None, name)
        if new_cat != current or new_tags != d.get("tags", []):
            await db.places_geo.update_one(
                {"_id": d["_id"]},
                {"$set": {"category": new_cat, "tags": new_tags}},
            )
            if new_cat != current:
                changed += 1
                print(f"  {current:12} -> {new_cat:12} | {name[:50]}")
    print(f"\nReclassified {changed} / {total} places.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
