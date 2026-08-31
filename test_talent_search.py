#!/usr/bin/env python3
"""Test talent search functionality with authentication."""
import sys
sys.path.insert(0, '/Users/siyer/hiring_capstone/backend')

import requests
from database import SessionLocal
from models import User
from services.auth_service import create_access_token

# Get or create an HR user
db = SessionLocal()
hr_user = db.query(User).filter(User.email == "hr@company.com").first()
if not hr_user:
    print("HR user not found")
    sys.exit(1)

print(f"Found HR user: {hr_user.name} ({hr_user.email})")

# Create auth token - needs user_id in sub field
token = create_access_token({"sub": hr_user.id})
headers = {"Authorization": f"Bearer {token}"}
print(f"Token created: {token[:50]}...")

BASE_URL = "http://localhost:8000/api/v1"

# Test 1: Search by partial name
print("\n=== Test 1: Search by partial name 'test' ===")
response = requests.post(
    f"{BASE_URL}/talent/search",
    headers=headers,
    json={"name": "test"}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Total results: {data.get('total', 0)}")
    print(f"Results returned: {len(data.get('results', []))}")
    for result in data.get('results', [])[:3]:
        print(f"  - {result['name']} ({result.get('email', 'no email')})")
else:
    print(f"Error: {response.text}")

# Test 2: Search by partial email
print("\n=== Test 2: Search by partial email 'gmail' ===")
response = requests.post(
    f"{BASE_URL}/talent/search",
    headers=headers,
    json={"name": "gmail"}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Total results: {data.get('total', 0)}")
    for result in data.get('results', [])[:3]:
        print(f"  - {result['name']} ({result.get('email', 'no email')})")
else:
    print(f"Error: {response.text}")

# Test 3: Search by skills
print("\n=== Test 3: Search by skills ===")
response = requests.post(
    f"{BASE_URL}/talent/search",
    headers=headers,
    json={"skills": ["Python", "React"]}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Total results: {data.get('total', 0)}")
    for result in data.get('results', [])[:3]:
        print(f"  - {result['name']} - Skills: {result.get('skills', [])}")
else:
    print(f"Error: {response.text}")

# Test 4: Get candidate history/timeline
print("\n=== Test 4: Get candidate timeline ===")
# Get first candidate ID
response = requests.post(
    f"{BASE_URL}/talent/search",
    headers=headers,
    json={}
)
if response.status_code == 200:
    data = response.json()
    if data.get('results'):
        candidate_id = data['results'][0]['candidate_id']
        print(f"Testing with candidate: {data['results'][0]['name']} (ID: {candidate_id})")

        # Get history
        response = requests.get(
            f"{BASE_URL}/talent/candidate/{candidate_id}/history",
            headers=headers
        )
        print(f"History status: {response.status_code}")
        if response.status_code == 200:
            history = response.json()
            print(f"  Candidate: {history.get('candidate_name')}")
            print(f"  Status: {history.get('current_status')}")
            print(f"  Timeline events: {len(history.get('timeline', []))}")
            print(f"  Interview rounds: {len(history.get('interview_rounds', []))}")
            print(f"  Reviews: {len(history.get('reviews', []))}")

            # Print timeline
            print("\n  Timeline:")
            for event in history.get('timeline', [])[:5]:
                print(f"    - [{event['type']}] {event['description']} at {event['timestamp'][:10]}")
        else:
            print(f"  Error: {response.text}")

db.close()
print("\n=== All tests completed ===")
