import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/pharmacare_dev")
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("""
    SELECT name, sku, "tabsPerStrip", mrp, ptr, "costPrice"
    FROM products
    WHERE name IN ('Metace-SP', 'Metacef-200', 'Metace-P');
""")
for r in cur.fetchall():
    print("PRODUCT:", dict(r))

cur.execute("""
    SELECT b."batchNumber", p.name, b.quantity, b.mrp, b."purchasePrice"
    FROM batches b
    JOIN products p ON b."productId" = p.id
    WHERE p.name IN ('Metace-SP', 'Metacef-200', 'Metace-P');
""")
for r in cur.fetchall():
    print("BATCH:", dict(r))

cur.close()
conn.close()

