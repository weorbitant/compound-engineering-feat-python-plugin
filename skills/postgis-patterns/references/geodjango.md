<overview>
GeoDjango and GeoAlchemy2 patterns covering spatial model fields, spatial lookups,
distance queries, serialization, admin integration, forms, and testing. Includes
GeoAlchemy2 as an alternative for SQLAlchemy-based projects.
</overview>

<geodjango_setup>
## GeoDjango Setup

### System Dependencies

GeoDjango requires GDAL, GEOS, and PROJ libraries installed on the system.

```bash
# Ubuntu/Debian
sudo apt-get install gdal-bin libgdal-dev libgeos-dev libproj-dev

# macOS
brew install gdal geos proj

# Verify installation
python -c "from django.contrib.gis import gdal; print(gdal.GDAL_VERSION)"
python -c "from django.contrib.gis import geos; print(geos.geos_version())"
```

### Django Settings

```python
INSTALLED_APPS = [
    # ...
    "django.contrib.gis",
    # ...
]

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": "mydb",
        "USER": "myuser",
        "PASSWORD": "mypassword",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

The database backend must be `django.contrib.gis.db.backends.postgis` instead of the
standard `django.db.backends.postgresql`.

### PostGIS Extension

```sql
-- Run once on the database
CREATE EXTENSION IF NOT EXISTS postgis;
```

Or use a migration:

```python
from django.contrib.postgres.operations import CreateExtension
from django.db import migrations

class Migration(migrations.Migration):
    operations = [
        CreateExtension("postgis"),
    ]
```
</geodjango_setup>

<spatial_model_fields>
## Spatial Model Fields

### Field Types

```python
from django.contrib.gis.db import models


class Store(models.Model):
    name = models.CharField(max_length=200)
    # Spatial fields create a GiST index automatically (spatial_index=True by default)
    location = models.PointField(srid=4326)
    service_area = models.PolygonField(srid=4326, null=True, blank=True)


class DeliveryZone(models.Model):
    name = models.CharField(max_length=200)
    boundary = models.MultiPolygonField(srid=4326)


class Trail(models.Model):
    name = models.CharField(max_length=200)
    path = models.LineStringField(srid=4326)


class CoverageArea(models.Model):
    name = models.CharField(max_length=200)
    area = models.GeometryCollectionField(srid=4326)
```

### Available Spatial Fields

| Field                    | Geometry Type         | Use Case                        |
|--------------------------|-----------------------|---------------------------------|
| `PointField`             | Point                 | Locations, addresses            |
| `LineStringField`        | LineString            | Routes, trails, roads           |
| `PolygonField`           | Polygon               | Zones, boundaries               |
| `MultiPointField`        | MultiPoint            | Multiple related points         |
| `MultiLineStringField`   | MultiLineString       | Complex route networks          |
| `MultiPolygonField`      | MultiPolygon          | Non-contiguous regions          |
| `GeometryCollectionField`| GeometryCollection    | Mixed geometry types            |
| `GeometryField`          | Any geometry          | When type varies                |

### Creating Spatial Objects

```python
from django.contrib.gis.geos import Point, Polygon, MultiPolygon

store = Store.objects.create(
    name="Downtown Store",
    location=Point(-73.9857, 40.7484, srid=4326),
)

zone = DeliveryZone.objects.create(
    name="Manhattan",
    boundary=MultiPolygon(
        Polygon(
            ((-74.02, 40.70), (-73.97, 40.70), (-73.97, 40.75),
             (-74.02, 40.75), (-74.02, 40.70)),
            srid=4326,
        ),
        srid=4326,
    ),
)

# From WKT
from django.contrib.gis.geos import GEOSGeometry

point = GEOSGeometry("POINT(-73.9857 40.7484)", srid=4326)

# From GeoJSON
point = GEOSGeometry('{"type": "Point", "coordinates": [-73.9857, 40.7484]}', srid=4326)
```
</spatial_model_fields>

<spatial_lookups>
## Spatial Lookups

### Containment Lookups

```python
from django.contrib.gis.geos import Point

