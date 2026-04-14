# Fixtures, Parametrize, and Test Configuration

Comprehensive reference for pytest fixtures, parametrize patterns, factory_boy integration,
and test configuration.

---

## Fixture Basics

Fixtures provide reusable setup and teardown for tests. Define them with `@pytest.fixture` and
inject by name as function parameters.

```python
import pytest


@pytest.fixture
def sample_user():
    return {"name": "Alice", "email": "alice@example.com", "role": "admin"}


def test_user_has_email(sample_user):
    assert "@" in sample_user["email"]
```

---

## Fixture Scopes

Control fixture lifecycle with the `scope` parameter. A fixture is created once per scope unit
and shared across all tests within that scope.

```python
@pytest.fixture(scope="function")  # Default -- new instance per test
def db_connection():
    conn = create_connection()
    yield conn
    conn.close()


@pytest.fixture(scope="class")
def shared_client():
    client = APIClient()
    yield client
    client.logout()


@pytest.fixture(scope="module")
def loaded_dataset():
    return load_csv("testdata/large_fixture.csv")


@pytest.fixture(scope="session")
def docker_postgres():
    container = start_postgres_container()
    yield container
    container.stop()
```

### Scope Hierarchy

`session` > `module` > `class` > `function`

A higher-scoped fixture cannot depend on a lower-scoped fixture. A session-scoped fixture
cannot request a function-scoped fixture -- pytest will raise a `ScopeMismatch` error.

---

## Yield Fixtures (Setup and Teardown)

Use `yield` to separate setup from teardown. Code after `yield` runs as cleanup regardless of
test outcome.

```python
@pytest.fixture
def temp_directory():
    path = Path(tempfile.mkdtemp())
    yield path
    shutil.rmtree(path)


@pytest.fixture
def override_settings():
    original = app.config.copy()
    app.config["DEBUG"] = True
    yield app.config
    app.config.update(original)
```

---

## Fixture Finalization with `request.addfinalizer`

For cases requiring multiple cleanup steps or conditional finalization.

```python
@pytest.fixture
def managed_resources(request):
    db = connect_db()
    cache = connect_cache()

    request.addfinalizer(lambda: db.close())
    request.addfinalizer(lambda: cache.flush())

    return {"db": db, "cache": cache}
```

Finalizers run in LIFO order -- `cache.flush()` runs before `db.close()`.

---

## Fixture Factories

Fixtures that return callables for on-demand object creation with custom parameters.

```python
@pytest.fixture
def make_user():
    created_users = []

    def _make_user(name: str = "Alice", role: str = "viewer") -> dict:
        user = {"name": name, "role": role, "id": len(created_users) + 1}
        created_users.append(user)
        return user

    yield _make_user

    # Cleanup all created users
    for user in created_users:
        delete_user(user["id"])


def test_admin_permissions(make_user):
    admin = make_user(name="Bob", role="admin")
    viewer = make_user(name="Carol", role="viewer")
    assert admin["role"] == "admin"
    assert viewer["role"] == "viewer"
```

---

## conftest.py Hierarchy

pytest discovers `conftest.py` files at every directory level. Fixtures defined in a
`conftest.py` are available to all tests in that directory and its subdirectories.

```
tests/
    conftest.py          # Session/module-scoped fixtures, shared utilities
    test_health.py
    orders/
        conftest.py      # Order-specific fixtures
        test_create.py
        test_cancel.py
    users/
        conftest.py      # User-specific fixtures
        test_register.py
```

### Root conftest.py Example

```python
# tests/conftest.py
import pytest


@pytest.fixture(scope="session")
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(db):
    connection = db.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()
```

### Subdirectory conftest.py Example

```python
# tests/orders/conftest.py
import pytest


@pytest.fixture
def sample_order(session, make_user):
    user = make_user(name="Buyer")
    order = Order(user_id=user.id, total=99.99)
    session.add(order)
    session.flush()
    return order
```

---

## @pytest.mark.parametrize

### Single Parameter

```python
@pytest.mark.parametrize("status_code", [200, 201, 204])
def test_success_responses(status_code):
    assert 200 <= status_code < 300
```

### Multiple Parameters

```python
@pytest.mark.parametrize(
    ("input_value", "expected"),
    [
        ("hello", 5),
        ("", 0),
        ("pytest", 6),
    ],
)
def test_string_length(input_value, expected):
    assert len(input_value) == expected
```

### Named Test Cases with `pytest.param`

```python
@pytest.mark.parametrize(
    ("email", "is_valid"),
    [
        pytest.param("user@example.com", True, id="valid-email"),
        pytest.param("no-at-sign", False, id="missing-at"),
        pytest.param("@no-local-part.com", False, id="empty-local"),
        pytest.param("user@.com", False, id="empty-domain"),
    ],
)
def test_email_validation(email, is_valid):
    assert validate_email(email) == is_valid
```

### Stacking Multiple Parametrize Decorators

Creates a cartesian product of all parameter combinations.

```python
@pytest.mark.parametrize("method", ["GET", "POST", "PUT"])
@pytest.mark.parametrize("content_type", ["application/json", "text/plain"])
def test_endpoint_content_negotiation(method, content_type):
    response = client.request(method, "/api/data", headers={"Content-Type": content_type})
    assert response.status_code != 500
```

### Indirect Parametrize

Pass parameters through a fixture instead of directly to the test function.

