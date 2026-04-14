# Serializer Patterns

## ModelSerializer vs Serializer

### ModelSerializer

Use `ModelSerializer` when the serializer maps directly to a Django model. It auto-generates
fields and `create()` / `update()` methods from the model.

```python
from rest_framework import serializers
from myapp.models import Article


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ["id", "title", "body", "author", "created_at"]
        read_only_fields = ["id", "created_at"]
```

### Serializer (plain)

Use the base `Serializer` when:

- The data does not map to a single model (aggregations, external API payloads)
- Custom `create()` / `update()` logic spans multiple models
- Validating input that does not get persisted (query parameters, action payloads)

```python
class ReportRequestSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    include_drafts = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError(
                "start_date must be before end_date"
            )
        return attrs
```

## Nested Serializers and Depth Control

### Using `depth`

Setting `depth` auto-expands related objects. Useful for read-only responses, but provides
no control over which fields are included.

```python
class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ["id", "title", "author"]
        depth = 1  # Expands author to its full representation
```

### Explicit Nested Serializer (preferred)

Provides full control over the nested representation.

```python
class AuthorSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "avatar_url"]


class ArticleSerializer(serializers.ModelSerializer):
    author = AuthorSummarySerializer(read_only=True)

    class Meta:
        model = Article
        fields = ["id", "title", "body", "author", "created_at"]
```

## SerializerMethodField

Use for computed or derived values that do not exist as model fields.

```python
class ArticleSerializer(serializers.ModelSerializer):
    word_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = ["id", "title", "body", "word_count", "is_owner"]

    def get_word_count(self, obj: Article) -> int:
        return len(obj.body.split())

    def get_is_owner(self, obj: Article) -> bool:
        request = self.context.get("request")
        if request is None:
            return False
        return obj.author_id == request.user.id
```

## Validation

### Field-Level Validation

Method name must follow the pattern `validate_<field_name>`.

```python
class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ["id", "title", "body", "status"]

    def validate_title(self, value: str) -> str:
        if len(value) < 5:
            raise serializers.ValidationError(
                "Title must be at least 5 characters."
            )
        return value
```

### Object-Level Validation

Use `validate()` when validation depends on multiple fields.

```python
class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ["id", "name", "start_time", "end_time"]

    def validate(self, attrs):
        if attrs.get("end_time") and attrs["end_time"] <= attrs["start_time"]:
            raise serializers.ValidationError(
                {"end_time": "End time must be after start time."}
            )
        return attrs
```

### UniqueTogetherValidator

Enforce unique constraints at the serializer level.

```python
from rest_framework.validators import UniqueTogetherValidator


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = ["id", "user", "article"]
        validators = [
            UniqueTogetherValidator(
                queryset=Bookmark.objects.all(),
                fields=["user", "article"],
                message="You have already bookmarked this article.",
            )
        ]
```

### Custom Validators

Reusable validators as standalone functions or classes.

```python
def validate_not_profane(value: str) -> str:
    profane_words = {"spam", "scam"}
    if any(word in value.lower() for word in profane_words):
        raise serializers.ValidationError("Content contains prohibited words.")
    return value


class CommentSerializer(serializers.ModelSerializer):
    body = serializers.CharField(validators=[validate_not_profane])

    class Meta:
        model = Comment
        fields = ["id", "body", "author", "created_at"]
```

## read_only_fields and write_only_fields

```python
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "date_joined"]
        read_only_fields = ["id", "date_joined"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
```

## to_representation and to_internal_value

### to_representation

Customize the outgoing data format.

```python
class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ["id", "title", "status", "tags"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["status_display"] = instance.get_status_display()
        data["tags"] = [tag.name for tag in instance.tags.all()]
        return data
```

### to_internal_value

Customize how incoming data is parsed before validation.

```python
class FlexibleDateSerializer(serializers.Serializer):
    date = serializers.DateField()

    def to_internal_value(self, data):
        if isinstance(data.get("date"), str) and "T" in data["date"]:
            data = {**data, "date": data["date"].split("T")[0]}
        return super().to_internal_value(data)
```