point = Point(-73.9857, 40.7484, srid=4326)

# Zones that contain the point
zones = DeliveryZone.objects.filter(boundary__contains=point)

# Stores within a zone's boundary
zone = DeliveryZone.objects.get(name="Manhattan")
stores = Store.objects.filter(location__within=zone.boundary)

# Stores covered by a polygon
polygon = Polygon(
    ((-74.02, 40.70), (-73.97, 40.70), (-73.97, 40.75),
     (-74.02, 40.75), (-74.02, 40.70)),
    srid=4326,
)
stores = Store.objects.filter(location__within=polygon)
```

### Intersection Lookups

```python
# Zones that intersect with a given geometry
stores_in_flood_zone = Store.objects.filter(
    location__intersects=flood_zone.boundary,
)

# Zones that overlap with another zone
overlapping = DeliveryZone.objects.filter(
    boundary__overlaps=other_zone.boundary,
)
```

### Bounding Box Lookups

```python
from django.contrib.gis.geos import Polygon

# Stores within a bounding box
bbox = Polygon.from_bbox((-74.0, 40.7, -73.9, 40.8))
bbox.srid = 4326
stores = Store.objects.filter(location__bboverlaps=bbox)

# Or use __contained (within bounding box of geometry)
stores = Store.objects.filter(location__contained=bbox)
```

### All Spatial Lookups

| Lookup            | Description                                    | Indexed |
|-------------------|------------------------------------------------|---------|
| `__contains`      | Geometry A contains B                          | Yes     |
| `__within`        | Geometry A is within B                         | Yes     |
| `__intersects`    | Geometries share any space                     | Yes     |
| `__overlaps`      | Geometries overlap (same dimension)            | Yes     |
| `__bboverlaps`    | Bounding boxes overlap                         | Yes     |
| `__contained`     | Bounding box of A within bounding box of B     | Yes     |
| `__distance_lte`  | Distance less than or equal to value           | Yes     |
| `__distance_gte`  | Distance greater than or equal to value        | No      |
| `__dwithin`       | Within distance (uses ST_DWithin)              | Yes     |
| `__crosses`       | Geometries cross each other                    | Yes     |
| `__touches`       | Geometries touch at boundary                   | Yes     |
| `__disjoint`      | Geometries do not intersect                    | No      |
</spatial_lookups>

<distance_queries>
## Distance and D Objects

### Distance Lookups

```python
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

ref_point = Point(-73.9857, 40.7484, srid=4326)

# Stores within 5 km
nearby = Store.objects.filter(location__distance_lte=(ref_point, D(km=5)))

# Using dwithin (faster, uses ST_DWithin internally)
nearby = Store.objects.filter(location__dwithin=(ref_point, D(km=5)))

# Stores between 1 km and 10 km
stores = Store.objects.filter(
    location__distance_gte=(ref_point, D(km=1)),
    location__distance_lte=(ref_point, D(km=10)),
)
```

### Annotating with Distance

```python
from django.contrib.gis.db.models.functions import Distance

ref_point = Point(-73.9857, 40.7484, srid=4326)

stores = (
    Store.objects
    .annotate(distance=Distance("location", ref_point))
    .filter(distance__lte=D(km=5))
    .order_by("distance")
)

for store in stores:
    print(f"{store.name}: {store.distance.km:.2f} km")
```

### D Object Units

```python
from django.contrib.gis.measure import D

D(km=5)          # 5 kilometers
D(m=500)         # 500 meters
D(mi=3)          # 3 miles
D(ft=1000)       # 1000 feet
D(nm=2)          # 2 nautical miles
D(yd=100)        # 100 yards
```

### Spatial Aggregates

```python
from django.contrib.gis.db.models import Collect, Extent, Union

