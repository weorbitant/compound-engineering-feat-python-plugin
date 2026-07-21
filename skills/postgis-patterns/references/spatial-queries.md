<overview>
PostGIS spatial query patterns covering geometry and geography types, coordinate reference
systems, spatial indexes, common ST_ functions, distance queries, GeoJSON handling,
spatial joins, bounding box queries, nearest neighbor searches, and performance
considerations.
</overview>

<geometry_vs_geography>
## Geometry vs Geography Types

### Geometry

Operates on a flat Cartesian plane. Coordinates are in the units of the SRID (degrees for
4326, meters for projected SRIDs like 3857). Faster for computations but inaccurate for
large-area distance calculations when using SRID 4326.

```sql
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    boundary geometry(Polygon, 4326) NOT NULL
);
```

Use geometry when:
- Working within a small, known geographic area (city, region)
- Using a projected coordinate system with meter-based units
- Performing topological operations (union, intersection, difference)
- Needing the full range of PostGIS functions

### Geography

Operates on a spheroidal model of the Earth. Coordinates are always in degrees
(longitude, latitude). Distance calculations return meters and account for Earth's
curvature. Fewer functions available but results are accurate worldwide.

```sql
CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location geography(Point, 4326) NOT NULL
);
```

Use geography when:
- Storing global data (users, stores across countries)
- Distance accuracy matters more than computation speed
- Primary operations are distance and containment queries
- Data spans large geographic areas

### Casting Between Types

```sql
-- Geography to geometry (for functions not available on geography)
SELECT ST_X(location::geometry), ST_Y(location::geometry) FROM stores;

-- Geometry to geography (for accurate distance)
SELECT ST_Distance(a.geom::geography, b.geom::geography) FROM places a, places b;
```
</geometry_vs_geography>

<coordinate_reference_systems>
## Coordinate Reference Systems

### SRID 4326 (WGS 84)

The standard for GPS coordinates. Latitude and longitude in degrees. Default for most
web mapping and geographic data exchange.

```sql
-- Set SRID when inserting
INSERT INTO stores (name, location)
VALUES ('HQ', ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326));

-- Verify SRID
SELECT ST_SRID(location) FROM stores;
```

**Coordinate order in PostGIS**: `ST_MakePoint(longitude, latitude)` -- longitude first,
latitude second. This catches many bugs.

### ST_Transform

Convert between coordinate systems. Common use: transform from 4326 (degrees) to a
projected system (meters) for accurate area or distance calculations.

```sql
-- Transform to UTM Zone 18N (meters) for accurate area in New York
SELECT
    name,
    ST_Area(ST_Transform(boundary, 32618)) AS area_sq_meters
FROM regions;

-- Transform to Web Mercator (3857) for tile-based mapping
SELECT ST_Transform(geom, 3857) FROM places;
```

### Common SRIDs

| SRID  | Name           | Units   | Use Case                          |
|-------|----------------|---------|-----------------------------------|
| 4326  | WGS 84         | Degrees | GPS, storage, exchange            |
| 3857  | Web Mercator   | Meters  | Web maps (Leaflet, Mapbox)        |
| 326XX | UTM Zones      | Meters  | Accurate local measurements       |
| 2163  | US National    | Meters  | US-wide area calculations         |
</coordinate_reference_systems>

<spatial_indexes>
## Spatial Indexes

### GiST Index for Geometry and Geography

The default spatial index type. Required for performant spatial queries.

```sql
-- On geometry columns
CREATE INDEX idx_regions_boundary ON regions USING GIST (boundary);

-- On geography columns
CREATE INDEX idx_stores_location ON stores USING GIST (location);

-- Partial index for active records only
CREATE INDEX idx_active_stores_location
    ON stores USING GIST (location)
    WHERE is_active = true;
```

### SP-GiST Index for Points

More efficient than GiST for point-only data. Uses space-partitioning trees.

