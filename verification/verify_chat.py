from playwright.sync_api import sync_playwright, Page, expect

def test_chat_interface(page: Page):
    # Debug console
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("requestfailed", lambda request: print(f"Request failed: {request.url} - {request.failure}"))
    page.on("requestfinished", lambda request: print(f"Request finished: {request.url} - {request.response().status}"))

    # Mock user session
    page.route("**/api/v1/auth/google/session", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"user": {"id": "user-1", "username": "Me", "avatarUrl": null}, "accessToken": "fake-token"}'
    ))

    # Mock conversations
    page.route("**/api/v1/chat/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"id": "conv-1", "title": "Test Chat", "type": "DIRECT", "participants": [{"id": "user-1", "username": "Me"}, {"id": "user-2", "username": "OtherUser"}], "updatedAt": "2023-01-01T12:00:00Z"}]'
    ))

    # Mock specific conversation
    page.route("**/api/v1/chat/conv-1", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"id": "conv-1", "title": "Test Chat", "type": "DIRECT", "participants": [{"id": "user-1", "username": "Me"}, {"id": "user-2", "username": "OtherUser"}]}'
    ))

    # Mock messages
    page.route("**/api/v1/chat/conv-1/messages?*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"content": [{"id": "msg-1", "body": "Hello world", "senderId": "user-2", "createdAt": "2023-01-01T12:00:00Z"}, {"id": "msg-2", "body": "Hi there!", "senderId": "user-1", "createdAt": "2023-01-01T12:01:00Z"}], "totalPages": 1, "totalElements": 2, "last": true}'
    ))

    # Mock user profile (for OtherUser)
    page.route("**/api/v1/users/user-2", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"id": "user-2", "username": "OtherUser", "avatarUrl": null}'
    ))

    # Mock other failing endpoints
    page.route("**/api/v1/users/online", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))
    page.route("**/api/v1/ai/conversation", lambda route: route.fulfill(status=404)) # Or 200 []

    # Mock websocket
    page.route("**/ws/**", lambda route: route.fulfill(status=101))

    # 1. Arrange: Go to the app
    page.goto("http://localhost:5173/")

    # 2. Wait for session check and redirect/render
    try:
        page.wait_for_selector("text=Me", timeout=10000)
    except:
        print("Waiting for 'Me' timed out. Checking if redirected to login.")

    # Click on the conversation "Test Chat"
    # Need to wait for conversation list to load
    try:
        page.wait_for_selector("text=Test Chat", timeout=10000)
        page.get_by_text("Test Chat").click()
    except:
         print("Failed to find 'Test Chat'.")

    # Wait for messages to load
    expect(page.get_by_text("Hello world")).to_be_visible()
    expect(page.get_by_text("Hi there!")).to_be_visible()

    # 3. Screenshot
    page.screenshot(path="verification/chat_interface.png", full_page=True)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_chat_interface(page)
            print("Verification script ran successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