# Bounding box of all stores
bbox = Store.objects.aggregate(extent=Extent("location"))
# Returns: {'extent': (-74.02, 40.70, -73.97, 40.80)}

# Union of all zone boundaries
merged = DeliveryZone.objects.aggregate(merged=Union("boundary"))

# Collect all points into a geometry collection
collected = Store.objects.aggregate(all_points=Collect("location"))
```

### Spatial Database Functions

```python
from django.contrib.gis.db.models.functions import (
    Area, Centroid, Distance, Envelope, Length, Transform,
)

# Calculate area of zones in square meters
zones = DeliveryZone.objects.annotate(
    area_m2=Area(Transform("boundary", 32618)),
)

# Get centroids
zones = DeliveryZone.objects.annotate(
    center=Centroid("boundary"),
)

# Trail lengths in meters
trails = Trail.objects.annotate(
    length_m=Length("path"),  # geography-aware, returns meters
)
```
</distance_queries>

<serialization>
## Serialization

### GeoJSON Serializer

```python
from django.core.serializers import serialize

geojson = serialize(
    "geojson",
    Store.objects.all(),
    geometry_field="location",
    fields=("name",),
)
# Returns a GeoJSON FeatureCollection string
```

### DRF with django-rest-framework-gis

```bash
pip install djangorestframework-gis
```

```python
# settings.py
INSTALLED_APPS = [
    # ...
    "rest_framework",
    "rest_framework_gis",
    # ...
]
```

```python
# serializers.py
from rest_framework_gis.serializers import GeoFeatureModelSerializer


class StoreSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Store
        geo_field = "location"
        fields = ("id", "name")


# For distance-annotated querysets
from rest_framework import serializers as drf_serializers


class StoreWithDistanceSerializer(GeoFeatureModelSerializer):
    distance = drf_serializers.SerializerMethodField()

    class Meta:
        model = Store
        geo_field = "location"
        fields = ("id", "name", "distance")

    def get_distance(self, obj) -> float | None:
        if hasattr(obj, "distance"):
            return obj.distance.m
        return None
```

```python
# views.py
from rest_framework_gis.filters import DistanceToPointFilter, InBBoxFilter


class StoreViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    filter_backends = (DistanceToPointFilter,)
    distance_filter_field = "location"
    distance_filter_convert_meters = True

    # GET /api/stores/?dist=5000&point=-73.9857,40.7484


class StoreInBBoxViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    filter_backends = (InBBoxFilter,)
    bbox_filter_field = "location"

    # GET /api/stores/?in_bbox=-74.0,40.7,-73.9,40.8
```

### Manual GeoJSON Response

```python
from django.contrib.gis.geos import GEOSGeometry
from django.http import JsonResponse
import json


def store_geojson(request, pk):
    store = Store.objects.get(pk=pk)
    return JsonResponse({
        "type": "Feature",
        "geometry": json.loads(store.location.geojson),
        "properties": {"name": store.name, "id": store.pk},
    })
```
</serialization>

<admin_integration>
## Admin Integration

### GeoModelAdmin and OSMGeoAdmin

```python
from django.contrib.gis import admin


@admin.register(Store)
class StoreAdmin(admin.GISModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.GISModelAdmin):
    list_display = ("name",)
```

`GISModelAdmin` (Django 4.0+) replaces the older `GeoModelAdmin` and `OSMGeoAdmin`. It
uses OpenStreetMap tiles by default and provides a Leaflet-based map widget.

### Custom Map Settings

```python
from django.contrib.gis import admin


@admin.register(Store)
class StoreAdmin(admin.GISModelAdmin):
    gis_widget_kwargs = {
        "attrs": {
            "default_lon": -73.9857,
            "default_lat": 40.7484,
            "default_zoom": 12,
        },
    }
```
</admin_integration>

<forms>
## Forms and Widgets

### Spatial Form Fields

```python
from django import forms
from django.contrib.gis import forms as gis_forms


