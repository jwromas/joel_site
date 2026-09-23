import json, os

base = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(base, "live_deals.json")

with open(json_path, encoding="utf-8") as f:
    data = json.load(f)

deals = data.get("deals", [])
ticker = []
for d in deals:
    price = d.get("price") or (("From $" + str(d.get("minPrice", ""))) if d.get("minPrice") else "") or ""
    title = d.get("title", "")
    if not title and not price:
        pass
    ticker.append({
        "price": price,
        "title": title,
        "origin": d.get("origin", ""),
        "destination": d.get("destination", ""),
        "description": "",
        "link": d.get("affiliateUrl") or d.get("link") or "https://joeljourneys.com",
        "source": "Joel Journeys"
    })

out_path = os.path.join(base, "ticker_data.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(ticker, f, indent=2)
print(f"Ticker data written: {len(ticker)} items to {out_path}")