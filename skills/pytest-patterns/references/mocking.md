# Mocking Patterns

Comprehensive reference for mocking in Python tests, covering unittest.mock, pytest-mock,
patching strategies, and framework-specific test clients.

---

## pytest-mock: The `mocker` Fixture

Prefer `pytest-mock` over raw `unittest.mock.patch`. The `mocker` fixture automatically undoes
patches at the end of each test.

```python
def test_send_notification(mocker):
    mock_send = mocker.patch("myapp.notifications.send_email")
    process_order(order_id=42)
    mock_send.assert_called_once_with(
        to="customer@example.com",
        subject="Order Confirmed",
    )
```

### Common mocker Methods

```python
mocker.patch("path.to.target")                 # Replace with MagicMock
mocker.patch("path.to.target", return_value=5) # Replace with fixed return
mocker.patch.object(obj, "method")             # Patch attribute on object
mocker.patch.dict("myapp.config.SETTINGS", {"KEY": "val"})  # Patch dict
mocker.spy(obj, "method")                      # Wrap real method, record calls
mocker.stub(name="my_stub")                    # Create named stub
```

---

## Where to Patch: Import Path of Usage

Patch where the name is looked up, not where it is defined.

```python
# myapp/services.py
from myapp.clients import stripe_client

def charge_customer(amount: int) -> str:
    return stripe_client.charge(amount)
```

```python
# Correct -- patch where stripe_client is used
def test_charge(mocker):
    mock_charge = mocker.patch("myapp.services.stripe_client.charge", return_value="ch_123")
    result = charge_customer(1000)
    assert result == "ch_123"


# WRONG -- patching at the definition site has no effect on the import in services.py
def test_charge_wrong(mocker):
    mocker.patch("myapp.clients.stripe_client.charge", return_value="ch_123")
    # This won't work if services.py already imported stripe_client
```

### When `from X import Y` Is Used

If the target module does `from myapp.clients import stripe_client`, the name `stripe_client`
is bound in the importing module's namespace. Patch it there:

```python
mocker.patch("myapp.services.stripe_client")
```

### When `import X` Is Used

If the target module does `import myapp.clients`, the lookup goes through the module object.
Patch on the module:

```python
mocker.patch("myapp.clients.stripe_client")
```

---

## Mock vs MagicMock vs AsyncMock

| Type | Use Case |
|------|----------|
| `Mock` | Basic mock, no magic method support |
| `MagicMock` | Default -- supports `__len__`, `__iter__`, `__getitem__`, etc. |
| `AsyncMock` | For async functions -- awaiting it returns `return_value` |

```python
from unittest.mock import Mock, MagicMock, AsyncMock


def test_magic_mock_supports_len():
    mock_list = MagicMock()
    mock_list.__len__.return_value = 3
    assert len(mock_list) == 3


def test_async_mock(mocker):
    mock_fetch = mocker.patch(
        "myapp.services.fetch_data",
        new_callable=AsyncMock,
        return_value={"status": "ok"},
    )
    # In an async test, await mock_fetch() returns {"status": "ok"}
```

---

## spec=True for Type-Safe Mocks

Use `spec=True` to restrict mock attributes to those of the real object. This catches typos
and incorrect attribute access at test time.

```python
def test_with_spec(mocker):
    mock_client = mocker.patch(
        "myapp.services.api_client",
        spec=True,
    )
    mock_client.get_user.return_value = {"id": 1}

    # This would raise AttributeError -- api_client has no 'get_usr' method
    # mock_client.get_usr.return_value = {"id": 1}


# autospec creates spec recursively and validates call signatures
def test_with_autospec(mocker):
    mock_send = mocker.patch(
        "myapp.notifications.send_email",
        autospec=True,
    )
    # Calling with wrong signature raises TypeError
    # mock_send(wrong_arg="value")  # Would fail
```

---

## return_value and side_effect

### Fixed Return Value

```python
def test_fixed_return(mocker):
    mocker.patch("myapp.services.get_exchange_rate", return_value=1.25)
    result = convert_currency(100, "USD", "EUR")
    assert result == 125.0
```

### side_effect for Conditional Returns

```python
def test_retry_logic(mocker):
    mock_call = mocker.patch("myapp.services.external_api.call")
    mock_call.side_effect = [
        ConnectionError("timeout"),
        ConnectionError("timeout"),
        {"status": "success"},
    ]
    result = call_with_retry(max_attempts=3)
    assert result == {"status": "success"}
    assert mock_call.call_count == 3
```

### side_effect for Exceptions

```python
def test_handles_api_error(mocker):
    mocker.patch(
        "myapp.services.fetch_user",
        side_effect=APIError("Not found", status=404),
    )
    with pytest.raises(UserNotFoundError):
        get_user_profile(user_id=999)
```

### side_effect as a Function