```sql
CREATE INDEX idx_events_location ON events USING SPGIST (location);
```

SP-GiST works only with geometry (not geography) and only with certain operators.
Prefer GiST unless benchmarking shows SP-GiST is faster for the workload.

### Index Usage Verification

```sql
-- Check if a query uses the spatial index
EXPLAIN ANALYZE
SELECT * FROM stores
WHERE ST_DWithin(location, ST_MakePoint(-73.9857, 40.7484)::geography, 1000);

-- Look for "Index Scan using idx_stores_location" in output
```
</spatial_indexes>

<common_st_functions>
## Common ST_ Functions

### Distance Functions

```sql
-- Distance between two points (returns meters for geography, SRID units for geometry)
SELECT ST_Distance(
    ST_MakePoint(-73.9857, 40.7484)::geography,
    ST_MakePoint(-118.2437, 34.0522)::geography
) AS distance_meters;

-- Check if within distance (uses spatial index)
SELECT * FROM stores
WHERE ST_DWithin(
    location,
    ST_MakePoint(-73.9857, 40.7484)::geography,
    5000  -- 5 km radius
);
```

### Containment and Intersection

```sql
-- Check if point is inside polygon
SELECT * FROM delivery_zones
WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326));

-- Check if geometries intersect
SELECT a.name, b.name
FROM parks a, flood_zones b
WHERE ST_Intersects(a.boundary, b.boundary);

-- Check if geometry is within another
SELECT * FROM stores
WHERE ST_Within(location, (SELECT boundary FROM cities WHERE name = 'New York'));
```

### Area and Length

```sql
-- Area in square meters (transform to projected CRS first)
SELECT name, ST_Area(ST_Transform(boundary, 32618)) AS area_sq_m
FROM regions;

-- Area using geography type (returns square meters directly)
SELECT name, ST_Area(boundary::geography) AS area_sq_m
FROM regions;

-- Length of a linestring in meters
SELECT name, ST_Length(route::geography) AS length_m
FROM trails;
```

### Buffer

```sql
-- Buffer around a point (geometry in degrees -- not useful)
-- Instead, use geography or transform:
SELECT ST_Buffer(
    ST_Transform(ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326), 32618),
    1000  -- 1 km buffer in meters
) AS buffer_geom;

-- Buffer with geography (returns geography, distance in meters)
SELECT ST_Buffer(
    ST_MakePoint(-73.9857, 40.7484)::geography,
    1000  -- 1 km
) AS buffer_geog;
```

### Construction Functions

```sql
-- Point
SELECT ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326);

-- Line from points
SELECT ST_MakeLine(
    ST_MakePoint(-73.9857, 40.7484),
    ST_MakePoint(-118.2437, 34.0522)
);

-- Polygon from text
SELECT ST_GeomFromText(
    'POLYGON((-73.98 40.75, -73.97 40.75, -73.97 40.74, -73.98 40.74, -73.98 40.75))',
    4326
);

-- Centroid
SELECT ST_Centroid(boundary) FROM regions;

-- Envelope (bounding box as geometry)
SELECT ST_Envelope(boundary) FROM regions;
```
</common_st_functions>

<distance_queries>
## Distance Queries

### ST_DWithin (Indexed)

Always prefer `ST_DWithin` for proximity searches. It uses spatial indexes and is orders
of magnitude faster than filtering on `ST_Distance`.

```sql
-- Find stores within 5 km of a point (geography -- meters)
SELECT id, name,
    ST_Distance(location, ST_MakePoint(-73.9857, 40.7484)::geography) AS dist_m
FROM stores
WHERE ST_DWithin(
    location,
    ST_MakePoint(-73.9857, 40.7484)::geography,
    5000
)
ORDER BY dist_m;
```

### ST_Distance (Not Indexed)

Use only when already filtering by another indexed condition. Never use
`WHERE ST_Distance(...) < X` as the primary filter.