## Related Object Fields

### PrimaryKeyRelatedField

Accept a primary key on write, return the primary key on read. Default for `ModelSerializer`
foreign keys.

```python
class ArticleSerializer(serializers.ModelSerializer):
    author = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all()
    )

    class Meta:
        model = Article
        fields = ["id", "title", "author"]
```

### SlugRelatedField

Accept/return a slug (natural key) instead of the primary key.

```python
class ArticleSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Category.objects.all(),
    )

    class Meta:
        model = Article
        fields = ["id", "title", "category"]
```

### Nested Writable Serializer

Handle creation and updates of related objects in a single request.

```python
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["street", "city", "zip_code"]


class CompanySerializer(serializers.ModelSerializer):
    address = AddressSerializer()

    class Meta:
        model = Company
        fields = ["id", "name", "address"]

    def create(self, validated_data):
        address_data = validated_data.pop("address")
        address = Address.objects.create(**address_data)
        return Company.objects.create(address=address, **validated_data)

    def update(self, instance, validated_data):
        address_data = validated_data.pop("address", None)
        if address_data:
            for attr, value in address_data.items():
                setattr(instance.address, attr, value)
            instance.address.save()
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
```

### Writable Many-to-Many Through Nested Serializer

```python
class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name"]


class ArticleSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Article
        fields = ["id", "title", "body", "tags"]

    def create(self, validated_data):
        tags_data = validated_data.pop("tags", [])
        article = Article.objects.create(**validated_data)
        for tag_data in tags_data:
            tag, _ = Tag.objects.get_or_create(**tag_data)
            article.tags.add(tag)
        return article

    def update(self, instance, validated_data):
        tags_data = validated_data.pop("tags", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags_data is not None:
            instance.tags.clear()
            for tag_data in tags_data:
                tag, _ = Tag.objects.get_or_create(**tag_data)
                instance.tags.add(tag)
        return instance
```

## Performance

### Prefetch in ViewSet, Not Serializer

Serializers should not issue queries. Optimize querysets in the viewset's `get_queryset()`.

```python
# views.py
class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer

    def get_queryset(self):
        return (
            Article.objects
            .select_related("author", "category")
            .prefetch_related("tags", "comments")
        )
```

### Avoid N+1 in SerializerMethodField

When a `SerializerMethodField` accesses related objects, ensure the viewset prefetches them.
The serializer must not trigger additional queries.

```python
# Viewset prefetches comments
def get_queryset(self):
    return Article.objects.prefetch_related("comments")

# Serializer uses the prefetched data without extra queries
class ArticleSerializer(serializers.ModelSerializer):
    comment_count = serializers.SerializerMethodField()

    def get_comment_count(self, obj: Article) -> int:
        # Uses prefetched cache -- no additional query
        return obj.comments.all().count()
```

### Use source Instead of SerializerMethodField When Possible

`source` avoids the overhead of a method call and is more declarative.

```python
class ArticleSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(
        source="author.username", read_only=True
    )
    category_name = serializers.CharField(
        source="category.name", read_only=True
    )

    class Meta:
        model = Article
        fields = [
            "id", "title", "author_username", "category_name",
        ]
```

## Different Serializers for Read and Write

Use separate serializers when the read and write representations differ significantly.

```python
class ArticleWriteSerializer(serializers.ModelSerializer):
    """Accepts author and category as primary keys."""

    class Meta:
        model = Article
        fields = ["id", "title", "body", "author", "category"]


class ArticleReadSerializer(serializers.ModelSerializer):
    """Expands author and category into nested objects."""

    author = AuthorSummarySerializer(read_only=True)
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Article
        fields = [
            "id", "title", "body", "author", "category", "created_at",
        ]
```

Then in the viewset:

```python
class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.select_related("author", "category")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return ArticleReadSerializer
        return ArticleWriteSerializer
```