class StoreForm(forms.ModelForm):
    class Meta:
        model = Store
        fields = ("name", "location")
        widgets = {
            "location": gis_forms.OSMWidget(
                attrs={
                    "default_lon": -73.9857,
                    "default_lat": 40.7484,
                    "default_zoom": 12,
                    "map_width": 800,
                    "map_height": 500,
                },
            ),
        }
```

### Handling GeoJSON Input in API Views

```python
from django.contrib.gis.geos import GEOSGeometry


def parse_location(data: dict) -> Point | None:
    """Parse location from various input formats."""
    if "location" in data:
        geojson = data["location"]
        if isinstance(geojson, dict):
            return GEOSGeometry(json.dumps(geojson), srid=4326)
        return GEOSGeometry(geojson, srid=4326)

    if "latitude" in data and "longitude" in data:
        return Point(
            float(data["longitude"]),
            float(data["latitude"]),
            srid=4326,
        )

    return None
```
</forms>

<geoalchemy2>
## GeoAlchemy2 (SQLAlchemy Alternative)

### Setup

```bash
pip install geoalchemy2
```

```python
from geoalchemy2 import Geometry, Geography
from geoalchemy2.elements import WKBElement
from sqlalchemy import String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


engine = create_engine("postgresql://user:pass@localhost/mydb")


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    location: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326)
    )
    service_area: Mapped[WKBElement | None] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326)
    )
```

### Spatial Queries

GeoAlchemy2 registers its `ST_*` functions on `sqlalchemy.func` — no separate function
import is needed.

```python
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select

ref_point = WKTElement("POINT(-73.9857 40.7484)", srid=4326)

# Stores within 5 km
nearby = session.scalars(
    select(Store).where(func.ST_DWithin(Store.location, ref_point, 5000))
).all()

# With distance annotation
stmt = (
    select(
        Store,
        func.ST_Distance(Store.location, ref_point).label("distance_m"),
    )
    .where(func.ST_DWithin(Store.location, ref_point, 5000))
    .order_by("distance_m")
)
rows = session.execute(stmt).all()  # list of (Store, distance_m) rows

# Containment
zone = session.scalars(
    select(DeliveryZone).where(DeliveryZone.name == "Manhattan")
).one()
stores_in_zone = session.scalars(
    select(Store).where(
        func.ST_Contains(zone.boundary, Store.location.cast(Geometry))
    )
).all()
```

### GeoJSON with GeoAlchemy2

```python
import json
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import func, select

# Convert to GeoJSON via Shapely
store = session.scalars(select(Store)).first()
shapely_point = to_shape(store.location)
geojson = mapping(shapely_point)
# {'type': 'Point', 'coordinates': (-73.9857, 40.7484)}

# Or use ST_AsGeoJSON in the query
result = session.execute(
    select(Store.name, func.ST_AsGeoJSON(Store.location).label("geojson"))
).first()
geojson_dict = json.loads(result.geojson)
```

### FastAPI Integration

```python
from fastapi import Depends, FastAPI
from geoalchemy2 import Geometry
from geoalchemy2.elements import WKTElement
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session


class NearbyRequest(BaseModel):
    longitude: float
    latitude: float
    radius_km: float = 5.0


class StoreResponse(BaseModel):
    id: int
    name: str
    distance_m: float
    longitude: float
    latitude: float


@app.get("/stores/nearby", response_model=list[StoreResponse])
def get_nearby_stores(
    params: NearbyRequest = Depends(),
    db: Session = Depends(get_db),
):
    ref = WKTElement(f"POINT({params.longitude} {params.latitude})", srid=4326)
    radius_m = params.radius_km * 1000

    stmt = (
        select(
            Store.id,
            Store.name,
            func.ST_Distance(Store.location, ref).label("distance_m"),
            func.ST_X(Store.location.cast(Geometry)).label("longitude"),
            func.ST_Y(Store.location.cast(Geometry)).label("latitude"),
        )
        .where(func.ST_DWithin(Store.location, ref, radius_m))
        .order_by("distance_m")
    )
    results = db.execute(stmt).all()

    return [
        StoreResponse(
            id=r.id,
            name=r.name,
            distance_m=r.distance_m,
            longitude=r.longitude,
            latitude=r.latitude,
        )
        for r in results
    ]