```sql
-- BAD: full table scan
SELECT * FROM stores
WHERE ST_Distance(location, ST_MakePoint(-73.9857, 40.7484)::geography) < 5000;

-- GOOD: indexed proximity filter
SELECT * FROM stores
WHERE ST_DWithin(location, ST_MakePoint(-73.9857, 40.7484)::geography, 5000);
```

### Distance with Sorting

```sql
-- Find 10 nearest stores with distance
SELECT id, name,
    ST_Distance(location, ref_point) AS distance_m
FROM stores,
    LATERAL (SELECT ST_MakePoint(-73.9857, 40.7484)::geography AS ref_point) ref
WHERE ST_DWithin(location, ref_point, 10000)
ORDER BY distance_m
LIMIT 10;
```
</distance_queries>

<geojson>
## GeoJSON Handling

### Export to GeoJSON

```sql
-- Single geometry to GeoJSON
SELECT ST_AsGeoJSON(location) FROM stores WHERE id = 1;
-- Returns: {"type":"Point","coordinates":[-73.9857,40.7484]}

-- Full GeoJSON Feature
SELECT json_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(location)::json,
    'properties', json_build_object('name', name, 'id', id)
) FROM stores WHERE id = 1;

-- GeoJSON FeatureCollection
SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', json_agg(
        json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(location)::json,
            'properties', json_build_object('name', name)
        )
    )
) FROM stores;

-- Control coordinate precision (6 decimal places ~ 0.1m accuracy)
SELECT ST_AsGeoJSON(location, 6) FROM stores;
```

### Import from GeoJSON

```sql
-- GeoJSON string to geometry
INSERT INTO regions (name, boundary)
VALUES (
    'Test Zone',
    ST_SetSRID(
        ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-73.98,40.75],[-73.97,40.75],[-73.97,40.74],[-73.98,40.74],[-73.98,40.75]]]}'),
        4326
    )
);

-- From a JSONB column
UPDATE regions
SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(geojson_data::text), 4326)
WHERE id = 1;
```
</geojson>

<spatial_joins>
## Spatial Joins

### ST_Intersects Join

```sql
-- Find which zone each store belongs to
SELECT s.name AS store, z.name AS zone
FROM stores s
JOIN delivery_zones z ON ST_Intersects(z.boundary, s.location::geometry);

-- Count stores per zone
SELECT z.name, COUNT(s.id) AS store_count
FROM delivery_zones z
LEFT JOIN stores s ON ST_Intersects(z.boundary, s.location::geometry)
GROUP BY z.name;
```

### ST_Contains Join

```sql
-- Points within polygons
SELECT c.name AS city, COUNT(e.id) AS event_count
FROM cities c
LEFT JOIN events e ON ST_Contains(c.boundary, e.location)
GROUP BY c.name;
```

### Performance Tip

Always ensure spatial indexes exist on both sides of a spatial join. For large datasets,
consider adding a bounding box pre-filter with `&&`:

```sql
SELECT a.name, b.name
FROM large_polygons a
JOIN large_polygons b ON a.boundary && b.boundary
    AND ST_Intersects(a.boundary, b.boundary)
WHERE a.id != b.id;
```
</spatial_joins>

<bounding_box>
## Bounding Box Queries

### && Operator

The `&&` operator tests if bounding boxes overlap. It is extremely fast because it only
uses the index without computing actual geometry intersection.

```sql
-- Fast bounding box overlap check
SELECT * FROM regions
WHERE boundary && ST_MakeEnvelope(-74.0, 40.7, -73.9, 40.8, 4326);

-- Combine with precise check for accuracy
SELECT * FROM regions
WHERE boundary && ST_MakeEnvelope(-74.0, 40.7, -73.9, 40.8, 4326)
    AND ST_Intersects(boundary, ST_MakeEnvelope(-74.0, 40.7, -73.9, 40.8, 4326));
```

### ST_MakeEnvelope

