"""ShiftPe backend API tests."""
import os
import json
import time
import asyncio
import pytest
import requests
import websockets

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().strip('"')
                break
BASE = (BASE or "").rstrip("/")
API = BASE + "/api"

P1 = "+919911111111"  # student
P2 = "+919922222222"  # shop_owner


def _auth_phone(phone, code="123456"):
    r = requests.post(f"{API}/auth/phone/send-otp", json={"phone": phone}, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("mock_code") == "123456"
    r = requests.post(f"{API}/auth/phone/verify-otp", json={"phone": phone, "code": code}, timeout=20)
    return r


@pytest.fixture(scope="module")
def tokens():
    r1 = _auth_phone(P1)
    assert r1.status_code == 200, r1.text
    t1 = r1.json()["token"]
    u1 = r1.json()["user"]
    r2 = _auth_phone(P2)
    assert r2.status_code == 200, r2.text
    t2 = r2.json()["token"]
    u2 = r2.json()["user"]
    # Setup profiles
    h1 = {"Authorization": f"Bearer {t1}"}
    h2 = {"Authorization": f"Bearer {t2}"}
    requests.post(f"{API}/profile/setup", headers=h1, json={
        "role": "student", "name": "TEST_Student1", "age": 21, "gender": "male",
        "city": "Bengaluru", "qualification": "B.Com", "skills": ["Cashier"],
        "available_hours": "evening", "expected_pay": 200, "bio": "TEST"
    }, timeout=20)
    requests.post(f"{API}/profile/setup", headers=h2, json={
        "role": "shop_owner", "name": "TEST_Shop1", "age": 40, "gender": "male",
        "city": "Bengaluru", "shop_name": "TEST Shop", "help_needed": "Counter help",
        "duration": "3-4 hours", "no_of_days": "Mon-Sat", "pay_offered": 250,
        "required_gender": "any", "bio": "TEST"
    }, timeout=20)
    return {"t1": t1, "u1": u1, "t2": t2, "u2": u2}


# ---------- Auth ----------
class TestAuth:
    def test_send_otp_returns_mock(self):
        r = requests.post(f"{API}/auth/phone/send-otp", json={"phone": "+919900000099"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("mock_code") == "123456"

    def test_verify_wrong_otp_400(self):
        requests.post(f"{API}/auth/phone/send-otp", json={"phone": "+919900000098"}, timeout=15)
        r = requests.post(f"{API}/auth/phone/verify-otp", json={"phone": "+919900000098", "code": "000000"}, timeout=15)
        assert r.status_code == 400

    def test_verify_correct_otp(self):
        requests.post(f"{API}/auth/phone/send-otp", json={"phone": "+919900000097"}, timeout=15)
        r = requests.post(f"{API}/auth/phone/verify-otp", json={"phone": "+919900000097", "code": "123456"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and "user" in body

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_invalid_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer junk"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_valid_token(self, tokens):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tokens['t1']}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["phone"] == P1


# ---------- Profile ----------
class TestProfile:
    def test_student_profile_persisted(self, tokens):
        r = requests.get(f"{API}/profile/me", headers={"Authorization": f"Bearer {tokens['t1']}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["profile"]["role"] == "student"
        assert body["user"]["has_profile"] is True

    def test_shop_profile_persisted(self, tokens):
        r = requests.get(f"{API}/profile/me", headers={"Authorization": f"Bearer {tokens['t2']}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["profile"]["role"] == "shop_owner"
        assert body["profile"]["shop_name"] == "TEST Shop"


# ---------- Deck ----------
class TestDeck:
    def test_student_sees_shop_owners(self, tokens):
        r = requests.get(f"{API}/swipe/deck", headers={"Authorization": f"Bearer {tokens['t1']}"}, timeout=15)
        assert r.status_code == 200
        deck = r.json()["deck"]
        assert len(deck) >= 1
        for p in deck:
            assert p["role"] == "shop_owner"
            assert p["user_id"] != tokens["u1"]["user_id"]

    def test_shop_sees_students(self, tokens):
        r = requests.get(f"{API}/swipe/deck", headers={"Authorization": f"Bearer {tokens['t2']}"}, timeout=15)
        assert r.status_code == 200
        deck = r.json()["deck"]
        assert len(deck) >= 1
        for p in deck:
            assert p["role"] == "student"


# ---------- Match ----------
class TestMatchFlow:
    def test_mutual_like_creates_match(self, tokens):
        h1 = {"Authorization": f"Bearer {tokens['t1']}"}
        h2 = {"Authorization": f"Bearer {tokens['t2']}"}
        # Student likes shop
        r1 = requests.post(f"{API}/swipe", headers=h1, json={
            "target_user_id": tokens["u2"]["user_id"], "direction": "like"
        }, timeout=15)
        assert r1.status_code == 200
        # Shop likes student -> should match
        r2 = requests.post(f"{API}/swipe", headers=h2, json={
            "target_user_id": tokens["u1"]["user_id"], "direction": "like"
        }, timeout=15)
        assert r2.status_code == 200
        body = r2.json()
        assert body["matched"] is True
        assert body["match"]["match_id"]
        assert sorted(body["match"]["user_ids"]) == sorted([tokens["u1"]["user_id"], tokens["u2"]["user_id"]])
        tokens["match_id"] = body["match"]["match_id"]

    def test_matches_enriched(self, tokens):
        r = requests.get(f"{API}/matches", headers={"Authorization": f"Bearer {tokens['t1']}"}, timeout=15)
        assert r.status_code == 200
        matches = r.json()["matches"]
        assert any(m["match_id"] == tokens.get("match_id") for m in matches)
        m = next(m for m in matches if m["match_id"] == tokens["match_id"])
        assert m["other"]["user_id"] == tokens["u2"]["user_id"]


# ---------- Chat ----------
class TestChat:
    def test_post_get_message(self, tokens):
        match_id = tokens["match_id"]
        h1 = {"Authorization": f"Bearer {tokens['t1']}"}
        r = requests.post(f"{API}/chat/{match_id}/messages", headers=h1, json={"text": "TEST hello"}, timeout=15)
        assert r.status_code == 200
        msg = r.json()["message"]
        assert msg["text"] == "TEST hello"
        # GET messages
        r = requests.get(f"{API}/chat/{match_id}/messages", headers=h1, timeout=15)
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert any(m["message_id"] == msg["message_id"] for m in msgs)

    def test_websocket_broadcast(self, tokens):
        match_id = tokens["match_id"]
        ws_base = BASE.replace("http", "ws")
        url1 = f"{ws_base}/api/ws/chat/{match_id}?token={tokens['t1']}"
        url2 = f"{ws_base}/api/ws/chat/{match_id}?token={tokens['t2']}"

        async def run():
            async with websockets.connect(url1) as w1, websockets.connect(url2) as w2:
                await w1.send(json.dumps({"text": "TEST_ws_from_1"}))
                # w2 should receive
                msg = await asyncio.wait_for(w2.recv(), timeout=10)
                data = json.loads(msg)
                assert data["type"] == "message"
                assert data["message"]["text"] == "TEST_ws_from_1"
        asyncio.get_event_loop().run_until_complete(run())


# ---------- AI ----------
class TestAI:
    def test_bio_suggestion(self, tokens):
        r = requests.post(f"{API}/ai/bio-suggestion",
                          headers={"Authorization": f"Bearer {tokens['t1']}"},
                          json={"role": "student", "name": "Test", "skills": ["Cashier"], "qualification": "B.Com"},
                          timeout=60)
        assert r.status_code == 200, r.text
        bio = r.json().get("bio", "")
        assert isinstance(bio, str) and len(bio) > 5

    def test_match_recommendations(self, tokens):
        r = requests.post(f"{API}/ai/match-recommendations",
                          headers={"Authorization": f"Bearer {tokens['t1']}"},
                          timeout=60)
        assert r.status_code == 200
        assert "deck" in r.json()
