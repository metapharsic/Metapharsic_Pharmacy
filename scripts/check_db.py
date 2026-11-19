import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/pharmacare_dev')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM sales')
print('Sales Count:', cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM purchases')
print('Purchases Count:', cur.fetchone()[0])
cur.execute('SELECT "invoiceNumber", "totalAmount" FROM sales ORDER BY "createdAt" DESC LIMIT 5')
print('Recent Sales:', cur.fetchall())
cur.execute('SELECT "invoiceNumber", "totalAmount" FROM purchases ORDER BY "createdAt" DESC LIMIT 5')
print('Recent Purchases:', cur.fetchall())
cur.execute('SELECT name, gstin FROM suppliers')
print('Suppliers:', cur.fetchall())
cur.execute('SELECT name, phone FROM customers LIMIT 5')
print('Customers:', cur.fetchall())
cur.execute('SELECT name, "genericName" FROM products')
print('Products in DB:', cur.fetchall())