```sql
-- Create a bounding box (xmin, ymin, xmax, ymax, srid)
SELECT ST_MakeEnvelope(-74.0, 40.7, -73.9, 40.8, 4326);

-- Use for viewport queries (map tiles)
SELECT id, name, ST_AsGeoJSON(location) AS geojson
FROM stores
WHERE location::geometry && ST_MakeEnvelope(:west, :south, :east, :north, 4326);
```
</bounding_box>

<nearest_neighbor>
## Nearest Neighbor Queries

### KNN GiST with <-> Operator

The `<->` operator computes distance and uses the GiST index for efficient nearest
neighbor searches. It must appear in the `ORDER BY` clause to trigger the index scan.

```sql
-- Find 5 nearest stores to a point
SELECT id, name,
    ST_Distance(location, ST_MakePoint(-73.9857, 40.7484)::geography) AS dist_m
FROM stores
ORDER BY location <-> ST_MakePoint(-73.9857, 40.7484)::geography
LIMIT 5;
```

**Important**: Since PostGIS 2.2, `<->` returns true distance for both geometry and
geography (index-backed KNN ordering matches `ST_Distance`). Include `ST_Distance` in the
SELECT when the actual distance value is needed in the results.

### KNN with Distance Cutoff

```sql
-- Nearest 10 within 5 km
SELECT id, name,
    ST_Distance(location, ref) AS dist_m
FROM stores,
    LATERAL (SELECT ST_MakePoint(-73.9857, 40.7484)::geography AS ref) r
WHERE ST_DWithin(location, ref, 5000)
ORDER BY location <-> ref
LIMIT 10;
```

### KNN with Geometry (Projected CRS)

```sql
-- More accurate KNN with projected coordinates
SELECT id, name,
    ST_Distance(
        ST_Transform(location::geometry, 32618),
        ST_Transform(ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326), 32618)
    ) AS dist_m
FROM stores
ORDER BY location <-> ST_MakePoint(-73.9857, 40.7484)::geography
LIMIT 10;
```
</nearest_neighbor>

<performance>
## Performance Considerations

### Geography vs Geometry for Distance

| Aspect            | Geography          | Geometry (4326)      | Geometry (projected) |
|-------------------|--------------------|----------------------|----------------------|
| Distance accuracy | Spheroidal (exact) | Cartesian (wrong)    | Cartesian (accurate) |
| Distance units    | Meters             | Degrees              | Meters               |
| Index support     | GiST               | GiST, SP-GiST       | GiST, SP-GiST       |
| Function coverage | Limited            | Full                 | Full                 |
| Speed             | Slower             | Fastest              | Fast                 |

### Index Usage Checklist

- Always create GiST indexes on spatial columns
- Use `EXPLAIN ANALYZE` to verify index usage
- `ST_DWithin` uses indexes; `ST_Distance < X` does not
- `&&` (bounding box) uses indexes and is the fastest filter
- `<->` in `ORDER BY` uses KNN GiST index
- `ST_Contains` and `ST_Intersects` use indexes when one argument is a column and the
  other is a constant or parameter

### Query Optimization Patterns

```sql
-- Pattern 1: Pre-filter with bounding box, refine with exact test
SELECT * FROM regions
WHERE boundary && ST_Buffer(query_point, radius)
    AND ST_DWithin(boundary::geography, query_point::geography, radius_meters);

-- Pattern 2: Cluster spatial data for sequential scans
CLUSTER stores USING idx_stores_location;

-- Pattern 3: Analyze after bulk inserts
ANALYZE stores;

-- Pattern 4: Use partial indexes for hot data
CREATE INDEX idx_active_stores_loc
    ON stores USING GIST (location)
    WHERE deleted_at IS NULL;
```

### Vacuum and Statistics

```sql
-- Update planner statistics for spatial columns
ANALYZE stores (location);

-- Check index size
SELECT pg_size_pretty(pg_relation_size('idx_stores_location'));
```
</performance>
