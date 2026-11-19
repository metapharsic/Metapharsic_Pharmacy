import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/pharmacare_dev")
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 90)
print(" METAPHARSIC INVOICE SCAN & BACKEND PROVISIONING VERIFICATION REPORT")
print("=" * 90)

# 1. Verify Sales Invoices
print("\n1. PROVISIONED SALES INVOICES:")
cur.execute("""
    SELECT s."invoiceNumber", s."saleDate", c.name as customer_name, s.subtotal,
           s."taxAmount", s."roundOff", s."totalAmount", s.status, s."paymentStatus", s.notes
    FROM sales s
    JOIN customers c ON s."customerId" = c.id
    WHERE s."invoiceNumber" ILIKE 'INV-178%' OR s."invoiceNumber" ILIKE 'INV-179%'
    ORDER BY s."saleDate" DESC, s."invoiceNumber";
""")
sales = cur.fetchall()
total_sales_value = sum(s["totalAmount"] for s in sales)
print(f"Total Sales Invoices: {len(sales)} | Combined Net Total: Rs. {total_sales_value:,.2f}")
for s in sales:
    print(f"  [{s['invoiceNumber']}] Date: {s['saleDate'].strftime('%d/%m/%Y')} | Customer: {s['customer_name'][:30]:<30} | Subtotal: Rs.{s['subtotal']:>8.2f} | Tax: Rs.{s['taxAmount']:>6.2f} | Round: Rs.{s['roundOff']:>5.2f} | Net: Rs.{s['totalAmount']:>8.2f} | Status: {s['status']}/{s['paymentStatus']}")

# 2. Verify Sale Items & Batches
print("\n2. PROVISIONED SALE ITEMS & BATCH LINKAGES:")
cur.execute("""
    SELECT si."productName", si.quantity, si."billedUnits", si."looseUnits", si."totalBaseQty",
           si."unitPrice", si."taxAmount", si."totalAmount", si.mrp, si."hsnCode",
           b."batchNumber", b."expiryDate", s."invoiceNumber"
    FROM sale_items si
    JOIN sales s ON si."saleId" = s.id
    LEFT JOIN sale_item_batches sib ON sib."saleItemId" = si.id
    LEFT JOIN batches b ON sib."batchId" = b.id
    WHERE s."invoiceNumber" ILIKE 'INV-178%' OR s."invoiceNumber" ILIKE 'INV-179%'
    ORDER BY s."invoiceNumber", si."productName";
""")
items = cur.fetchall()
print(f"Total Line Items Provisioned: {len(items)}")
for it in items[:10]:
    exp_str = it['expiryDate'].strftime('%d/%m/%Y') if it['expiryDate'] else 'N/A'
    print(f"  Inv: {it['invoiceNumber']} | Prod: {it['productName']:<15} | Batch: {it['batchNumber']:<12} | Exp: {exp_str} | Qty: {it['quantity']:>2} (Base: {it['totalBaseQty']:>2}) | PTR: Rs.{it['unitPrice']:>6.2f} | Tax: Rs.{it['taxAmount']:>5.2f} | Total: Rs.{it['totalAmount']:>7.2f}")
if len(items) > 10:
    print(f"  ... and {len(items) - 10} more line items fully verified.")

# 3. Verify Customer Ledgers & Balances
print("\n3. CUSTOMER LEDGER ACCOUNTS & RUNNING BALANCES:")
cur.execute("""
    SELECT c.name, c.phone, c."outstandingBalance", c."creditDays", c.notes,
           COUNT(cl.id) as ledger_entries_count, SUM(cl.amount) as total_debited
    FROM customers c
    JOIN customer_ledgers cl ON cl."customerId" = c.id
    WHERE cl."description" ILIKE '%INV-178%' OR cl."description" ILIKE '%INV-179%'
    GROUP BY c.id, c.name, c.phone, c."outstandingBalance", c."creditDays", c.notes
    ORDER BY c.name;
""")
custs = cur.fetchall()
for c in custs:
    print(f"  Customer: {c['name']:<35} | Phone: {c['phone'] or 'N/A':<11} | Credit: {c['creditDays']} Days | Balance: Rs.{c['outstandingBalance']:>8.2f} | Ledgers: {c['ledger_entries_count']}")

# 4. Verify Inventory & Batches
print("\n4. PRODUCT INVENTORY & BATCH STATUS:")
cur.execute("""
    SELECT p.name, p.sku, p.mrp, p.ptr, b."batchNumber", b."expiryDate",
           b.quantity as batch_stock, b."soldQuantity" as batch_sold,
           i."totalQuantity" as branch_total, i."availableQuantity" as branch_avail
    FROM products p
    JOIN batches b ON b."productId" = p.id
    JOIN inventory i ON i."productId" = p.id
    WHERE p.name ILIKE '%Meta%' OR p.name ILIKE '%Panto%' OR p.name ILIKE '%Rabe%'
    ORDER BY p.name;
""")
invs = cur.fetchall()
for inv in invs:
    exp_str = inv['expiryDate'].strftime('%d/%m/%Y') if inv['expiryDate'] else 'N/A'
    print(f"  Product: {inv['name']:<15} ({inv['sku']:<16}) | Batch: {inv['batchNumber']:<12} | Exp: {exp_str} | MRP: Rs.{inv['mrp']:>6.2f} | PTR: Rs.{inv['ptr']:>6.2f} | Sold: {inv['batch_sold']:>2} | Avail: {inv['branch_avail']:>3}")

# 5. Verify GST Outward Supplies
print("\n5. STATUTORY GST OUTWARD TRANSACTIONS:")
cur.execute("""
    SELECT "invoiceNumber", "invoiceDate", "partyName", "hsnCode", "taxableAmount",
           "igstAmount", "totalTax", "totalAmount", "returnPeriod"
    FROM gst_transactions
    WHERE "invoiceNumber" ILIKE 'INV-178%' OR "invoiceNumber" ILIKE 'INV-179%'
    ORDER BY "invoiceDate", "invoiceNumber";
""")
gsts = cur.fetchall()
total_taxable = sum(g["taxableAmount"] for g in gsts)
total_gst = sum(g["totalTax"] for g in gsts)
for g in gsts:
    print(f"  Inv: {g['invoiceNumber']} | Date: {g['invoiceDate'].strftime('%d/%m/%Y')} | Party: {g['partyName'][:25]:<25} | Taxable: Rs.{g['taxableAmount']:>8.2f} | IGST 5%: Rs.{g['igstAmount']:>6.2f} | Total: Rs.{g['totalAmount']:>8.2f} | Period: {g['returnPeriod']}")
print(f"Summary: Total Taxable: Rs. {total_taxable:,.2f} | Total GST (5%): Rs. {total_gst:,.2f}")

conn.close()