```python
@pytest.fixture
def user_by_role(request):
    role = request.param
    return create_user(role=role)


@pytest.mark.parametrize("user_by_role", ["admin", "editor", "viewer"], indirect=True)
def test_user_can_login(user_by_role):
    assert user_by_role.can_login is True
```

### Parametrize with Expected Exceptions

```python
@pytest.mark.parametrize(
    ("divisor", "expected"),
    [
        (2, 5.0),
        (5, 2.0),
        pytest.param(0, None, id="division-by-zero"),
    ],
)
def test_division(divisor, expected):
    if divisor == 0:
        with pytest.raises(ZeroDivisionError):
            10 / divisor
    else:
        assert 10 / divisor == expected
```

---

## factory_boy Integration

### Basic DjangoModelFactory

```python
import factory
from myapp.models import User, Order


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    is_active = True


class OrderFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Order

    user = factory.SubFactory(UserFactory)
    total = factory.Faker("pydecimal", left_digits=3, right_digits=2, positive=True)
    status = "pending"
```

### Using Factories in Tests

```python
def test_order_belongs_to_user():
    user = UserFactory(username="alice")
    order = OrderFactory(user=user, total=49.99)
    assert order.user.username == "alice"
    assert order.total == 49.99


def test_bulk_creation():
    users = UserFactory.create_batch(5)
    assert len(users) == 5
    assert all(u.is_active for u in users)
```

### Traits for Common Variations

```python
class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    is_active = True
    is_staff = False

    class Params:
        admin = factory.Trait(
            is_staff=True,
            username=factory.Sequence(lambda n: f"admin_{n}"),
        )
        inactive = factory.Trait(is_active=False)


def test_admin_user():
    admin = UserFactory(admin=True)
    assert admin.is_staff is True
    assert admin.username.startswith("admin_")
```

### LazyAttribute and LazyFunction

```python
class OrderFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Order

    created_at = factory.LazyFunction(timezone.now)
    reference = factory.LazyAttribute(
        lambda obj: f"ORD-{obj.user.id}-{obj.created_at:%Y%m%d}"
    )
```

### Related Objects with SubFactory and RelatedFactory

```python
class ProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Profile

    user = factory.SubFactory(UserFactory)
    bio = factory.Faker("paragraph")


class UserWithProfileFactory(UserFactory):
    profile = factory.RelatedFactory(ProfileFactory, factory_related_name="user")
```

---

## Built-in Fixtures

### tmp_path and tmp_path_factory

```python
def test_write_and_read_file(tmp_path):
    file = tmp_path / "output.txt"
    file.write_text("hello pytest")
    assert file.read_text() == "hello pytest"


@pytest.fixture(scope="session")
def shared_temp_dir(tmp_path_factory):
    return tmp_path_factory.mktemp("shared")
```

### monkeypatch

Temporarily modify objects, dictionaries, and environment variables.

```python
def test_with_custom_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("DEBUG", "true")
    assert os.environ["DATABASE_URL"] == "sqlite:///:memory:"


def test_override_attribute(monkeypatch):
    monkeypatch.setattr("myapp.config.MAX_RETRIES", 0)
    assert myapp.config.MAX_RETRIES == 0


def test_override_dict_item(monkeypatch):
    monkeypatch.setitem(app.config, "SECRET_KEY", "test-secret")
    assert app.config["SECRET_KEY"] == "test-secret"


def test_remove_attribute(monkeypatch):
    monkeypatch.delattr("os.path.expanduser")
    with pytest.raises(AttributeError):
        os.path.expanduser("~")
```

### capsys (Capture stdout/stderr)

```python
def test_cli_output(capsys):
    print("Processing complete")
    captured = capsys.readouterr()
    assert "Processing complete" in captured.out
```

### caplog (Capture Logging)

```python
import logging


def test_warning_logged(caplog):
    with caplog.at_level(logging.WARNING):
        logger.warning("Disk usage at 90%%")
    assert "Disk usage" in caplog.text
    assert caplog.records[0].levelname == "WARNING"
```

---

## Custom Markers

### Defining Markers

```toml
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks integration tests requiring external services",
    "e2e: end-to-end tests",
]
```

### Using Markers

```python
@pytest.mark.slow
def test_full_data_migration():
    migrate_all_records()


@pytest.mark.integration
def test_s3_upload():
    upload_file_to_s3("test.txt")


# Run only fast tests
# poetry run pytest -m "not slow"

# Run only integration tests
# poetry run pytest -m integration
```

### skip and xfail

```python
@pytest.mark.skip(reason="Waiting on upstream fix #1234")
def test_broken_feature():
    ...


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="Unix-only functionality",
)
def test_unix_permissions():
    ...


@pytest.mark.xfail(reason="Known bug, fix in progress")
def test_edge_case_rounding():
    assert round(2.675, 2) == 2.68
```

---

## pyproject.toml Configuration

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = [
    "-ra",                    # Show summary of all non-passing tests
    "--strict-markers",       # Error on unregistered markers
    "--strict-config",        # Error on config parse warnings
    "-x",                     # Stop on first failure (remove for CI)
]
filterwarnings = [
    "error",                  # Treat warnings as errors
    "ignore::DeprecationWarning:third_party_lib.*",
]
markers = [
    "slow: marks tests as slow",
    "integration: requires external services",
]

[tool.coverage.run]
source = ["src"]
omit = ["*/migrations/*", "*/tests/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.",
]
```