```python
def test_dynamic_return(mocker):
    def fake_lookup(user_id: int) -> dict:
        users = {1: {"name": "Alice"}, 2: {"name": "Bob"}}
        if user_id not in users:
            raise KeyError(f"User {user_id} not found")
        return users[user_id]

    mocker.patch("myapp.services.lookup_user", side_effect=fake_lookup)
    assert get_user_name(1) == "Alice"
    assert get_user_name(2) == "Bob"
    with pytest.raises(KeyError):
        get_user_name(999)
```

---

## Asserting Call Behavior

```python
def test_call_assertions(mocker):
    mock_send = mocker.patch("myapp.services.send_notification")
    process_events([event_a, event_b])

    # Exact single call
    mock_send.assert_called_once_with(event=event_a, channel="email")

    # Called at all
    mock_send.assert_called()

    # Not called
    # mock_send.assert_not_called()

    # Call count
    assert mock_send.call_count == 2

    # Inspect specific calls
    assert mock_send.call_args_list == [
        mocker.call(event=event_a, channel="email"),
        mocker.call(event=event_b, channel="email"),
    ]

    # Last call arguments
    args, kwargs = mock_send.call_args
    assert kwargs["event"] == event_b

    # Any call matching
    mock_send.assert_any_call(event=event_a, channel="email")
```

### Using `ANY` for Partial Matching

```python
from unittest.mock import ANY


def test_partial_match(mocker):
    mock_log = mocker.patch("myapp.services.audit_log")
    create_order(user_id=1, items=["widget"])
    mock_log.assert_called_once_with(
        action="order_created",
        user_id=1,
        timestamp=ANY,  # Match any value
        details=ANY,
    )
```

---

## Mocking External HTTP APIs

### responses Library (for requests)

```python
import responses


@responses.activate
def test_fetch_github_user():
    responses.add(
        responses.GET,
        "https://api.github.com/users/octocat",
        json={"login": "octocat", "id": 1},
        status=200,
    )
    user = fetch_github_user("octocat")
    assert user["login"] == "octocat"


@responses.activate
def test_api_timeout():
    responses.add(
        responses.GET,
        "https://api.example.com/data",
        body=ConnectionError("Connection timed out"),
    )
    with pytest.raises(ServiceUnavailableError):
        fetch_data()
```

### pytest-httpx (for httpx)

```python
import pytest


def test_fetch_user(httpx_mock):
    httpx_mock.add_response(
        url="https://api.example.com/users/1",
        json={"id": 1, "name": "Alice"},
    )
    user = fetch_user(user_id=1)
    assert user.name == "Alice"


def test_api_error(httpx_mock):
    httpx_mock.add_response(
        url="https://api.example.com/users/999",
        status_code=404,
    )
    with pytest.raises(UserNotFoundError):
        fetch_user(user_id=999)
```

### respx (Alternative httpx Mocking)

```python
import respx
import httpx


@respx.mock
def test_external_call():
    respx.get("https://api.example.com/status").mock(
        return_value=httpx.Response(200, json={"healthy": True})
    )
    result = check_service_health()
    assert result is True
```

---

## Django Test Client

### Using pytest-django

```python
import pytest
from django.test import Client


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="testuser",
        password="testpass123",
    )
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_homepage_returns_200(client):
    response = client.get("/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_create_post(authenticated_client):
    response = authenticated_client.post(
        "/api/posts/",
        data={"title": "Hello", "body": "World"},
        content_type="application/json",
    )
    assert response.status_code == 201
```

### Django REST Framework APIClient

```python
import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_api_client(api_client, user_factory):
    user = user_factory(role="admin")
    api_client.force_authenticate(user=user)
    return api_client


@pytest.mark.django_db
def test_list_orders(authenticated_api_client):
    response = authenticated_api_client.get("/api/v1/orders/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_unauthenticated_access(api_client):
    response = api_client.get("/api/v1/orders/")
    assert response.status_code == 401
```

---

## FastAPI Test Client

### Synchronous TestClient (Starlette)

```python
import pytest
from fastapi.testclient import TestClient
from myapp.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_create_item(client):
    response = client.post(
        "/items/",
        json={"name": "Widget", "price": 9.99},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Widget"
```

### Dependency Override

```python
from myapp.dependencies import get_db_session


@pytest.fixture
def client(test_session):
    def override_get_db():
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

---

## When NOT to Mock

Prefer integration tests over mocking in these cases:

- **Database queries** -- Use a test database with transactions rolled back after each test
  rather than mocking ORM calls. Mocking querysets is fragile and misses real SQL issues.
- **Serialization/deserialization** -- Test the actual serializer, not a mock of it.
- **File I/O on temp paths** -- Use `tmp_path` instead of mocking `open()`.
- **Simple pure functions** -- No need to mock dependencies of functions that have none.

Mock when:

- **External HTTP services** -- Always mock third-party APIs to avoid flaky tests.
- **Time-dependent behavior** -- Mock `datetime.now()` or use `freezegun`.
- **Email/SMS sending** -- Mock the transport, not the message assembly.
- **Expensive computations in unrelated code paths** -- Mock to keep tests fast.