```
</geoalchemy2>

<testing>
## Testing Spatial Queries

### Fixture Data with WKT

```python
import pytest
from django.contrib.gis.geos import Point, Polygon, MultiPolygon


@pytest.fixture
def manhattan_zone(db):
    return DeliveryZone.objects.create(
        name="Manhattan",
        boundary=MultiPolygon(
            Polygon(
                ((-74.02, 40.70), (-73.97, 40.70), (-73.97, 40.80),
                 (-74.02, 40.80), (-74.02, 40.70)),
                srid=4326,
            ),
            srid=4326,
        ),
    )


@pytest.fixture
def times_square_store(db):
    return Store.objects.create(
        name="Times Square",
        location=Point(-73.9855, 40.7580, srid=4326),
    )


@pytest.fixture
def brooklyn_store(db):
    return Store.objects.create(
        name="Brooklyn",
        location=Point(-73.9442, 40.6782, srid=4326),
    )
```

### Fixture Data with GeoJSON

```python
import json
from django.contrib.gis.geos import GEOSGeometry


@pytest.fixture
def zone_from_geojson(db):
    geojson = {
        "type": "Polygon",
        "coordinates": [[
            [-74.02, 40.70], [-73.97, 40.70], [-73.97, 40.80],
            [-74.02, 40.80], [-74.02, 40.70],
        ]],
    }
    return DeliveryZone.objects.create(
        name="Test Zone",
        boundary=GEOSGeometry(json.dumps(geojson), srid=4326),
    )
```

### Testing Distance Queries

```python
from django.contrib.gis.measure import D


def test_nearby_stores(times_square_store, brooklyn_store):
    ref = Point(-73.9857, 40.7484, srid=4326)

    nearby = Store.objects.filter(location__dwithin=(ref, D(km=2)))

    assert times_square_store in nearby
    assert brooklyn_store not in nearby


def test_distance_annotation(times_square_store):
    from django.contrib.gis.db.models.functions import Distance

    ref = Point(-73.9857, 40.7484, srid=4326)

    store = (
        Store.objects
        .annotate(dist=Distance("location", ref))
        .get(pk=times_square_store.pk)
    )

    assert store.dist.km < 2
```

### Testing Containment

```python
def test_store_in_zone(manhattan_zone, times_square_store, brooklyn_store):
    stores = Store.objects.filter(location__within=manhattan_zone.boundary)

    assert times_square_store in stores
    assert brooklyn_store not in stores
```

### Testing with GeoAlchemy2

```python
import pytest
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select


@pytest.fixture
def sample_store(db_session):
    store = Store(
        name="Test Store",
        location=WKTElement("POINT(-73.9857 40.7484)", srid=4326),
    )
    db_session.add(store)
    db_session.commit()
    return store


def test_nearby_query(db_session, sample_store):
    ref = WKTElement("POINT(-73.9860 40.7490)", srid=4326)

    results = db_session.scalars(
        select(Store).where(func.ST_DWithin(Store.location, ref, 1000))
    ).all()

    assert len(results) == 1
    assert results[0].name == "Test Store"
```

### Test Database Setup

Ensure the test database has the PostGIS extension. In Django, use:

```python
# conftest.py or test settings
DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": "test_mydb",
        # ...
    }
}
```

Django's test runner creates the PostGIS extension automatically when using the
`postgis` backend. For GeoAlchemy2, install the extension in a test fixture:

```python
from sqlalchemy import create_engine, text


@pytest.fixture(scope="session")
def engine():
    engine = create_engine("postgresql://user:pass@localhost/test_db")
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
    return engine
```
</testing>
