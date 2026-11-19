--
-- PostgreSQL database dump
--

\restrict SR6bFAosxKpEOKjbs0N0oJ2cVJo9AwagelBttiQ7sz3QGMG3TYAyBBx5K8I2fTA

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AdjustmentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AdjustmentStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."AdjustmentStatus" OWNER TO postgres;

--
-- Name: AdjustmentType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AdjustmentType" AS ENUM (
    'PHYSICAL_COUNT',
    'DAMAGE',
    'THEFT',
    'EXPIRY',
    'CORRECTION',
    'OPENING_STOCK'
);


ALTER TYPE public."AdjustmentType" OWNER TO postgres;

--
-- Name: BatchStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BatchStatus" AS ENUM (
    'ACTIVE',
    'BLOCKED',
    'EXPIRED',
    'DISPOSED',
    'EXHAUSTED'
);


ALTER TYPE public."BatchStatus" OWNER TO postgres;

--
-- Name: BillRefType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BillRefType" AS ENUM (
    'AGST_REF',
    'ADVANCE',
    'ON_ACCOUNT',
    'NEW_REF'
);


ALTER TYPE public."BillRefType" OWNER TO postgres;

--
-- Name: CreditNoteStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."CreditNoteStatus" AS ENUM (
    'ACTIVE',
    'PARTIALLY_USED',
    'FULLY_USED',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."CreditNoteStatus" OWNER TO postgres;

--
-- Name: DisposalReason; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DisposalReason" AS ENUM (
    'EXPIRED',
    'DAMAGED',
    'RECALLED',
    'CONTAMINATED',
    'OTHER'
);


ALTER TYPE public."DisposalReason" OWNER TO postgres;

--
-- Name: DrugSchedule; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DrugSchedule" AS ENUM (
    'NONE',
    'H',
    'H1',
    'X',
    'G',
    'J'
);


ALTER TYPE public."DrugSchedule" OWNER TO postgres;

--
-- Name: EntryType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EntryType" AS ENUM (
    'DR',
    'CR'
);


ALTER TYPE public."EntryType" OWNER TO postgres;

--
-- Name: GstTxType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."GstTxType" AS ENUM (
    'B2B',
    'B2C',
    'EXPORT',
    'NIL_RATED'
);


ALTER TYPE public."GstTxType" OWNER TO postgres;

--
-- Name: LedgerEntryType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LedgerEntryType" AS ENUM (
    'DEBIT',
    'CREDIT'
);


ALTER TYPE public."LedgerEntryType" OWNER TO postgres;

--
-- Name: LedgerType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LedgerType" AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'INCOME',
    'EXPENSE'
);


ALTER TYPE public."LedgerType" OWNER TO postgres;

--
-- Name: MovementType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MovementType" AS ENUM (
    'IN',
    'OUT',
    'ADJUSTMENT',
    'RETURN_IN',
    'RETURN_OUT',
    'TRANSFER',
    'WRITE_OFF'
);


ALTER TYPE public."MovementType" OWNER TO postgres;

--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."NotificationType" AS ENUM (
    'LOW_STOCK',
    'EXPIRY_ALERT',
    'PURCHASE_DUE',
    'PAYMENT_DUE',
    'PRESCRIPTION_PENDING',
    'SYSTEM',
    'INFO'
);


ALTER TYPE public."NotificationType" OWNER TO postgres;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'CARD',
    'UPI',
    'NETBANKING',
    'CHEQUE',
    'CREDIT',
    'WALLET'
);


ALTER TYPE public."PaymentMethod" OWNER TO postgres;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PAID',
    'PARTIAL',
    'CREDIT',
    'OVERPAID'
);


ALTER TYPE public."PaymentStatus" OWNER TO postgres;

--
-- Name: PrescriptionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PrescriptionStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'DISPENSED',
    'EXPIRED'
);


ALTER TYPE public."PrescriptionStatus" OWNER TO postgres;

--
-- Name: PurchaseReturnStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PurchaseReturnStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'DISPATCHED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."PurchaseReturnStatus" OWNER TO postgres;

--
-- Name: PurchaseStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PurchaseStatus" AS ENUM (
    'DRAFT',
    'ORDERED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'INVOICED',
    'CANCELLED'
);


ALTER TYPE public."PurchaseStatus" OWNER TO postgres;

--
-- Name: RestockDecision; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RestockDecision" AS ENUM (
    'RESTOCK',
    'QUARANTINE',
    'DAMAGE_WRITE_OFF'
);


ALTER TYPE public."RestockDecision" OWNER TO postgres;

--
-- Name: SaleReturnStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SaleReturnStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REFUNDED',
    'CREDITED',
    'REJECTED'
);


ALTER TYPE public."SaleReturnStatus" OWNER TO postgres;

--
-- Name: SaleStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SaleStatus" AS ENUM (
    'COMPLETED',
    'CANCELLED',
    'PARTIALLY_RETURNED',
    'FULLY_RETURNED'
);


ALTER TYPE public."SaleStatus" OWNER TO postgres;

--
-- Name: VoucherType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."VoucherType" AS ENUM (
    'RECEIPT',
    'PAYMENT',
    'JOURNAL',
    'CONTRA'
);


ALTER TYPE public."VoucherType" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text,
    "oldData" jsonb,
    "newData" jsonb,
    "ipAddress" text,
    "userAgent" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: batch_disposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batch_disposals (
    id text NOT NULL,
    "batchId" text NOT NULL,
    quantity integer NOT NULL,
    reason public."DisposalReason" NOT NULL,
    notes text,
    "disposedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.batch_disposals OWNER TO postgres;

--
-- Name: batch_status_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batch_status_log (
    id text NOT NULL,
    "batchId" text NOT NULL,
    "fromStatus" public."BatchStatus" NOT NULL,
    "toStatus" public."BatchStatus" NOT NULL,
    reason text,
    "changedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.batch_status_log OWNER TO postgres;

--
-- Name: batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batches (
    id text NOT NULL,
    "productId" text NOT NULL,
    "batchNumber" text NOT NULL,
    "manufacturingDate" timestamp(3) without time zone,
    "expiryDate" timestamp(3) without time zone NOT NULL,
    "purchasePrice" numeric(12,2) NOT NULL,
    mrp numeric(12,2) NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    "reservedQuantity" integer DEFAULT 0 NOT NULL,
    "soldQuantity" integer DEFAULT 0 NOT NULL,
    status public."BatchStatus" DEFAULT 'ACTIVE'::public."BatchStatus" NOT NULL,
    "blockedReason" text,
    "supplierRef" text,
    "purchaseId" text,
    "branchId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.batches OWNER TO postgres;

--
-- Name: bill_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bill_allocations (
    id text NOT NULL,
    voucher_entry_id text NOT NULL,
    invoice_id text,
    allocated_amount numeric(15,2) NOT NULL,
    ref_type public."BillRefType" NOT NULL,
    ref_number text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.bill_allocations OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    code text,
    gstin text,
    "dlNumber" text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    pincode text,
    "isHeadOffice" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "invoicePrefix" text DEFAULT 'INV'::text NOT NULL,
    "invoiceCounter" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "parentId" text,
    "imageUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_notes (
    id text NOT NULL,
    "noteNumber" text NOT NULL,
    "saleReturnId" text NOT NULL,
    "customerId" text,
    amount numeric(12,2) NOT NULL,
    "balanceUsed" numeric(12,2) DEFAULT 0 NOT NULL,
    status public."CreditNoteStatus" DEFAULT 'ACTIVE'::public."CreditNoteStatus" NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.credit_notes OWNER TO postgres;

--
-- Name: customer_ledgers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_ledgers (
    id text NOT NULL,
    "customerId" text NOT NULL,
    type public."LedgerEntryType" NOT NULL,
    amount numeric(12,2) NOT NULL,
    balance numeric(12,2) NOT NULL,
    "referenceType" text,
    "referenceId" text,
    description text NOT NULL,
    "entryDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.customer_ledgers OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    gstin text,
    address text,
    city text,
    state text,
    pincode text,
    "creditLimit" numeric(12,2) DEFAULT 0 NOT NULL,
    "outstandingBalance" numeric(12,2) DEFAULT 0 NOT NULL,
    "creditDays" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "discountTier" text,
    "patientDiscountPercent" numeric(5,2) DEFAULT 0
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: doctor_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_commissions (
    id text NOT NULL,
    "doctorId" text NOT NULL,
    "saleId" text NOT NULL,
    "saleAmount" numeric(12,2) NOT NULL,
    "commissionPercent" numeric(5,2) NOT NULL,
    "commissionAmount" numeric(12,2) NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "paymentReference" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.doctor_commissions OWNER TO postgres;

--
-- Name: doctors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctors (
    id text NOT NULL,
    name text NOT NULL,
    specialization text,
    "clinicName" text,
    phone text,
    email text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "commissionPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    notes text,
    qualification text,
    "regNumber" text
);


ALTER TABLE public.doctors OWNER TO postgres;

--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id text NOT NULL,
    "fileName" text NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text NOT NULL,
    size integer NOT NULL,
    url text NOT NULL,
    path text,
    "uploadedById" text,
    "entityType" text,
    "entityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: gst_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gst_transactions (
    id text NOT NULL,
    "branchId" text NOT NULL,
    type public."GstTxType" NOT NULL,
    "referenceType" text NOT NULL,
    "referenceId" text NOT NULL,
    "invoiceNumber" text NOT NULL,
    "invoiceDate" timestamp(3) without time zone NOT NULL,
    "partyGstin" text,
    "partyName" text,
    "partyState" text,
    "hsnCode" text,
    "taxableAmount" numeric(12,2) NOT NULL,
    "cgstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalTax" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "returnPeriod" text,
    "isFiled" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.gst_transactions OWNER TO postgres;

--
-- Name: held_bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.held_bills (
    id text NOT NULL,
    "branchId" text NOT NULL,
    "userId" text NOT NULL,
    label text,
    "cartData" jsonb NOT NULL,
    "customerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.held_bills OWNER TO postgres;

--
-- Name: hsn_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hsn_codes (
    id text NOT NULL,
    code text NOT NULL,
    description text NOT NULL,
    "gstRate" numeric(5,2) NOT NULL,
    "cgstRate" numeric(5,2) NOT NULL,
    "sgstRate" numeric(5,2) NOT NULL,
    "igstRate" numeric(5,2) NOT NULL,
    "cessRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.hsn_codes OWNER TO postgres;

--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id text NOT NULL,
    "productId" text NOT NULL,
    "branchId" text NOT NULL,
    "totalQuantity" integer DEFAULT 0 NOT NULL,
    "reservedQuantity" integer DEFAULT 0 NOT NULL,
    "availableQuantity" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_movements (
    id text NOT NULL,
    "inventoryId" text NOT NULL,
    type public."MovementType" NOT NULL,
    quantity integer NOT NULL,
    "quantityBefore" integer NOT NULL,
    "quantityAfter" integer NOT NULL,
    "referenceType" text,
    "referenceId" text,
    "batchId" text,
    notes text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.inventory_movements OWNER TO postgres;

--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledger_entries (
    id text NOT NULL,
    "ledgerId" text NOT NULL,
    type public."LedgerEntryType" NOT NULL,
    amount numeric(15,2) NOT NULL,
    balance numeric(15,2) NOT NULL,
    description text NOT NULL,
    "referenceType" text,
    "referenceId" text,
    "entryDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ledger_entries OWNER TO postgres;

--
-- Name: ledgers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledgers (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type public."LedgerType" NOT NULL,
    "parentId" text,
    "isSystem" boolean DEFAULT false NOT NULL,
    balance numeric(15,2) DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "group" text
);


ALTER TABLE public.ledgers OWNER TO postgres;

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id text NOT NULL,
    "userId" text NOT NULL,
    "lowStock" boolean DEFAULT true NOT NULL,
    expiry boolean DEFAULT true NOT NULL,
    payment boolean DEFAULT true NOT NULL,
    system boolean DEFAULT true NOT NULL,
    "emailAlerts" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_settings (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    "legalName" text,
    gstin text,
    pan text,
    "dlNumber" text,
    email text,
    phone text,
    website text,
    "logoUrl" text,
    address text,
    city text,
    state text,
    pincode text,
    country text DEFAULT 'India'::text NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    "financialYearStart" integer DEFAULT 4 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    token text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id text NOT NULL,
    "saleId" text,
    "customerId" text,
    "supplierId" text,
    "purchaseId" text,
    method public."PaymentMethod" NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference text,
    notes text,
    "paymentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    module text NOT NULL,
    action text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: prescription_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescription_images (
    id text NOT NULL,
    "prescriptionId" text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.prescription_images OWNER TO postgres;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescriptions (
    id text NOT NULL,
    "prescriptionNumber" text,
    "patientName" text NOT NULL,
    "patientAge" integer,
    "patientPhone" text,
    "doctorName" text,
    "doctorRegNumber" text,
    "prescriptionDate" timestamp(3) without time zone,
    notes text,
    status public."PrescriptionStatus" DEFAULT 'PENDING'::public."PrescriptionStatus" NOT NULL,
    "approvedById" text,
    "approvedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "customerId" text,
    "branchId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "doctorId" text
);


ALTER TABLE public.prescriptions OWNER TO postgres;

--
-- Name: product_barcodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_barcodes (
    id text NOT NULL,
    "productId" text NOT NULL,
    barcode text NOT NULL,
    type text DEFAULT 'EAN13'::text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.product_barcodes OWNER TO postgres;

--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_categories (
    id text NOT NULL,
    "productId" text NOT NULL,
    "categoryId" text NOT NULL
);


ALTER TABLE public.product_categories OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id text NOT NULL,
    name text NOT NULL,
    "genericName" text,
    sku text NOT NULL,
    barcode text,
    description text,
    manufacturer text,
    composition text,
    "drugSchedule" public."DrugSchedule" DEFAULT 'NONE'::public."DrugSchedule" NOT NULL,
    "isPrescriptionRequired" boolean DEFAULT false NOT NULL,
    "unitOfMeasure" text DEFAULT 'Strip'::text NOT NULL,
    "tabsPerStrip" integer,
    "packSize" text,
    "hsnCode" text,
    "gstRate" numeric(5,2) DEFAULT 12.00 NOT NULL,
    "cgstRate" numeric(5,2) DEFAULT 6.00 NOT NULL,
    "sgstRate" numeric(5,2) DEFAULT 6.00 NOT NULL,
    "igstRate" numeric(5,2) DEFAULT 12.00 NOT NULL,
    "isGstExempt" boolean DEFAULT false NOT NULL,
    mrp numeric(12,2) NOT NULL,
    ptr numeric(12,2),
    "costPrice" numeric(12,2),
    "minStockLevel" integer DEFAULT 10 NOT NULL,
    "maxStockLevel" integer,
    "reorderLevel" integer DEFAULT 20 NOT NULL,
    "imageUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "isReturnable" boolean DEFAULT true NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    rack text
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_items (
    id text NOT NULL,
    "purchaseId" text NOT NULL,
    "productId" text NOT NULL,
    "batchId" text,
    "orderedQuantity" integer NOT NULL,
    "receivedQuantity" integer DEFAULT 0 NOT NULL,
    "freeQuantity" integer DEFAULT 0 NOT NULL,
    "unitCost" numeric(12,2) NOT NULL,
    mrp numeric(12,2) NOT NULL,
    ptr numeric(12,2),
    "discountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "batchNumber" text,
    "expiryDate" timestamp(3) without time zone,
    "manufacturingDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_items OWNER TO postgres;

--
-- Name: purchase_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_return_items (
    id text NOT NULL,
    "purchaseReturnId" text NOT NULL,
    "productId" text NOT NULL,
    "batchId" text,
    quantity integer NOT NULL,
    "unitCost" numeric(12,2) NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    reason text
);


ALTER TABLE public.purchase_return_items OWNER TO postgres;

--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_returns (
    id text NOT NULL,
    "returnNumber" text NOT NULL,
    "purchaseId" text NOT NULL,
    "supplierId" text NOT NULL,
    "returnDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason text NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    status public."PurchaseReturnStatus" DEFAULT 'PENDING'::public."PurchaseReturnStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_returns OWNER TO postgres;

--
-- Name: purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchases (
    id text NOT NULL,
    "purchaseNumber" text NOT NULL,
    "branchId" text NOT NULL,
    "supplierId" text NOT NULL,
    "invoiceNumber" text,
    "invoiceDate" timestamp(3) without time zone,
    "purchaseDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expectedDate" timestamp(3) without time zone,
    status public."PurchaseStatus" DEFAULT 'DRAFT'::public."PurchaseStatus" NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "amountPaid" numeric(12,2) DEFAULT 0 NOT NULL,
    "balanceDue" numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    "receivedAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.purchases OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: sale_item_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_item_batches (
    id text NOT NULL,
    "saleItemId" text NOT NULL,
    "batchId" text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL
);


ALTER TABLE public.sale_item_batches OWNER TO postgres;

--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_items (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "productId" text NOT NULL,
    "productName" text NOT NULL,
    "productSku" text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    "discountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "taxPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "cgstPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "sgstPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "igstPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    mrp numeric(12,2) NOT NULL,
    "hsnCode" text,
    "returnedQuantity" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sale_items OWNER TO postgres;

--
-- Name: sale_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_return_items (
    id text NOT NULL,
    "saleReturnId" text NOT NULL,
    "saleItemId" text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "restockDecision" public."RestockDecision" DEFAULT 'RESTOCK'::public."RestockDecision" NOT NULL,
    "batchId" text
);


ALTER TABLE public.sale_return_items OWNER TO postgres;

--
-- Name: sale_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_returns (
    id text NOT NULL,
    "returnNumber" text NOT NULL,
    "saleId" text NOT NULL,
    "customerId" text,
    "returnDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason text NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    status public."SaleReturnStatus" DEFAULT 'PENDING'::public."SaleReturnStatus" NOT NULL,
    "refundMethod" public."PaymentMethod",
    "refundRef" text,
    notes text,
    "processedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sale_returns OWNER TO postgres;

--
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    id text NOT NULL,
    "invoiceNumber" text NOT NULL,
    "branchId" text NOT NULL,
    "customerId" text,
    "prescriptionId" text,
    "saleDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "discountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "amountPaid" numeric(12,2) DEFAULT 0 NOT NULL,
    "balanceDue" numeric(12,2) DEFAULT 0 NOT NULL,
    status public."SaleStatus" DEFAULT 'COMPLETED'::public."SaleStatus" NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'PAID'::public."PaymentStatus" NOT NULL,
    notes text,
    "createdById" text NOT NULL,
    "cancelledAt" timestamp(3) without time zone,
    "cancelledReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "billDiscountPercent" numeric(5,2) DEFAULT 0,
    "doctorCommissionAmount" numeric(12,2),
    "doctorCommissionPercent" numeric(5,2),
    "doctorId" text,
    "doctorName" text,
    "roundOff" numeric(6,2) DEFAULT 0
);


ALTER TABLE public.sales OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_adjustments (
    id text NOT NULL,
    "branchId" text NOT NULL,
    "productId" text NOT NULL,
    "batchId" text,
    "adjustmentType" public."AdjustmentType" NOT NULL,
    quantity integer NOT NULL,
    reason text NOT NULL,
    notes text,
    status public."AdjustmentStatus" DEFAULT 'PENDING'::public."AdjustmentStatus" NOT NULL,
    "approvedById" text,
    "approvedAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.stock_adjustments OWNER TO postgres;

--
-- Name: supplier_ledgers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_ledgers (
    id text NOT NULL,
    "supplierId" text NOT NULL,
    type public."LedgerEntryType" NOT NULL,
    amount numeric(12,2) NOT NULL,
    balance numeric(12,2) NOT NULL,
    "referenceType" text,
    "referenceId" text,
    description text NOT NULL,
    "entryDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.supplier_ledgers OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    name text NOT NULL,
    "contactPerson" text,
    phone text,
    email text,
    gstin text,
    pan text,
    "dlNumber" text,
    address text,
    city text,
    state text,
    pincode text,
    "bankName" text,
    "bankAccount" text,
    "bankIfsc" text,
    "creditDays" integer DEFAULT 30 NOT NULL,
    "outstandingBalance" numeric(12,2) DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id text NOT NULL,
    category text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "dataType" text DEFAULT 'string'::text NOT NULL,
    label text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: tax_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_rates (
    id text NOT NULL,
    name text NOT NULL,
    rate numeric(5,2) NOT NULL,
    cgst numeric(5,2) NOT NULL,
    sgst numeric(5,2) NOT NULL,
    igst numeric(5,2) NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tax_rates OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id text NOT NULL,
    "userId" text NOT NULL,
    "roleId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    password text,
    image text,
    phone text,
    "isActive" boolean DEFAULT true NOT NULL,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "failedLoginCount" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "branchId" text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.verification_tokens OWNER TO postgres;

--
-- Name: voucher_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.voucher_entries (
    id text NOT NULL,
    voucher_id text NOT NULL,
    ledger_id text,
    customer_id text,
    entry_type public."EntryType" NOT NULL,
    amount numeric(15,2) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.voucher_entries OWNER TO postgres;

--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vouchers (
    id text NOT NULL,
    voucher_no text NOT NULL,
    voucher_type public."VoucherType" DEFAULT 'RECEIPT'::public."VoucherType" NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    narration text,
    branch_id text,
    created_by_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.vouchers OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
171aabeb-fb20-4753-8f51-95b7455f02c8	3b399fc7c76481356977573bf46f9f388eb3b4d17abfc24b165be106da3f23a3	2026-09-19 16:17:57.868307+05:30	20260913103456_init	\N	\N	2026-09-19 16:17:56.515722+05:30	1
9eb5b0ef-3815-4a05-91d8-3c22310f75e9	11aa65e39ded55eaa700e6ac5b3bbe54c9897c1d662fbb39064e92c5ea810cf8	2026-09-19 16:17:57.915432+05:30	20260916133000_gst_transaction_uniqueness	\N	\N	2026-09-19 16:17:57.869437+05:30	1
29134fa8-e936-411f-8930-cf197b0e8db1	6f57ca49545d11ba5bdcbcf02f0ce32f8fa2e2ca6b3fc647452bca81bb3bbde2	2026-09-19 16:17:57.967281+05:30	20260917000000_sprint2_pos_ergonomics	\N	\N	2026-09-19 16:17:57.916554+05:30	1
b298ae15-3988-466d-9f3f-8c30aff7bb86	653a469fe9bc8e405b477c4176869890cfbe9a4a85733c9dd9675e40632549e9	2026-09-19 16:17:57.985196+05:30	20260917101840_add_adjustment_approval_tier_and_evidence	\N	\N	2026-09-19 16:17:57.968112+05:30	1
1c05696c-2f13-41c5-9891-c262135b6cc5	e66362f187159a3cce1dc67c9c96be111c1310d89718b760ab21f1813f01d887	2026-09-19 16:17:57.990423+05:30	20260917104847_add_storage_condition	\N	\N	2026-09-19 16:17:57.986403+05:30	1
c225f9e9-d974-4304-8235-7aabde929e5c	9d2a5f8aad35beca00c4bcad27f4acdf3024a1e4e00eeaf2fbf4e9e3a54ba0fd	2026-09-19 16:17:58.0212+05:30	20260917111602_add_mfa_and_password_history	\N	\N	2026-09-19 16:17:57.991622+05:30	1
2211ad7a-5977-4322-a9b4-8fcaff016331	b432f40e2097046100315f4a10555a6aed0af0d27b80edd060d70aaf6660395e	2026-09-19 16:17:58.146765+05:30	20260917155251_merge_master_compliance_pos_schema_gap	\N	\N	2026-09-19 16:17:58.022222+05:30	1
b9011015-d804-47e9-9f2a-9b263ca08e6f	63e3aab82f4344bc1f8c690c04d36092c5f8331388a4c406c240222a5d6432db	2026-09-19 16:17:58.175101+05:30	20260918120000_d2g_narcotic_register_balance	\N	\N	2026-09-19 16:17:58.147825+05:30	1
12cf7490-677c-4621-9686-0ae664860172	4be95e6667c35b666d6f64f65ce0f5f395d4124901b5680665abb32670184e6d	2026-09-19 16:17:58.184215+05:30	20260918140000_d2a_narcotic_opening_balance	\N	\N	2026-09-19 16:17:58.176513+05:30	1
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, "userId", action, entity, "entityId", "oldData", "newData", "ipAddress", "userAgent", metadata, "createdAt") FROM stdin;
cmuetvegl000po7sa9exxcbyn	cmuet589u00b1mivst65bse94	LOGOUT	User	cmuet589u00b1mivst65bse94	\N	\N	\N	\N	\N	2026-09-24 01:03:00.597
cmueunjvb001do7sayr459yfc	cmuet589u00b1mivst65bse94	LOGOUT	User	cmuet589u00b1mivst65bse94	\N	\N	\N	\N	\N	2026-09-24 01:24:53.975
cmv4zr2ud000134naoulfnxkd	cmuet58zy00b9mivstkq6bi2w	LOGOUT	User	cmuet58zy00b9mivstkq6bi2w	\N	\N	\N	\N	\N	2026-10-12 08:29:37.186
cmvgd08fr000114d09p1gwgf0	cmuet589u00b1mivst65bse94	LOGOUT	User	cmuet589u00b1mivst65bse94	\N	\N	\N	\N	\N	2026-10-20 07:26:07.117
cmvgd08os000314d07ca5nlwg	cmuet589u00b1mivst65bse94	LOGOUT	User	cmuet589u00b1mivst65bse94	\N	\N	\N	\N	\N	2026-10-20 07:26:07.312
cmvgfpss70001nm4kre9bk0jt	cmuet58zy00b9mivstkq6bi2w	LOGOUT	User	cmuet58zy00b9mivstkq6bi2w	\N	\N	\N	\N	\N	2026-10-20 08:41:59.206
cmvgfqsum0003nm4k3dn202ec	cmuet58zy00b9mivstkq6bi2w	LOGOUT	User	cmuet58zy00b9mivstkq6bi2w	\N	\N	\N	\N	\N	2026-10-20 08:42:46.03
cmvgg2vvc0009nm4k7yemq49f	cmuet58n500b5mivs1fu4l3px	CREATE	Product	cmvgg2vu00006nm4kxx0bev39	\N	{"sku": "100", "name": "Metacol"}	\N	\N	\N	2026-10-20 08:52:09.816
cmvgi1vfj005bnm4k8b8hcg5o	cmuet58n500b5mivs1fu4l3px	CREATE	Product	cmvgi1vey0058nm4kfsjlonoo	\N	{"sku": "33", "name": "mrta"}	\N	\N	\N	2026-10-20 09:47:21.823
\.


--
-- Data for Name: batch_disposals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.batch_disposals (id, "batchId", quantity, reason, notes, "disposedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: batch_status_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.batch_status_log (id, "batchId", "fromStatus", "toStatus", reason, "changedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.batches (id, "productId", "batchNumber", "manufacturingDate", "expiryDate", "purchasePrice", mrp, quantity, "reservedQuantity", "soldQuantity", status, "blockedReason", "supplierRef", "purchaseId", "branchId", "createdAt", "updatedAt") FROM stdin;
cmuet59uq00hemivs8e4ymcs2	cmuet59k000cnmivsfjukq8ga	BAT-PCM-500-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	15.00	25.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.57	2026-09-24 00:42:41.57
cmuet59v700hfmivsfu3ht3x9	cmuet59k000cnmivsfjukq8ga	BAT-PCM-500-NEAR	2025-11-28 00:42:41.554	2026-11-08 00:42:41.554	15.00	25.00	20	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.587	2026-09-24 00:42:41.587
cmuet59x400i0mivsjr0sfm3x	cmuet59lx00dfmivs71156gvx	D-120-OUT	2026-06-26 00:42:41.554	2027-09-19 00:42:41.554	26.00	42.00	0	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.657	2026-09-24 00:42:41.657
cmuet59xc00i3mivs58sxft6g	cmuet59m600djmivs3v2ejnor	DP-09	2026-06-26 00:42:41.554	2027-11-18 00:42:41.554	24.00	38.00	12	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.664	2026-09-24 00:42:41.664
cmuet59xx00icmivs9eg0vc79	cmuet59mz00dvmivsxdbjul1m	PAC-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	19.50	31.00	60	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.686	2026-09-24 00:42:41.686
cmuet59y300ifmivsewwz8xz5	cmuet59n400dzmivscjpx13fw	SML-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	19.50	31.00	60	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.692	2026-09-24 00:42:41.692
cmuet59ya00iimivs78xjty0h	cmuet59na00e3mivs0ey1tcj0	CP-11	2026-06-26 00:42:41.554	2028-01-17 00:42:41.554	25.50	41.50	25	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.698	2026-09-24 00:42:41.698
cmuet59yj00ilmivs19bpv27c	cmuet59ng00e7mivsw974nlst	CR-02	2026-06-26 00:42:41.554	2028-01-17 00:42:41.554	24.50	40.00	18	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.707	2026-09-24 00:42:41.707
cmuet59yo00iomivst48e6pkw	cmuet59nl00ebmivsid0hn6fd	AZ-902	2026-06-26 00:42:41.554	2029-09-08 00:42:41.554	85.00	132.00	40	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.712	2026-09-24 00:42:41.712
cmuet59yt00irmivsu6e11y13	cmuet59nq00efmivsqm75t0dt	AG-229	2026-06-26 00:42:41.554	2028-09-13 00:42:41.554	135.00	201.00	40	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.718	2026-09-24 00:42:41.718
cmuet59z000iumivsqj31af48	cmuet59nx00ejmivsug03tnb0	BAT-AZI-500-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	78.00	119.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.725	2026-09-24 00:42:41.725
cmuet59z500ixmivs379zwt4p	cmuet59o200enmivst7v7aktu	BAT-PAN-40-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	60.00	95.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.73	2026-09-24 00:42:41.73
cmuet59za00j0mivs2fwnpqd9	cmuet59o700ermivsp9a18rte	BAT-TLM-40-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	92.00	145.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.734	2026-09-24 00:42:41.734
cmuet59zf00j3mivsq006drk8	cmuet59oe00evmivswl6igsrm	BAT-TLM-80-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	148.00	230.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.74	2026-09-24 00:42:41.74
cmuet59zm00j6mivspvokoh6e	cmuet59ok00ezmivsqyq0yuxg	BAT-GLY-500-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	17.50	28.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.747	2026-09-24 00:42:41.747
cmuet59zs00j9mivsky3ofq7e	cmuet59oq00f3mivs59yzu7qn	BAT-GLY-850-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	26.00	42.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.752	2026-09-24 00:42:41.752
cmuet59zx00jcmivsxh7e0i83	cmuet59q700f7mivsctw1i9x3	BAT-GLY-1000-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	41.00	65.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.757	2026-09-24 00:42:41.757
cmuet5a0300jfmivsfmarqllj	cmuet59qf00fbmivstwd1o5l2	BAT-ATV-10-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	70.00	110.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.764	2026-09-24 00:42:41.764
cmuet5a0e00jimivsdwakep7s	cmuet59qr00ffmivsbhly40oa	BAT-ATV-20-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	125.00	195.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.775	2026-09-24 00:42:41.775
cmuet5a0j00jlmivs5aq8hs44	cmuet59qy00fjmivs44kucaf8	BAT-ATV-40-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	205.00	320.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.779	2026-09-24 00:42:41.779
cmuet5a0q00jomivsszc0mt3z	cmuet59r700fnmivsznhu6ckk	BAT-MLC-15-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	115.00	180.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.787	2026-09-24 00:42:41.787
cmuet5a0v00jrmivs3wswjmhu	cmuet59re00frmivsqw2zwbum	BAT-CTZ-10-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	13.50	22.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.792	2026-09-24 00:42:41.792
cmuet5a1000jumivsrmf4l99p	cmuet59rk00fvmivs73fioxtt	BAT-CPX-500-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	30.00	48.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.797	2026-09-24 00:42:41.797
cmuet5a1700jxmivs8jb225e5	cmuet59rt00fzmivstjruq3fy	BAT-BRF-400-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	21.00	35.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.804	2026-09-24 00:42:41.804
cmuet5a1c00k0mivs6t4akted	cmuet59ry00g3mivsfxx6wlni	BAT-CBF-725-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	27.50	44.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.809	2026-09-24 00:42:41.809
cmuet5a1h00k3mivs462v3cx1	cmuet59s500g7mivsx1zjwlh6	BAT-BCZ-CAP-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	38.00	60.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.813	2026-09-24 00:42:41.813
cmuet5a1m00k6mivs6ug31416	cmuet59sc00gbmivsm2z36f12	BAT-OMZ-20-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	45.00	72.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.818	2026-09-24 00:42:41.818
cmuet5a1t00k9mivsyzo114gq	cmuet59si00gfmivs3ma7i4ia	BAT-RBL-D-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	118.00	185.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.826	2026-09-24 00:42:41.826
cmuet5a1z00kcmivsjp9mt0s9	cmuet59so00gjmivsa7ahiqdj	BAT-MCF-1G-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	48.00	75.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.831	2026-09-24 00:42:41.831
cmuet5a2400kfmivsnf1vb29l	cmuet59sz00gnmivskjqt8gu3	BAT-DYN-75-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	22.00	35.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.837	2026-09-24 00:42:41.837
cmuet5a2c00kimivs814qv5x4	cmuet59t400grmivspvehfgiq	BAT-PAN-40-INJ-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	34.00	54.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.844	2026-09-24 00:42:41.844
cmuet5a2i00klmivszm9zrl6m	cmuet59ta00gvmivs5b0637jw	BAT-CPX-DRP-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	12.00	20.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.85	2026-09-24 00:42:41.85
cmuet5a2n00komivsza788zff	cmuet59ti00gzmivsrsv2zxo5	BAT-RFT-10-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	88.00	140.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.855	2026-09-24 00:42:41.855
cmuet5a2t00krmivspg4b35b3	cmuet59to00h3mivs20hcu5m4	BAT-VOL-GEL-30-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	56.00	90.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.861	2026-09-24 00:42:41.861
cmuet5a3400kumivscztwq06l	cmuet59tu00h7mivsgifstvkt	BAT-ASC-100-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	72.00	115.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.873	2026-09-24 00:42:41.873
cmuet59vo00himivsuc5s8n0g	cmuet59kn00crmivsww1c894v	BAT-AMX-500-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	55.00	85.00	100	0	8	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.604	2026-09-24 02:20:48.662
cmuet59wt00humivso0n9auwq	cmuet59lk00d7mivswr05kn2g	D-101	2026-06-26 00:42:41.554	2028-05-16 00:42:41.554	21.00	33.60	180	0	10	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.645	2026-09-24 02:20:48.643
cmuet59wz00hxmivs5wkqhfkr	cmuet59lr00dbmivsgl8xm6hk	D-044	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	10.00	16.20	45	0	3	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.651	2026-09-24 02:20:48.684
cmuet59xp00i9mivscwvcu55p	cmuet59mu00drmivsq6cwi68r	P-650-B	2026-06-26 00:42:41.554	2028-09-13 00:42:41.554	19.00	30.50	210	0	7	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.677	2026-09-24 02:20:48.591
cmuet59xj00i6mivss0dnvl18	cmuet59mn00dnmivszkwegfss	CP-650	2026-06-26 00:42:41.554	2028-07-15 00:42:41.554	20.50	32.80	95	0	6	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.671	2026-09-24 02:20:48.598
cmuet59vy00hlmivszn3yap6e	cmuet59ku00cvmivs5d2e7mxz	BAT-CFS-100-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	40.00	65.00	100	0	5	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.614	2026-09-24 02:20:48.689
cmuet59wj00hrmivs1b1vfdh9	cmuet59lc00d3mivsuszpp7ir	BAT-BET-OIN-20-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	35.00	55.00	100	0	2	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.635	2026-09-24 02:20:48.672
cmuet5a3h00kxmivsrzhvg3qp	cmuet59u200hbmivs1gvp7kal	BAT-ARZ-200-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	85.00	135.00	100	0	0	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.885	2026-09-24 00:42:41.885
cmuet59wa00homivsuulcnr6k	cmuet59l400czmivsz6egqnzt	BAT-VTC-500-01	2026-06-26 00:42:41.554	2028-03-17 00:42:41.554	75.00	120.00	100	0	7	ACTIVE	\N	\N	\N	default-branch	2026-09-24 00:42:41.626	2026-09-24 02:20:48.634
\.


--
-- Data for Name: bill_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bill_allocations (id, voucher_entry_id, invoice_id, allocated_amount, ref_type, ref_number, created_at) FROM stdin;
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, "organizationId", name, code, gstin, "dlNumber", email, phone, address, city, state, pincode, "isHeadOffice", "isActive", "invoicePrefix", "invoiceCounter", "createdAt", "updatedAt") FROM stdin;
default-branch	default-org	Main Branch	HO	29ABCDE1234F1Z5	DL-KA-12345	main@pharmacare.local	+91-9876543210	123, Medical Street, Health Nagar	Bangalore	Karnataka	560001	t	t	PC	108	2026-09-24 00:42:39.014	2026-09-24 02:20:48.693
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, slug, description, "parentId", "imageUrl", "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
cmu89lxv500e2ad8wlilrppps	Tablets	tablets	\N	\N	\N	t	0	2026-09-19 10:49:09.81	2026-09-19 10:49:09.81
cmu89lxvc00e3ad8w17u9cjp7	Capsules	capsules	\N	\N	\N	t	0	2026-09-19 10:49:09.817	2026-09-19 10:49:09.817
cmu89lxvf00e4ad8wcafuo2dq	Syrups & Liquids	syrups-liquids	\N	\N	\N	t	0	2026-09-19 10:49:09.82	2026-09-19 10:49:09.82
cmu89lxvi00e5ad8w4yga5u12	Injections	injections	\N	\N	\N	t	0	2026-09-19 10:49:09.822	2026-09-19 10:49:09.822
cmu89lxvk00e6ad8w7o4h9yhn	Topical / Ointments	topical-ointments	\N	\N	\N	t	0	2026-09-19 10:49:09.825	2026-09-19 10:49:09.825
cmu89lxvn00e7ad8wlnla4vmo	Eye & Ear Drops	eye-ear-drops	\N	\N	\N	t	0	2026-09-19 10:49:09.828	2026-09-19 10:49:09.828
cmu89lxvs00e8ad8wda5fr1kg	Surgical & Accessories	surgical-accessories	\N	\N	\N	t	0	2026-09-19 10:49:09.832	2026-09-19 10:49:09.832
cmu89lxvy00e9ad8w5hahgy98	Vitamins & Supplements	vitamins-supplements	\N	\N	\N	t	0	2026-09-19 10:49:09.838	2026-09-19 10:49:09.838
cmu89lxw100eaad8wfjmilkgo	Diabetic Care	diabetic-care	\N	\N	\N	t	0	2026-09-19 10:49:09.841	2026-09-19 10:49:09.841
cmu89lxw500ebad8wsui1u2ug	Baby Care	baby-care	\N	\N	\N	t	0	2026-09-19 10:49:09.845	2026-09-19 10:49:09.845
\.


--
-- Data for Name: credit_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credit_notes (id, "noteNumber", "saleReturnId", "customerId", amount, "balanceUsed", status, "expiresAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: customer_ledgers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_ledgers (id, "customerId", type, amount, balance, "referenceType", "referenceId", description, "entryDate", "createdAt") FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, phone, email, gstin, address, city, state, pincode, "creditLimit", "outstandingBalance", "creditDays", "isActive", notes, "createdAt", "updatedAt", "discountTier", "patientDiscountPercent") FROM stdin;
cmuet5a4b00l2mivsfemad6o1	Walk-in Customer	9000000000	\N	\N	\N	\N	\N	\N	0.00	0.00	0	t	\N	2026-09-24 00:42:41.915	2026-09-24 00:42:41.915	\N	0.00
cmuet5a4g00l3mivsjxhqdmpl	Ramesh Kumar	9845012345	ramesh.k@example.com	\N	45, Palm Grove Layout	Bangalore	Karnataka	560034	5000.00	0.00	15	t	\N	2026-09-24 00:42:41.92	2026-09-24 00:42:41.92	\N	0.00
cmuet5a4l00l4mivsdl67p0pt	Sunita Sharma	9845054321	sunita.s@example.com	\N	12, Sunrise Residency	Bangalore	Karnataka	560038	2000.00	0.00	7	t	\N	2026-09-24 00:42:41.926	2026-09-24 00:42:41.926	\N	0.00
cmuewclsp0002h6cj7irmbjga	Rajesh Varma	9845088990	rajesh.varma@example.com	\N	88, 4th Block, Koramangala	Bangalore	Karnataka	560034	4000.00	0.00	14	t	\N	2026-09-24 02:12:22.49	2026-09-24 02:12:22.49	\N	0.00
cmuewclsu0003h6cja9t0c468	Anita Desai	9845077221	anita.desai@example.com	\N	19, Green Meadows, Indiranagar	Bangalore	Karnataka	560038	3000.00	0.00	10	t	\N	2026-09-24 02:12:22.495	2026-09-24 02:12:22.495	\N	0.00
cmuewclsz0004h6cjpwna61lp	Mohammed Farooq	9845033445	m.farooq@example.com	\N	102, Crescent Towers, Jayanagar	Bangalore	Karnataka	560011	2500.00	0.00	15	t	\N	2026-09-24 02:12:22.5	2026-09-24 02:12:22.5	\N	0.00
\.


--
-- Data for Name: doctor_commissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_commissions (id, "doctorId", "saleId", "saleAmount", "commissionPercent", "commissionAmount", "isPaid", "paidAt", "paymentReference", notes, "createdAt") FROM stdin;
cmuewnfv5000cpzpd3fps40bz	cmuewcltl0007h6cjqd5jp3eo	cmuewnfu50001pzpdg7yjnv2r	187.20	5.00	9.36	f	\N	\N	\N	2026-09-24 03:45:00
cmuewng79001bpzpd50tt0jes	cmua62xxk0000k7za1tcylae6	cmuewng71000xpzpdjht7aqhb	258.60	5.00	12.93	f	\N	\N	\N	2026-09-24 06:15:00
cmuewng8p0026pzpdfdozj3yk	cmuewclta0005h6cj3ntaf9oa	cmuewng8k001ypzpdzxcgciu8	91.50	5.00	4.58	f	\N	\N	\N	2026-09-24 09:10:00
cmuewngac003ipzpdv5il8661	cmua62xxk0000k7za1tcylae6	cmuewnga50034pzpdhppjq03u	562.20	5.00	28.11	f	\N	\N	\N	2026-09-23 05:30:00
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctors (id, name, specialization, "clinicName", phone, email, "isActive", "createdAt", "updatedAt", "commissionPercent", notes, qualification, "regNumber") FROM stdin;
cmua62xxk0000k7za1tcylae6	Dr. Rajesh Sharma	General Physician	City Care Clinic & Diagnostics	9820145678	dr.sharma@citycare.local	t	2026-09-20 18:45:56.934	2026-09-20 18:45:56.934	5.00	Primary referral physician for hypertension & diabetes	MBBS, MD (General Medicine)	MCI-48291
cmua62xy30001k7zarxdurye6	Dr. Priya Nair	Gynecologist	Mother & Child Healthcare Clinic	9845012345	dr.priya@motherchild.local	t	2026-09-20 18:45:56.956	2026-09-20 18:45:56.956	7.50	Prescribes prenatal vitamins, iron supplements & pediatric care	MBBS, DGO, MS (Obstetrics & Gynaecology)	KMC-39102
cmua62xy80002k7zahjt21thy	Dr. Amitav Banerjee	Cardiologist	Heartline Cardiac Centre	9831098765	dr.banerjee@heartline.local	t	2026-09-20 18:45:56.96	2026-09-20 18:45:56.96	5.00	Cardiac and lipid management prescriber	MBBS, MD, DM (Cardiology)	WBMC-55210
cmua62xyb0003k7zaizckizni	Dr. Sunita Deshmukh	Pediatrician	Little Smiles Pediatric Clinic	9822054321	dr.sunita@littlesmiles.local	t	2026-09-20 18:45:56.964	2026-09-20 18:45:56.964	6.00	Pediatric antibiotic and vaccine prescriber	MBBS, DNB (Pediatrics)	MMC-67890
cmua62xyf0004k7zaewopn73g	Dr. Vikramaditya Rao	Orthopedic Surgeon	Spine & Bone Ortho Center	9849033445	dr.rao@orthocenter.local	t	2026-09-20 18:45:56.968	2026-09-20 18:45:56.968	8.00	NSAIDs, analgesics, and calcium supplement prescriber	MBBS, MS (Orthopaedics)	APMC-22441
cmuewclta0005h6cj3ntaf9oa	Dr. Arvind Kumar	Cardiologist	Bangalore Heart Care Centre	9845022222	dr.arvind@heartcare.com	t	2026-09-24 02:12:22.511	2026-09-24 02:12:22.511	5.00	\N	MBBS, MD, DM (Cardiology)	KMC-31204
cmuewcltf0006h6cjiuqcrvx8	Dr. Priya Patel	Pediatrician	Rainbow Children Clinic	9845033333	dr.priya@rainbowkids.com	t	2026-09-24 02:12:22.515	2026-09-24 02:12:22.515	5.00	\N	MBBS, DNB (Pediatrics)	KMC-52190
cmuewcltl0007h6cjqd5jp3eo	Dr. Sneha Kulkarni	Diabetologist	Diabetes & Metabolism Centre	9845044444	dr.sneha@diabetescare.com	t	2026-09-24 02:12:22.521	2026-09-24 02:12:22.521	5.00	\N	MBBS, MD (Endocrinology)	KMC-48712
cmuewcltp0008h6cjeyqy6xcw	Dr. Suresh Menon	ENT Specialist	City ENT & Allergy Care	9845055555	dr.menon@cityent.com	t	2026-09-24 02:12:22.526	2026-09-24 02:12:22.526	5.00	\N	MBBS, MS (ENT)	KMC-29401
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.files (id, "fileName", "originalName", "mimeType", size, url, path, "uploadedById", "entityType", "entityId", "createdAt") FROM stdin;
\.


--
-- Data for Name: gst_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gst_transactions (id, "branchId", type, "referenceType", "referenceId", "invoiceNumber", "invoiceDate", "partyGstin", "partyName", "partyState", "hsnCode", "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "totalTax", "totalAmount", "returnPeriod", "isFiled", "createdAt") FROM stdin;
cmucyyzbb000d4t3q4rpfkiqi	default-branch	B2C	SALE	cmucyyz7900054t3qrpoy2yx9	PC-HO-0001	2026-09-22 17:50:13.173	\N	Mnannan	Karnataka	3004	32.80	1.97	1.97	0.00	3.94	36.74	09-2026	f	2026-09-22 17:50:13.319
cmucz1q5e000t4t3qlts31cpc	default-branch	B2C	SALE	cmucz1q0u000l4t3qf0lx4ie4	PC-HO-0002	2026-09-22 17:52:21.246	\N	Walk-in Customer	Karnataka	3004	164.00	9.84	9.84	0.00	19.68	183.68	09-2026	f	2026-09-22 17:52:21.41
\.


--
-- Data for Name: held_bills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.held_bills (id, "branchId", "userId", label, "cartData", "customerId", "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: hsn_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hsn_codes (id, code, description, "gstRate", "cgstRate", "sgstRate", "igstRate", "cessRate", "isActive", "createdAt") FROM stdin;
cmu89lxtu00dqad8w6adxm65l	3004	Medicaments for therapeutic or prophylactic uses	12.00	6.00	6.00	12.00	0.00	t	2026-09-19 10:49:09.762
cmu89lxu300drad8wqru2t0bu	3003	Medicaments (not in dosage forms)	12.00	6.00	6.00	12.00	0.00	t	2026-09-19 10:49:09.771
cmu89lxu600dsad8windkv99e	3002	Human blood, vaccines, toxins	5.00	2.50	2.50	5.00	0.00	t	2026-09-19 10:49:09.775
cmu89lxua00dtad8w5w178eye	3001	Glands, organs for organo-therapeutical uses	0.00	0.00	0.00	0.00	0.00	t	2026-09-19 10:49:09.779
cmu89lxue00duad8wgwekao5x	3006	Pharmaceutical goods (surgical gut, sutures, etc.)	12.00	6.00	6.00	12.00	0.00	t	2026-09-19 10:49:09.782
cmu89lxuh00dvad8wdi2x70oj	3005	Wadding, gauze, bandages	12.00	6.00	6.00	12.00	0.00	t	2026-09-19 10:49:09.785
cmu89lxul00dwad8w2hotrvck	9018	Instruments and appliances used in medicine	12.00	6.00	6.00	12.00	0.00	t	2026-09-19 10:49:09.789
cmu89lxuq00dxad8wmyuzjj1k	9019	Mechano-therapy appliances, massage apparatus	18.00	9.00	9.00	18.00	0.00	t	2026-09-19 10:49:09.795
cmu89lxut00dyad8wob3ebwbi	9021	Orthopaedic appliances, prosthetics	12.00	6.00	6.00	12.00	0.00	t	2026-09-19 10:49:09.798
cmu89lxux00dzad8wwlip7r3k	3307	Toiletries, cosmetics	18.00	9.00	9.00	18.00	0.00	t	2026-09-19 10:49:09.802
cmu89lxv000e0ad8wa39blse9	2106	Food preparations (health supplements)	18.00	9.00	9.00	18.00	0.00	t	2026-09-19 10:49:09.804
cmu89lxv200e1ad8wrngpo750	9402	Medical furniture	18.00	9.00	9.00	18.00	0.00	t	2026-09-19 10:49:09.806
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, "productId", "branchId", "totalQuantity", "reservedQuantity", "availableQuantity", "updatedAt") FROM stdin;
cmuet59vd00hhmivs5j4shgbe	cmuet59k000cnmivsfjukq8ga	default-branch	120	0	120	2026-09-24 00:42:41.594
cmuet59x800i2mivs1a07fhc5	cmuet59lx00dfmivs71156gvx	default-branch	0	0	0	2026-09-24 00:42:41.66
cmuet59xg00i5mivs2fvl23xo	cmuet59m600djmivs3v2ejnor	default-branch	12	0	12	2026-09-24 00:42:41.669
cmuet59y100iemivsr2gkf8sp	cmuet59mz00dvmivsxdbjul1m	default-branch	60	0	60	2026-09-24 00:42:41.69
cmuet59y800ihmivsx88fw2bs	cmuet59n400dzmivscjpx13fw	default-branch	60	0	60	2026-09-24 00:42:41.696
cmuet59yh00ikmivsk14kt86n	cmuet59na00e3mivs0ey1tcj0	default-branch	25	0	25	2026-09-24 00:42:41.705
cmuet59ym00inmivsfnlx0728	cmuet59ng00e7mivsw974nlst	default-branch	18	0	18	2026-09-24 00:42:41.71
cmuet59yr00iqmivszisi5hoa	cmuet59nl00ebmivsid0hn6fd	default-branch	40	0	40	2026-09-24 00:42:41.715
cmuet59yy00itmivscj7uo0hw	cmuet59nq00efmivsqm75t0dt	default-branch	40	0	40	2026-09-24 00:42:41.722
cmuet59z300iwmivsf0alcbvn	cmuet59nx00ejmivsug03tnb0	default-branch	100	0	100	2026-09-24 00:42:41.728
cmuet59z800izmivsi8pkasx7	cmuet59o200enmivst7v7aktu	default-branch	100	0	100	2026-09-24 00:42:41.733
cmuet59zd00j2mivsbj3bnb0k	cmuet59o700ermivsp9a18rte	default-branch	100	0	100	2026-09-24 00:42:41.738
cmuet59zl00j5mivsy1kuzbjh	cmuet59oe00evmivswl6igsrm	default-branch	100	0	100	2026-09-24 00:42:41.745
cmuet59zq00j8mivsysvsggz5	cmuet59ok00ezmivsqyq0yuxg	default-branch	100	0	100	2026-09-24 00:42:41.75
cmuet59zv00jbmivss2por0ug	cmuet59oq00f3mivs59yzu7qn	default-branch	100	0	100	2026-09-24 00:42:41.755
cmuet5a0000jemivsy5cab2b8	cmuet59q700f7mivsctw1i9x3	default-branch	100	0	100	2026-09-24 00:42:41.76
cmuet5a0d00jhmivsslz65s0y	cmuet59qf00fbmivstwd1o5l2	default-branch	100	0	100	2026-09-24 00:42:41.773
cmuet5a0h00jkmivs74z5t3ai	cmuet59qr00ffmivsbhly40oa	default-branch	100	0	100	2026-09-24 00:42:41.778
cmuet5a0o00jnmivsprhe9ezs	cmuet59qy00fjmivs44kucaf8	default-branch	100	0	100	2026-09-24 00:42:41.785
cmuet5a0u00jqmivsz4qo71c2	cmuet59r700fnmivsznhu6ckk	default-branch	100	0	100	2026-09-24 00:42:41.79
cmuet5a0z00jtmivs8pf94c6x	cmuet59re00frmivsqw2zwbum	default-branch	100	0	100	2026-09-24 00:42:41.795
cmuet5a1400jwmivsaxkvacfv	cmuet59rk00fvmivs73fioxtt	default-branch	100	0	100	2026-09-24 00:42:41.8
cmuet5a1b00jzmivsfjq42plg	cmuet59rt00fzmivstjruq3fy	default-branch	100	0	100	2026-09-24 00:42:41.807
cmuet5a1f00k2mivsf6hpxvq3	cmuet59ry00g3mivsfxx6wlni	default-branch	100	0	100	2026-09-24 00:42:41.812
cmuet5a1k00k5mivs9w440r8o	cmuet59s500g7mivsx1zjwlh6	default-branch	100	0	100	2026-09-24 00:42:41.817
cmuet5a1r00k8mivsuujp8a0h	cmuet59sc00gbmivsm2z36f12	default-branch	100	0	100	2026-09-24 00:42:41.824
cmuet5a1x00kbmivshc1bokwf	cmuet59si00gfmivs3ma7i4ia	default-branch	100	0	100	2026-09-24 00:42:41.829
cmuet5a2200kemivsmc6ngzhz	cmuet59so00gjmivsa7ahiqdj	default-branch	100	0	100	2026-09-24 00:42:41.835
cmuet5a2800khmivs26wfy678	cmuet59sz00gnmivskjqt8gu3	default-branch	100	0	100	2026-09-24 00:42:41.84
cmuet5a2g00kkmivst8vc6hax	cmuet59t400grmivspvehfgiq	default-branch	100	0	100	2026-09-24 00:42:41.849
cmuet5a2l00knmivscbx6dgev	cmuet59ta00gvmivs5b0637jw	default-branch	100	0	100	2026-09-24 00:42:41.853
cmuet5a2r00kqmivsvotp1w8m	cmuet59ti00gzmivsrsv2zxo5	default-branch	100	0	100	2026-09-24 00:42:41.859
cmuet5a3100ktmivs3ie2yzzx	cmuet59to00h3mivs20hcu5m4	default-branch	100	0	100	2026-09-24 00:42:41.869
cmuet5a3a00kwmivshycz55jf	cmuet59tu00h7mivsgifstvkt	default-branch	100	0	100	2026-09-24 00:42:41.879
cmuet5a3o00kzmivspm6lsqpq	cmuet59u200hbmivs1gvp7kal	default-branch	100	0	100	2026-09-24 00:42:41.893
cmuet59wg00hqmivsvqczlwci	cmuet59l400czmivsz6egqnzt	default-branch	93	0	93	2026-09-24 02:20:48.639
cmuet59ww00hwmivsifxrbby5	cmuet59lk00d7mivswr05kn2g	default-branch	170	0	170	2026-09-24 02:20:48.646
cmuet59vv00hkmivsq3e2uawq	cmuet59kn00crmivsww1c894v	default-branch	92	0	92	2026-09-24 02:20:48.664
cmuet59wo00htmivsxzbij69l	cmuet59lc00d3mivsuszpp7ir	default-branch	98	0	98	2026-09-24 02:20:48.674
cmuet59x200hzmivsb820ptvo	cmuet59lr00dbmivsgl8xm6hk	default-branch	42	0	42	2026-09-24 02:20:48.686
cmuet59w400hnmivsxwsutpxf	cmuet59ku00cvmivs5d2e7mxz	default-branch	95	0	95	2026-09-24 02:20:48.69
cmvgj9k6w0001emhkbtfkj2te	cmvgg2vu00006nm4kxx0bev39	default-branch	0	0	0	2026-10-20 10:21:20.12
cmvgj9k720003emhkmuyeevrx	cmvgi1vey0058nm4kfsjlonoo	default-branch	0	0	0	2026-10-20 10:21:20.127
cmuet59xv00ibmivs2z5yvyzw	cmuet59mu00drmivsq6cwi68r	default-branch	203	0	203	2026-09-24 02:20:48.593
cmuet59xn00i8mivsabt6ckcu	cmuet59mn00dnmivszkwegfss	default-branch	89	0	89	2026-09-24 02:20:48.6
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_movements (id, "inventoryId", type, quantity, "quantityBefore", "quantityAfter", "referenceType", "referenceId", "batchId", notes, "createdById", "createdAt") FROM stdin;
cmuewclwn000qh6cj5tutqwn9	cmuet59ww00hwmivsifxrbby5	IN	200	0	180	PURCHASE	cmuewclw7000kh6cjeblvgws9	cmuet59wt00humivso0n9auwq	Goods received against PO-2026-001 (Invoice SP-INV-84920)	cmuet589u00b1mivst65bse94	2026-09-14 02:12:22.397
cmuewclww000sh6cjnvdzc9bl	cmuet59x200hzmivsb820ptvo	IN	100	0	45	PURCHASE	cmuewclw7000kh6cjeblvgws9	cmuet59wz00hxmivs5wkqhfkr	Goods received against PO-2026-001 (Invoice SP-INV-84920)	cmuet589u00b1mivst65bse94	2026-09-14 02:12:22.397
cmuewclwy000uh6cjtbvda8fd	cmuet59vv00hkmivsq3e2uawq	IN	100	0	100	PURCHASE	cmuewclw7000kh6cjeblvgws9	cmuet59vo00himivsuc5s8n0g	Goods received against PO-2026-001 (Invoice SP-INV-84920)	cmuet589u00b1mivst65bse94	2026-09-14 02:12:22.397
cmuewclx60012h6cjfoxmv07m	cmuet59xn00i8mivsabt6ckcu	IN	100	0	95	PURCHASE	cmuewclx1000wh6cjxrwcrcyr	cmuet59xj00i6mivss0dnvl18	Goods received against PO-2026-002 (Invoice ML-INV-39482)	cmuet589u00b1mivst65bse94	2026-09-18 02:12:22.397
cmuewclx70014h6cj8uez6ali	cmuet59xv00ibmivs2z5yvyzw	IN	200	10	210	PURCHASE	cmuewclx1000wh6cjxrwcrcyr	cmuet59xp00i9mivscwvcu55p	Goods received against PO-2026-002 (Invoice ML-INV-39482)	cmuet589u00b1mivst65bse94	2026-09-18 02:12:22.397
cmuewclx90016h6cjx3o6gbco	cmuet59w400hnmivsxwsutpxf	IN	80	20	100	PURCHASE	cmuewclx1000wh6cjxrwcrcyr	cmuet59vy00hlmivszn3yap6e	Goods received against PO-2026-002 (Invoice ML-INV-39482)	cmuet589u00b1mivst65bse94	2026-09-18 02:12:22.397
cmuewclxi001dh6cjkxin4jra	cmuet59wg00hqmivsvqczlwci	IN	100	0	100	PURCHASE	cmuewclxc0018h6cjjl23eqx5	cmuet59wa00homivsuulcnr6k	Goods received against PO-2026-003 (Invoice CIP-BLR-1029)	cmuet589u00b1mivst65bse94	2026-09-21 02:12:22.397
cmuewclxl001fh6cjdqzts3wd	cmuet59wo00htmivsxzbij69l	IN	100	0	100	PURCHASE	cmuewclxc0018h6cjjl23eqx5	cmuet59wj00hrmivs1b1vfdh9	Goods received against PO-2026-003 (Invoice CIP-BLR-1029)	cmuet589u00b1mivst65bse94	2026-09-21 02:12:22.397
cmuewcly3001oh6cjre33tw8l	cmuet59ww00hwmivsifxrbby5	ADJUSTMENT	2	180	182	ADJUSTMENT	cmuewcly0001mh6cjixcphjfw	cmuet59wt00humivso0n9auwq	Monthly physical inventory audit count reconciliation: +2 sealed strips discovered in counter display drawer.	cmuet589u00b1mivst65bse94	2026-09-20 02:12:22.397
cmuewcly9001sh6cj9ay69bw4	cmuet59w400hnmivsxwsutpxf	ADJUSTMENT	-1	100	99	ADJUSTMENT	cmuewcly5001qh6cjp4aetkv1	cmuet59vy00hlmivszn3yap6e	Accidental drop damage during shelf rearrangement; bottle glass shattered, liquid lost.	cmuet589u00b1mivst65bse94	2026-09-22 02:12:22.397
cmuewclyn001wh6cjofx59v3h	cmuet59xn00i8mivsabt6ckcu	ADJUSTMENT	-1	95	94	ADJUSTMENT	cmuewclyl001uh6cjr3k5a663	cmuet59xj00i6mivss0dnvl18	Damaged outer blister foil packaging during carton unpacking; deemed unsaleable per GMP guidelines.	cmuet589u00b1mivst65bse94	2026-09-23 02:12:22.397
cmuewnfw3000epzpd7s9q80ul	cmuet59ww00hwmivsifxrbby5	OUT	2	180	178	SALE	cmuewnfu50001pzpdg7yjnv2r	cmuet59wt00humivso0n9auwq	Counter sale dispensed under invoice INV-2026-0101	cmuet589u00b1mivst65bse94	2026-09-24 03:45:00
cmuewnfy2000gpzpdbt5owgsq	cmuet59wg00hqmivsvqczlwci	OUT	1	100	99	SALE	cmuewnfu50001pzpdg7yjnv2r	cmuet59wa00homivsuulcnr6k	Counter sale dispensed under invoice INV-2026-0101	cmuet589u00b1mivst65bse94	2026-09-24 03:45:00
cmuewnfzw000tpzpd6nf3k55s	cmuet59ww00hwmivsifxrbby5	OUT	1	180	179	SALE	cmuewnfzh000ipzpdabrnxac6	cmuet59wt00humivso0n9auwq	Counter sale dispensed under invoice INV-2026-0102	cmuet589u00b1mivst65bse94	2026-09-24 05:00:00
cmuewng07000vpzpdw311cdtb	cmuet59w400hnmivsxwsutpxf	OUT	1	100	99	SALE	cmuewnfzh000ipzpdabrnxac6	cmuet59vy00hlmivszn3yap6e	Counter sale dispensed under invoice INV-2026-0102	cmuet589u00b1mivst65bse94	2026-09-24 05:00:00
cmuewng7d001dpzpdw6u46y1u	cmuet59vv00hkmivsq3e2uawq	OUT	2	100	98	SALE	cmuewng71000xpzpdjht7aqhb	cmuet59vo00himivsuc5s8n0g	Counter sale dispensed under invoice INV-2026-0103	cmuet589u00b1mivst65bse94	2026-09-24 06:15:00
cmuewng7j001fpzpdr8ajjf96	cmuet59wo00htmivsxzbij69l	OUT	1	100	99	SALE	cmuewng71000xpzpdjht7aqhb	cmuet59wj00hrmivs1b1vfdh9	Counter sale dispensed under invoice INV-2026-0103	cmuet589u00b1mivst65bse94	2026-09-24 06:15:00
cmuewng7o001hpzpdic7pjhz6	cmuet59ww00hwmivsifxrbby5	OUT	1	180	179	SALE	cmuewng71000xpzpdjht7aqhb	cmuet59wt00humivso0n9auwq	Counter sale dispensed under invoice INV-2026-0103	cmuet589u00b1mivst65bse94	2026-09-24 06:15:00
cmuewng83001upzpdqlcmbcik	cmuet59xn00i8mivsabt6ckcu	OUT	2	95	93	SALE	cmuewng7v001jpzpd1pzt175n	cmuet59xj00i6mivss0dnvl18	Counter sale dispensed under invoice INV-2026-0104	cmuet589u00b1mivst65bse94	2026-09-24 07:40:00
cmuewng89001wpzpd7dq5e544	cmuet59wg00hqmivsvqczlwci	OUT	1	100	99	SALE	cmuewng7v001jpzpd1pzt175n	cmuet59wa00homivsuulcnr6k	Counter sale dispensed under invoice INV-2026-0104	cmuet589u00b1mivst65bse94	2026-09-24 07:40:00
cmuewng8r0028pzpdfkr0t1di	cmuet59xv00ibmivs2z5yvyzw	OUT	3	210	207	SALE	cmuewng8k001ypzpdzxcgciu8	cmuet59xp00i9mivscwvcu55p	Counter sale dispensed under invoice INV-2026-0105	cmuet589u00b1mivst65bse94	2026-09-24 09:10:00
cmuewng95002lpzpdxa2et7k1	cmuet59x200hzmivsb820ptvo	OUT	1	45	44	SALE	cmuewng8x002apzpdeiq53ua0	cmuet59wz00hxmivs5wkqhfkr	Counter sale dispensed under invoice INV-2026-0106	cmuet589u00b1mivst65bse94	2026-09-24 10:45:00
cmuewng9a002npzpdtgf7kfa5	cmuet59w400hnmivsxwsutpxf	OUT	1	100	99	SALE	cmuewng8x002apzpdeiq53ua0	cmuet59vy00hlmivszn3yap6e	Counter sale dispensed under invoice INV-2026-0106	cmuet589u00b1mivst65bse94	2026-09-24 10:45:00
cmuewng9q0030pzpdjvna6k99	cmuet59xn00i8mivsabt6ckcu	OUT	2	95	93	SALE	cmuewng9h002ppzpdjmtq86tm	cmuet59xj00i6mivss0dnvl18	Counter sale dispensed under invoice INV-2026-0107	cmuet589u00b1mivst65bse94	2026-09-24 12:00:00
cmuewng9w0032pzpd0c9649l1	cmuet59vv00hkmivsq3e2uawq	OUT	1	100	99	SALE	cmuewng9h002ppzpdjmtq86tm	cmuet59vo00himivsuc5s8n0g	Counter sale dispensed under invoice INV-2026-0107	cmuet589u00b1mivst65bse94	2026-09-24 12:00:00
cmuewngae003kpzpdmevpyeb1	cmuet59vv00hkmivsq3e2uawq	OUT	3	100	97	SALE	cmuewnga50034pzpdhppjq03u	cmuet59vo00himivsuc5s8n0g	Counter sale dispensed under invoice INV-2026-0098	cmuet589u00b1mivst65bse94	2026-09-23 05:30:00
cmuewngak003mpzpd795i8ru2	cmuet59wg00hqmivsvqczlwci	OUT	2	100	98	SALE	cmuewnga50034pzpdhppjq03u	cmuet59wa00homivsuulcnr6k	Counter sale dispensed under invoice INV-2026-0098	cmuet589u00b1mivst65bse94	2026-09-23 05:30:00
cmuewngaq003opzpdf2f2trl0	cmuet59ww00hwmivsifxrbby5	OUT	2	180	178	SALE	cmuewnga50034pzpdhppjq03u	cmuet59wt00humivso0n9auwq	Counter sale dispensed under invoice INV-2026-0098	cmuet589u00b1mivst65bse94	2026-09-23 05:30:00
cmuewngb10041pzpd873jrod6	cmuet59xv00ibmivs2z5yvyzw	OUT	4	210	206	SALE	cmuewngaw003qpzpd1ib4c1xy	cmuet59xp00i9mivscwvcu55p	Counter sale dispensed under invoice INV-2026-0099	cmuet589u00b1mivst65bse94	2026-09-23 09:00:00
cmuewngb60043pzpdvmxhjoxd	cmuet59xn00i8mivsabt6ckcu	OUT	2	95	93	SALE	cmuewngaw003qpzpd1ib4c1xy	cmuet59xj00i6mivss0dnvl18	Counter sale dispensed under invoice INV-2026-0099	cmuet589u00b1mivst65bse94	2026-09-23 09:00:00
cmuewngbj004gpzpdmqy352hy	cmuet59ww00hwmivsifxrbby5	OUT	2	180	178	SALE	cmuewngbe0045pzpdtrzel1k6	cmuet59wt00humivso0n9auwq	Counter sale dispensed under invoice INV-2026-0100	cmuet589u00b1mivst65bse94	2026-09-23 11:15:00
cmuewngbo004ipzpd5n0mrexo	cmuet59wg00hqmivsvqczlwci	OUT	1	100	99	SALE	cmuewngbe0045pzpdtrzel1k6	cmuet59wa00homivsuulcnr6k	Counter sale dispensed under invoice INV-2026-0100	cmuet589u00b1mivst65bse94	2026-09-23 11:15:00
cmuewngc6004vpzpdtzjr48kh	cmuet59wg00hqmivsvqczlwci	OUT	2	100	98	SALE	cmuewngby004kpzpdskeg9jys	cmuet59wa00homivsuulcnr6k	Counter sale dispensed under invoice INV-2026-0095	cmuet589u00b1mivst65bse94	2026-09-22 04:45:00
cmuewngch004xpzpdp2wddby6	cmuet59ww00hwmivsifxrbby5	OUT	2	180	178	SALE	cmuewngby004kpzpdskeg9jys	cmuet59wt00humivso0n9auwq	Counter sale dispensed under invoice INV-2026-0095	cmuet589u00b1mivst65bse94	2026-09-22 04:45:00
cmuewngd0005dpzpdf7d2xzef	cmuet59vv00hkmivsq3e2uawq	OUT	2	100	98	SALE	cmuewngcp004zpzpdmksrzmt6	cmuet59vo00himivsuc5s8n0g	Counter sale dispensed under invoice INV-2026-0096	cmuet589u00b1mivst65bse94	2026-09-22 08:15:00
cmuewngd5005fpzpd4k4qbycg	cmuet59w400hnmivsxwsutpxf	OUT	2	100	98	SALE	cmuewngcp004zpzpdmksrzmt6	cmuet59vy00hlmivszn3yap6e	Counter sale dispensed under invoice INV-2026-0096	cmuet589u00b1mivst65bse94	2026-09-22 08:15:00
cmuewngda005hpzpdpdenjdf4	cmuet59wo00htmivsxzbij69l	OUT	1	100	99	SALE	cmuewngcp004zpzpdmksrzmt6	cmuet59wj00hrmivs1b1vfdh9	Counter sale dispensed under invoice INV-2026-0096	cmuet589u00b1mivst65bse94	2026-09-22 08:15:00
cmuewngdm005upzpd7m8lfcih	cmuet59x200hzmivsb820ptvo	OUT	2	45	43	SALE	cmuewngdg005jpzpdzv6xva5i	cmuet59wz00hxmivs5wkqhfkr	Counter sale dispensed under invoice INV-2026-0097	cmuet589u00b1mivst65bse94	2026-09-22 11:50:00
cmuewngdr005wpzpdnhxjb6dm	cmuet59w400hnmivsxwsutpxf	OUT	1	100	99	SALE	cmuewngdg005jpzpdzv6xva5i	cmuet59vy00hlmivszn3yap6e	Counter sale dispensed under invoice INV-2026-0097	cmuet589u00b1mivst65bse94	2026-09-22 11:50:00
\.


--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ledger_entries (id, "ledgerId", type, amount, balance, description, "referenceType", "referenceId", "entryDate", "createdAt") FROM stdin;
\.


--
-- Data for Name: ledgers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ledgers (id, code, name, type, "parentId", "isSystem", balance, "createdAt", "group") FROM stdin;
cmucc45it000gjk0l2z77tq8l	4010	Pharmacy Sales Revenue	INCOME	\N	t	0.00	2026-09-22 07:10:23.477	Sales Accounts
cmucc45j1000hjk0lwp6m0izn	4020	Discounts Received	INCOME	\N	t	0.00	2026-09-22 07:10:23.485	Indirect Incomes
cmucc45j5000ijk0lq27rr3ix	5010	Cost of Goods Sold	EXPENSE	\N	t	0.00	2026-09-22 07:10:23.489	Direct Expenses
cmucc45ja000jjk0ls9ag3d5a	5020	Store Rent & Premises	EXPENSE	\N	t	0.00	2026-09-22 07:10:23.494	Indirect Expenses
cmucc45jf000kjk0ljqgj3fpz	5030	Staff Salaries & Wages	EXPENSE	\N	t	0.00	2026-09-22 07:10:23.5	Indirect Expenses
cmucc45jm000ljk0lpaseptpp	5040	Utilities & Office Expenses	EXPENSE	\N	t	0.00	2026-09-22 07:10:23.506	Indirect Expenses
cmucc45fj0000jk0lvtpnyt1w	1010	Cash on Hand	ASSET	\N	t	0.00	2026-09-22 07:10:23.357	Cash-in-Hand
cmucc45gg0001jk0ljuzgf1c8	1011	Petty Cash	ASSET	\N	t	0.00	2026-09-22 07:10:23.392	Cash-in-Hand
cmucc45gp0002jk0leaesb2bg	1020	Main Bank Account	ASSET	\N	t	0.00	2026-09-22 07:10:23.401	Bank Accounts
cmucc45gx0003jk0lg9aul5l7	1021	HDFC Bank Current A/c	ASSET	\N	f	0.00	2026-09-22 07:10:23.409	Bank Accounts
cmucc45h30004jk0lwqkge4kv	1022	SBI Current A/c	ASSET	\N	f	0.00	2026-09-22 07:10:23.416	Bank Accounts
cmucc45hb0005jk0le6vo943p	1030	Accounts Receivable	ASSET	\N	t	0.00	2026-09-22 07:10:23.423	Sundry Debtors
cmucc45hh0006jk0lruz9eocj	1040	Inventory Asset	ASSET	\N	t	0.00	2026-09-22 07:10:23.429	Stock-in-Hand
cmucc45hp0007jk0l5rug1ph7	1051	Input CGST	ASSET	\N	t	0.00	2026-09-22 07:10:23.437	Duties & Taxes
cmucc45ht0008jk0laqkzgkav	1052	Input SGST	ASSET	\N	t	0.00	2026-09-22 07:10:23.441	Duties & Taxes
cmucc45hy0009jk0l3zh93l3m	1053	Input IGST	ASSET	\N	t	0.00	2026-09-22 07:10:23.447	Duties & Taxes
cmucc45i2000ajk0lrayzup55	2010	Accounts Payable	LIABILITY	\N	t	0.00	2026-09-22 07:10:23.451	Sundry Creditors
cmucc45i6000bjk0l4iril47o	2021	Output CGST	LIABILITY	\N	t	0.00	2026-09-22 07:10:23.454	Duties & Taxes
cmucc45ia000cjk0leaw69hb4	2022	Output SGST	LIABILITY	\N	t	0.00	2026-09-22 07:10:23.458	Duties & Taxes
cmucc45ie000djk0lpylqycci	2023	Output IGST	LIABILITY	\N	t	0.00	2026-09-22 07:10:23.462	Duties & Taxes
cmucc45ik000ejk0lj0ryu0xd	3010	Owner's Capital	EQUITY	\N	t	0.00	2026-09-22 07:10:23.468	Capital Account
cmucc45ip000fjk0lh78qku4t	3020	Retained Earnings	EQUITY	\N	t	0.00	2026-09-22 07:10:23.473	Reserves & Surplus
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_preferences (id, "userId", "lowStock", expiry, payment, system, "emailAlerts", "updatedAt") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, "userId", type, title, message, data, "isRead", "readAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_settings (id, "organizationId", key, value, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, "legalName", gstin, pan, "dlNumber", email, phone, website, "logoUrl", address, city, state, pincode, country, currency, timezone, "financialYearStart", "createdAt", "updatedAt") FROM stdin;
default-org	PharmaCare Medical Store	PharmaCare Medical Store Pvt. Ltd.	29ABCDE1234F1Z5	\N	DL-KA-12345	info@pharmacare.local	+91-9876543210	\N	\N	123, Medical Street, Health Nagar	Bangalore	Karnataka	560001	India	INR	Asia/Kolkata	4	2026-09-24 00:42:39.004	2026-09-24 00:42:39.004
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, token, "userId", "expiresAt", "usedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, "saleId", "customerId", "supplierId", "purchaseId", method, amount, reference, notes, "paymentDate", "createdAt") FROM stdin;
cmuewnfu6000apzpdq0o47bzj	cmuewnfu50001pzpdg7yjnv2r	cmuet5a4g00l3mivsjxhqdmpl	\N	\N	UPI	210.00	UPI/20260924/842109/GPay	\N	2026-09-24 03:45:00	2026-09-24 03:45:00
cmuewnfzi000rpzpd05w8x07j	cmuewnfzh000ipzpdabrnxac6	cmuet5a4b00l2mivsfemad6o1	\N	\N	CASH	110.00	\N	\N	2026-09-24 05:00:00	2026-09-24 05:00:00
cmuewng720019pzpdvdr75d80	cmuewng71000xpzpdjht7aqhb	cmuewclsu0003h6cja9t0c468	\N	\N	CARD	290.00	CARD-VISA-4821	\N	2026-09-24 06:15:00	2026-09-24 06:15:00
cmuewng7x001spzpd6w12rkxg	cmuewng7v001jpzpd1pzt175n	cmuet5a4l00l4mivsdl67p0pt	\N	\N	UPI	208.00	UPI/20260924/774912/PhonePe	\N	2026-09-24 07:40:00	2026-09-24 07:40:00
cmuewng8l0024pzpdsf93fmfq	cmuewng8k001ypzpdzxcgciu8	cmuewclsp0002h6cj7irmbjga	\N	\N	CASH	102.00	\N	\N	2026-09-24 09:10:00	2026-09-24 09:10:00
cmuewng8y002jpzpd3n20zedb	cmuewng8x002apzpdeiq53ua0	cmuet5a4b00l2mivsfemad6o1	\N	\N	UPI	91.00	UPI/20260924/110934/Paytm	\N	2026-09-24 10:45:00	2026-09-24 10:45:00
cmuewng9h002ypzpdsxtn377g	cmuewng9h002ppzpdjmtq86tm	cmuewclsz0004h6cjpwna61lp	\N	\N	CASH	169.00	\N	\N	2026-09-24 12:00:00	2026-09-24 12:00:00
cmuewnga6003gpzpd70o9oasx	cmuewnga50034pzpdhppjq03u	cmuewclsu0003h6cja9t0c468	\N	\N	CREDIT	300.00	PARTIAL-CASH-300	\N	2026-09-23 05:30:00	2026-09-23 05:30:00
cmuewngax003zpzpd6u4uwsda	cmuewngaw003qpzpd1ib4c1xy	cmuewclsp0002h6cj7irmbjga	\N	\N	CASH	210.00	\N	\N	2026-09-23 09:00:00	2026-09-23 09:00:00
cmuewngbe004epzpd2jgqyc4v	cmuewngbe0045pzpdtrzel1k6	cmuet5a4b00l2mivsfemad6o1	\N	\N	UPI	210.00	UPI/20260923/991204	\N	2026-09-23 11:15:00	2026-09-23 11:15:00
cmuewngbz004tpzpdx474n4cl	cmuewngby004kpzpdskeg9jys	cmuet5a4g00l3mivsjxhqdmpl	\N	\N	UPI	344.00	UPI/20260922/551029	\N	2026-09-22 04:45:00	2026-09-22 04:45:00
cmuewngcr005bpzpdymqh9m7d	cmuewngcp004zpzpdmksrzmt6	cmuet5a4l00l4mivsdl67p0pt	\N	\N	CARD	398.00	CARD-VISA-1102	\N	2026-09-22 08:15:00	2026-09-22 08:15:00
cmuewngdi005spzpd6yslvit3	cmuewngdg005jpzpdzv6xva5i	cmuet5a4b00l2mivsfemad6o1	\N	\N	CASH	109.00	\N	\N	2026-09-22 11:50:00	2026-09-22 11:50:00
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, code, name, description, module, action, "createdAt") FROM stdin;
cmu89lvss0000ad8wmp950bl5	users:create	Create Users	\N	users	create	2026-09-19 10:49:07.132
cmu89lvt40001ad8w02mt55ql	users:read	View Users	\N	users	read	2026-09-19 10:49:07.144
cmu89lvt60002ad8w017jtdw3	users:update	Update Users	\N	users	update	2026-09-19 10:49:07.147
cmu89lvt90003ad8wj25r77e0	users:delete	Delete Users	\N	users	delete	2026-09-19 10:49:07.149
cmu89lvtb0004ad8wy2g5obcc	roles:manage	Manage Roles & Permissions	\N	roles	manage	2026-09-19 10:49:07.152
cmu89lvte0005ad8woij9giqr	organization:read	View Organization	\N	organization	read	2026-09-19 10:49:07.154
cmu89lvtg0006ad8wwg824mco	organization:update	Update Organization	\N	organization	update	2026-09-19 10:49:07.157
cmu89lvtj0007ad8wajn3l38s	branches:manage	Manage Branches	\N	branches	manage	2026-09-19 10:49:07.159
cmu89lvtl0008ad8w860076y4	products:create	Create Products	\N	products	create	2026-09-19 10:49:07.162
cmu89lvto0009ad8wn7dyh0j6	products:read	View Products	\N	products	read	2026-09-19 10:49:07.164
cmu89lvtq000aad8wlgn7fpui	products:update	Update Products	\N	products	update	2026-09-19 10:49:07.167
cmu89lvtt000bad8wztng8tsf	products:delete	Delete Products	\N	products	delete	2026-09-19 10:49:07.169
cmu89lvtv000cad8wr7jveiry	products:import	Import Products	\N	products	import	2026-09-19 10:49:07.171
cmu89lvtx000dad8wmxsc3io4	categories:manage	Manage Categories	\N	categories	manage	2026-09-19 10:49:07.174
cmu89lvu0000ead8wpa6rwaez	inventory:read	View Inventory	\N	inventory	read	2026-09-19 10:49:07.176
cmu89lvu2000fad8wx3mipjwy	inventory:adjust	Adjust Stock	\N	inventory	adjust	2026-09-19 10:49:07.178
cmu89lvu4000gad8wu20nimkx	inventory:approve_adjustment	Approve Stock Adjustments	\N	inventory	approve	2026-09-19 10:49:07.181
cmu89lvu7000had8wxb6ctg7v	inventory:approve_adjustment_chief	Approve Chief Stock Adjustments	\N	inventory	approve_chief	2026-09-19 10:49:07.183
cmu89lvu9000iad8wjjpwp369	batches:read	View Batches	\N	batches	read	2026-09-19 10:49:07.185
cmu89lvub000jad8wqbgnrpyt	batches:update	Update Batches	\N	batches	update	2026-09-19 10:49:07.187
cmu89lvud000kad8wyhqtiuhe	batches:block	Block/Quarantine Batches	\N	batches	block	2026-09-19 10:49:07.19
cmu89lvuf000lad8wfmlmd6yd	batches:dispose	Dispose Batches	\N	batches	dispose	2026-09-19 10:49:07.192
cmu89lvui000mad8w48cyrkkf	sales:create	Create Sales (POS)	\N	sales	create	2026-09-19 10:49:07.194
cmu89lvuk000nad8wra8dnxcm	sales:read	View Sales	\N	sales	read	2026-09-19 10:49:07.196
cmu89lvum000oad8wmstnd5n1	sales:void	Void/Cancel Sales	\N	sales	void	2026-09-19 10:49:07.198
cmu89lvuo000pad8wvb8de32w	sales:discount	Apply Discounts	\N	sales	discount	2026-09-19 10:49:07.2
cmu89lvur000qad8wp21pbao5	sales:discount_override	Override Max Discount	\N	sales	discount_override	2026-09-19 10:49:07.203
cmu89lvuu000rad8w00li4whx	sales:credit	Sell on Credit	\N	sales	credit	2026-09-19 10:49:07.206
cmu89lvuw000sad8wjwa3szat	invoices:print	Print Invoices	\N	invoices	print	2026-09-19 10:49:07.209
cmu89lvuz000tad8wo9zv9r9y	doctors:create	Create Doctors	\N	doctors	create	2026-09-19 10:49:07.211
cmu89lvv2000uad8wt2dbns1e	doctors:read	View Doctors	\N	doctors	read	2026-09-19 10:49:07.214
cmu89lvv4000vad8wfuosyapg	doctors:update	Update Doctors	\N	doctors	update	2026-09-19 10:49:07.216
cmu89lvv6000wad8wo5esq2g9	doctors:delete	Delete Doctors	\N	doctors	delete	2026-09-19 10:49:07.219
cmu89lvv9000xad8w2efvsdq4	prescriptions:create	Create Prescriptions	\N	prescriptions	create	2026-09-19 10:49:07.221
cmu89lvvb000yad8wauxz8cms	prescriptions:read	View Prescriptions	\N	prescriptions	read	2026-09-19 10:49:07.223
cmu89lvvd000zad8wgqdnhgs5	prescriptions:approve	Approve Prescriptions	\N	prescriptions	approve	2026-09-19 10:49:07.226
cmu89lvvf0010ad8wj5tj3fp1	purchases:create	Create Purchase Orders	\N	purchases	create	2026-09-19 10:49:07.228
cmu89lvvi0011ad8w3cebrv6z	purchases:read	View Purchases	\N	purchases	read	2026-09-19 10:49:07.23
cmu89lvvk0012ad8w7mbj08sh	purchases:receive	Receive Stock (GRN)	\N	purchases	receive	2026-09-19 10:49:07.232
cmu89lvvm0013ad8wpouostwf	purchases:update	Update Purchases	\N	purchases	update	2026-09-19 10:49:07.234
cmu89lvvo0014ad8whx7p72a2	returns:create	Process Returns	\N	returns	create	2026-09-19 10:49:07.236
cmu89lvvq0015ad8wpazmuoku	returns:read	View Returns	\N	returns	read	2026-09-19 10:49:07.239
cmu89lvvs0016ad8wexhe6h91	returns:approve	Approve Returns	\N	returns	approve	2026-09-19 10:49:07.241
cmu89lvvv0017ad8wzhijw5qt	customers:create	Create Customers	\N	customers	create	2026-09-19 10:49:07.243
cmu89lvvx0018ad8w79kr2g0m	customers:read	View Customers	\N	customers	read	2026-09-19 10:49:07.245
cmu89lvvz0019ad8wasf0jl8x	customers:update	Update Customers	\N	customers	update	2026-09-19 10:49:07.247
cmu89lvw1001aad8wm3qevhsz	customers:payments	Record Customer Payments	\N	customers	payments	2026-09-19 10:49:07.25
cmu89lvw4001bad8wn02kfpkv	suppliers:create	Create Suppliers	\N	suppliers	create	2026-09-19 10:49:07.252
cmu89lvw6001cad8wtqpgs4cv	suppliers:read	View Suppliers	\N	suppliers	read	2026-09-19 10:49:07.254
cmu89lvw8001dad8wiy4xquj3	suppliers:update	Update Suppliers	\N	suppliers	update	2026-09-19 10:49:07.256
cmu89lvwa001ead8wv2km7xz8	suppliers:payments	Record Supplier Payments	\N	suppliers	payments	2026-09-19 10:49:07.258
cmu89lvwc001fad8w4pg3tp1t	finance:read	View Financial Data	\N	finance	read	2026-09-19 10:49:07.26
cmu89lvwe001gad8w35e1wci6	finance:manage	Manage Finance	\N	finance	manage	2026-09-19 10:49:07.263
cmu89lvwh001had8wsdburfc1	gst:read	View GST Reports	\N	gst	read	2026-09-19 10:49:07.265
cmu89lvwj001iad8wnn7frqjj	gst:manage	Manage GST Settings	\N	gst	manage	2026-09-19 10:49:07.268
cmu89lvwm001jad8wttbbss74	reports:sales	View Sales Reports	\N	reports	sales	2026-09-19 10:49:07.271
cmu89lvwo001kad8w2lcfnyso	reports:purchases	View Purchase Reports	\N	reports	purchases	2026-09-19 10:49:07.273
cmu89lvwr001lad8wxq8bsmyi	reports:inventory	View Inventory Reports	\N	reports	inventory	2026-09-19 10:49:07.275
cmu89lvwt001mad8wjlij0c4u	reports:financial	View Financial Reports	\N	reports	financial	2026-09-19 10:49:07.277
cmu89lvwv001nad8wnx25kt34	reports:export	Export Reports	\N	reports	export	2026-09-19 10:49:07.279
cmu89lvwx001oad8w1png2jv1	audit:read	View Audit Logs	\N	audit	read	2026-09-19 10:49:07.282
cmu89lvx0001pad8wbl64om2o	settings:read	View Settings	\N	settings	read	2026-09-19 10:49:07.284
cmu89lvx2001qad8wg3plmkdz	settings:manage	Manage System Settings	\N	settings	manage	2026-09-19 10:49:07.286
\.


--
-- Data for Name: prescription_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prescription_images (id, "prescriptionId", "fileUrl", "fileName", "fileSize", "mimeType", "uploadedAt") FROM stdin;
\.


--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prescriptions (id, "prescriptionNumber", "patientName", "patientAge", "patientPhone", "doctorName", "doctorRegNumber", "prescriptionDate", notes, status, "approvedById", "approvedAt", "rejectionReason", "customerId", "branchId", "createdAt", "updatedAt", "doctorId") FROM stdin;
cmuewclvd000ah6cjibyebv0k	RX-2026-081	Anita Desai	38	9845077221	Dr. Rajesh Sharma	KMC-45892	2026-09-24 00:12:22.397	Cap. Amoxicillin 500mg 1 TDS x 5 days, Tab. Dolo 650 1 SOS for fever, Betadine Ointment for minor cut.	DISPENSED	\N	\N	\N	cmuewclsu0003h6cja9t0c468	default-branch	2026-09-24 02:12:22.585	2026-09-24 02:12:22.585	cmua62xxk0000k7za1tcylae6
cmuewclvi000ch6cj4tro6oza	RX-2026-082	Rajesh Varma	52	9845088990	Dr. Arvind Kumar	KMC-31204	2026-09-23 21:12:22.397	Tab. P-650 1 SOS for knee pain and mild fever. Regular cardiac review scheduled.	DISPENSED	\N	\N	\N	cmuewclsp0002h6cj7irmbjga	default-branch	2026-09-24 02:12:22.59	2026-09-24 02:12:22.59	cmuewclta0005h6cj3ntaf9oa
cmuewclvm000eh6cjkw45zs11	RX-2026-083	Ramesh Kumar	47	9845012345	Dr. Sneha Kulkarni	KMC-48712	2026-09-23 18:12:22.397	Tab. Dolo 650 1 SOS, Tab. Vitamin C 500mg 1 OD for immunity and metabolic health.	DISPENSED	\N	\N	\N	cmuet5a4g00l3mivsjxhqdmpl	default-branch	2026-09-24 02:12:22.594	2026-09-24 02:12:22.594	cmuewcltl0007h6cjqd5jp3eo
cmuewclvo000gh6cjmu4gq9hh	RX-2026-084	Aarav Sharma (Child of Sunita)	5	9845054321	Dr. Priya Patel	KMC-52190	2026-09-24 01:12:22.397	Calpol Pead 120mg Susp 5ml TDS x 3 days, lukewarm sponging, check temperature TDS.	PENDING	\N	\N	\N	cmuet5a4l00l4mivsdl67p0pt	default-branch	2026-09-24 02:12:22.596	2026-09-24 02:12:22.596	cmuewcltf0006h6cjiuqcrvx8
cmuewclvs000ih6cjwjyred2f	RX-2026-085	Mohammed Farooq	61	9845033445	Dr. Suresh Menon	KMC-29401	2026-09-24 01:42:22.397	Cough Syrup 100ml 10ml BD after meals x 5 days, warm saline gargling.	PENDING	\N	\N	\N	cmuewclsz0004h6cjpwna61lp	default-branch	2026-09-24 02:12:22.601	2026-09-24 02:12:22.601	cmuewcltp0008h6cjeyqy6xcw
\.


--
-- Data for Name: product_barcodes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_barcodes (id, "productId", barcode, type, "isPrimary", "createdAt") FROM stdin;
\.


--
-- Data for Name: product_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_categories (id, "productId", "categoryId") FROM stdin;
cmuet59kd00cpmivsi29lo0hh	cmuet59k000cnmivsfjukq8ga	cmu89lxv500e2ad8wlilrppps
cmuet59kq00ctmivso32hfg8m	cmuet59kn00crmivsww1c894v	cmu89lxv500e2ad8wlilrppps
cmuet59kx00cxmivsev1vqmhl	cmuet59ku00cvmivs5d2e7mxz	cmu89lxvf00e4ad8wcafuo2dq
cmuet59l800d1mivs2oi20y3a	cmuet59l400czmivsz6egqnzt	cmu89lxvy00e9ad8w5hahgy98
cmuet59lg00d5mivs0cp395do	cmuet59lc00d3mivsuszpp7ir	cmu89lxvk00e6ad8w7o4h9yhn
cmuet59lo00d9mivscezgb5nc	cmuet59lk00d7mivswr05kn2g	cmu89lxv500e2ad8wlilrppps
cmuet59lu00ddmivsxhmftx8s	cmuet59lr00dbmivsgl8xm6hk	cmu89lxv500e2ad8wlilrppps
cmuet59m000dhmivs177zr6m4	cmuet59lx00dfmivs71156gvx	cmu89lxvf00e4ad8wcafuo2dq
cmuet59mh00dlmivs4rzwan4v	cmuet59m600djmivs3v2ejnor	cmu89lxvf00e4ad8wcafuo2dq
cmuet59mr00dpmivs49fqkfg3	cmuet59mn00dnmivszkwegfss	cmu89lxv500e2ad8wlilrppps
cmuet59mw00dtmivsjlh9qeyg	cmuet59mu00drmivsq6cwi68r	cmu89lxv500e2ad8wlilrppps
cmuet59n100dxmivs4bpa7qp9	cmuet59mz00dvmivsxdbjul1m	cmu89lxv500e2ad8wlilrppps
cmuet59n600e1mivs60w7neui	cmuet59n400dzmivscjpx13fw	cmu89lxv500e2ad8wlilrppps
cmuet59nd00e5mivs7ebwqhkn	cmuet59na00e3mivs0ey1tcj0	cmu89lxvf00e4ad8wcafuo2dq
cmuet59ni00e9mivsbpg8edjy	cmuet59ng00e7mivsw974nlst	cmu89lxvf00e4ad8wcafuo2dq
cmuet59no00edmivspkrl3bq2	cmuet59nl00ebmivsid0hn6fd	cmu89lxv500e2ad8wlilrppps
cmuet59nu00ehmivsf98t4rzo	cmuet59nq00efmivsqm75t0dt	cmu89lxv500e2ad8wlilrppps
cmuet59nz00elmivscqun90t3	cmuet59nx00ejmivsug03tnb0	cmu89lxv500e2ad8wlilrppps
cmuet59o400epmivsm9gcltce	cmuet59o200enmivst7v7aktu	cmu89lxv500e2ad8wlilrppps
cmuet59o900etmivsqgyuv42a	cmuet59o700ermivsp9a18rte	cmu89lxv500e2ad8wlilrppps
cmuet59oh00exmivsezs993fe	cmuet59oe00evmivswl6igsrm	cmu89lxv500e2ad8wlilrppps
cmuet59om00f1mivsw0p1zyxw	cmuet59ok00ezmivsqyq0yuxg	cmu89lxw100eaad8wfjmilkgo
cmuet59pw00f5mivsp1goixbp	cmuet59oq00f3mivs59yzu7qn	cmu89lxw100eaad8wfjmilkgo
cmuet59qb00f9mivsppkiyowa	cmuet59q700f7mivsctw1i9x3	cmu89lxw100eaad8wfjmilkgo
cmuet59qn00fdmivs1844u0so	cmuet59qf00fbmivstwd1o5l2	cmu89lxv500e2ad8wlilrppps
cmuet59qu00fhmivsdoz9xsev	cmuet59qr00ffmivsbhly40oa	cmu89lxv500e2ad8wlilrppps
cmuet59r100flmivsvraw4otu	cmuet59qy00fjmivs44kucaf8	cmu89lxv500e2ad8wlilrppps
cmuet59ra00fpmivsqrd6d6ab	cmuet59r700fnmivsznhu6ckk	cmu89lxv500e2ad8wlilrppps
cmuet59rh00ftmivs80a010eh	cmuet59re00frmivsqw2zwbum	cmu89lxv500e2ad8wlilrppps
cmuet59rp00fxmivs76qkwe94	cmuet59rk00fvmivs73fioxtt	cmu89lxv500e2ad8wlilrppps
cmuet59rv00g1mivs1ct4yfd1	cmuet59rt00fzmivstjruq3fy	cmu89lxv500e2ad8wlilrppps
cmuet59s100g5mivsuvduuxde	cmuet59ry00g3mivsfxx6wlni	cmu89lxv500e2ad8wlilrppps
cmuet59s800g9mivs3cw0ebpd	cmuet59s500g7mivsx1zjwlh6	cmu89lxvc00e3ad8w17u9cjp7
cmuet59sf00gdmivspyhd1b1m	cmuet59sc00gbmivsm2z36f12	cmu89lxvc00e3ad8w17u9cjp7
cmuet59sl00ghmivsvtmm7nj0	cmuet59si00gfmivs3ma7i4ia	cmu89lxvc00e3ad8w17u9cjp7
cmuet59sw00glmivsnscuzzra	cmuet59so00gjmivsa7ahiqdj	cmu89lxvi00e5ad8w4yga5u12
cmuet59t100gpmivsagcmt9q8	cmuet59sz00gnmivskjqt8gu3	cmu89lxvi00e5ad8w4yga5u12
cmuet59t700gtmivs07ieovsr	cmuet59t400grmivspvehfgiq	cmu89lxvi00e5ad8w4yga5u12
cmuet59tf00gxmivsfchdj31y	cmuet59ta00gvmivs5b0637jw	cmu89lxvn00e7ad8wlnla4vmo
cmuet59tl00h1mivsy0a3urd7	cmuet59ti00gzmivsrsv2zxo5	cmu89lxvn00e7ad8wlnla4vmo
cmuet59tr00h5mivs3x5g6nvp	cmuet59to00h3mivs20hcu5m4	cmu89lxvk00e6ad8w7o4h9yhn
cmuet59tz00h9mivs80ls2yu5	cmuet59tu00h7mivsgifstvkt	cmu89lxvf00e4ad8wcafuo2dq
cmuet59u500hdmivskk7xjkva	cmuet59u200hbmivs1gvp7kal	cmu89lxvf00e4ad8wcafuo2dq
cmvgg2vup0007nm4kl747j5qv	cmvgg2vu00006nm4kxx0bev39	cmu89lxvc00e3ad8w17u9cjp7
cmvgi1vf30059nm4khhhhmncn	cmvgi1vey0058nm4kfsjlonoo	cmu89lxvc00e3ad8w17u9cjp7
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, "genericName", sku, barcode, description, manufacturer, composition, "drugSchedule", "isPrescriptionRequired", "unitOfMeasure", "tabsPerStrip", "packSize", "hsnCode", "gstRate", "cgstRate", "sgstRate", "igstRate", "isGstExempt", mrp, ptr, "costPrice", "minStockLevel", "maxStockLevel", "reorderLevel", "imageUrl", "isActive", "isReturnable", "createdById", "createdAt", "updatedAt", rack) FROM stdin;
cmuet59k000cnmivsfjukq8ga	Paracetamol 500mg	Paracetamol	PCM-500	8901234567890	\N	Generic Pharma	Paracetamol 500mg	NONE	f	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	25.00	20.00	15.00	50	\N	100	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.184	2026-09-24 00:42:41.184	A1
cmuet59kn00crmivsww1c894v	Amoxicillin 500mg	Amoxicillin	AMX-500	8901234567891	\N	Generic Pharma	Amoxicillin 500mg	H	t	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	85.00	68.00	55.00	20	\N	50	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.207	2026-09-24 00:42:41.207	A3
cmuet59ku00cvmivs5d2e7mxz	Cough Syrup 100ml	Dextromethorphan + Phenylephrine	CFS-100	8901234567892	\N	Generic Pharma	Dextromethorphan 10mg + Phenylephrine 5mg per 5ml	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	65.00	52.00	40.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.214	2026-09-24 00:42:41.214	B2
cmuet59l400czmivsz6egqnzt	Vitamin C 500mg	Ascorbic Acid	VTC-500	8901234567893	\N	Health Corp	Ascorbic Acid 500mg	NONE	f	Bottle	60	\N	2106	18.00	9.00	9.00	18.00	f	120.00	96.00	75.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.224	2026-09-24 00:42:41.224	C1
cmuet59lc00d3mivsuszpp7ir	Betadine Ointment 20g	Povidone-Iodine	BET-OIN-20	8901234567894	\N	Win Medicare	Povidone-Iodine 5% w/w	NONE	f	Tube	\N	\N	3004	12.00	6.00	6.00	12.00	f	55.00	44.00	35.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.232	2026-09-24 00:42:41.232	D4
cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	Paracetamol	DLO-650	8901234567901	\N	Micro Labs Ltd	Paracetamol 650mg	NONE	f	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	33.60	26.88	21.00	50	\N	100	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.239	2026-09-24 00:42:41.239	A3
cmuet59lr00dbmivsgl8xm6hk	Dolo 500 Tablet	Paracetamol	DLO-500	8901234567931	\N	Micro Labs Ltd	Paracetamol 500mg	NONE	f	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	16.20	12.96	10.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.247	2026-09-24 00:42:41.247	A3
cmuet59lx00dfmivs71156gvx	Dolo 120mg Syrup	Paracetamol	DLO-120-SYR	8901234567932	\N	Micro Labs Ltd	Paracetamol 120mg per 5ml	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	42.00	33.60	26.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.253	2026-09-24 00:42:41.253	S1
cmuet59m600djmivs3v2ejnor	Dolo 100mg Drops	Paracetamol	DLO-100-DRP	8901234567933	\N	Micro Labs Ltd	Paracetamol 100mg per ml (15ml)	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	38.00	30.40	24.00	15	\N	30	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.261	2026-09-24 00:42:41.261	S1
cmuet59mn00dnmivszkwegfss	Calpol 650 Tab	Paracetamol	CAL-650	8901234567934	\N	GlaxoSmithKline	Paracetamol 650mg	NONE	f	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	32.80	26.24	20.50	40	\N	80	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.279	2026-09-24 00:42:41.279	A4
cmuet59mu00drmivsq6cwi68r	P-650 Tablet	Paracetamol	P650-TAB	8901234567935	\N	Apex Laboratories	Paracetamol 650mg	NONE	f	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	30.50	24.40	19.00	50	\N	100	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.286	2026-09-24 00:42:41.286	B2
cmuet59mz00dvmivsxdbjul1m	Pacimol 650 Tab	Paracetamol	PAC-650	8901234567936	\N	IPCA Laboratories	Paracetamol 650mg	NONE	f	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	31.00	24.80	19.50	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.291	2026-09-24 00:42:41.291	B1
cmuet59n400dzmivscjpx13fw	Sumo L 650mg	Paracetamol	SML-650	8901234567937	\N	Alkem Laboratories	Paracetamol 650mg	NONE	f	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	31.00	24.80	19.50	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.296	2026-09-24 00:42:41.296	B1
cmuet59na00e3mivs0ey1tcj0	Calpol Pead 120mg Susp	Paracetamol	CAL-120-SUSP	8901234567938	\N	GlaxoSmithKline	Paracetamol 120mg per 5ml	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	41.50	33.20	25.50	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.303	2026-09-24 00:42:41.303	S1
cmuet59ng00e7mivsw974nlst	Crocin 120mg Susp	Paracetamol	CRO-120-SUSP	8901234567939	\N	GlaxoSmithKline	Paracetamol 120mg per 5ml	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	40.00	32.00	24.50	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.308	2026-09-24 00:42:41.308	S1
cmuet59nl00ebmivsid0hn6fd	Azithral 500mg (3 Tab)	Azithromycin	AZI-500-3	8901234567940	\N	Alembic Pharmaceuticals	Azithromycin Dihydrate 500mg	H	t	Strip	3	\N	3004	12.00	6.00	6.00	12.00	f	132.00	105.60	85.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.313	2026-09-24 00:42:41.313	A4
cmuet59nq00efmivsqm75t0dt	Augmentin 625 Duo	Amoxicillin + Clavulanic Acid	AUG-625	8901234567902	\N	GlaxoSmithKline	Amoxicillin 500mg + Potassium Clavulanate 125mg	H	t	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	201.00	160.80	135.00	25	\N	50	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.318	2026-09-24 00:42:41.318	A3
cmuet59nx00ejmivsug03tnb0	Azithromycin 500mg	Azithromycin	AZI-500	8901234567903	\N	Cipla Ltd	Azithromycin Dihydrate 500mg	H	t	Strip	5	\N	3004	12.00	6.00	6.00	12.00	f	119.00	95.20	78.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.325	2026-09-24 00:42:41.325	A4
cmuet59o200enmivst7v7aktu	Pan 40mg	Pantoprazole	PAN-40	8901234567904	\N	Alkem Laboratories	Pantoprazole Sodium Gastro-resistant 40mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	95.00	76.00	60.00	40	\N	80	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.33	2026-09-24 00:42:41.33	A2
cmuet59o700ermivsp9a18rte	Telma 40mg	Telmisartan	TLM-40	8901234567905	\N	Glenmark Pharmaceuticals	Telmisartan 40mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	145.00	116.00	92.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.335	2026-09-24 00:42:41.335	B1
cmuet59oe00evmivswl6igsrm	Telma 80mg	Telmisartan	TLM-80	8901234567906	\N	Glenmark Pharmaceuticals	Telmisartan 80mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	230.00	184.00	148.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.342	2026-09-24 00:42:41.342	B1
cmuet59ok00ezmivsqyq0yuxg	Glycomet 500mg	Metformin	GLY-500	8901234567907	\N	USV Pvt Ltd	Metformin Hydrochloride 500mg	H	t	Strip	20	\N	3004	12.00	6.00	6.00	12.00	f	28.00	22.40	17.50	50	\N	100	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.348	2026-09-24 00:42:41.348	B3
cmuet59oq00f3mivs59yzu7qn	Glycomet 850mg	Metformin	GLY-850	8901234567908	\N	USV Pvt Ltd	Metformin Hydrochloride 850mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	42.00	33.60	26.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.354	2026-09-24 00:42:41.354	B3
cmuet59q700f7mivsctw1i9x3	Glycomet 1000mg SR	Metformin SR	GLY-1000	8901234567909	\N	USV Pvt Ltd	Metformin Hydrochloride Sustained Release 1000mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	65.00	52.00	41.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.407	2026-09-24 00:42:41.407	B3
cmuet59qf00fbmivstwd1o5l2	Atorva 10mg	Atorvastatin	ATV-10	8901234567910	\N	Zydus Cadila	Atorvastatin Calcium 10mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	110.00	88.00	70.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.415	2026-09-24 00:42:41.415	B4
cmuet59qr00ffmivsbhly40oa	Atorva 20mg	Atorvastatin	ATV-20	8901234567911	\N	Zydus Cadila	Atorvastatin Calcium 20mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	195.00	156.00	125.00	25	\N	50	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.427	2026-09-24 00:42:41.427	B4
cmuet59qy00fjmivs44kucaf8	Atorva 40mg	Atorvastatin	ATV-40	8901234567912	\N	Zydus Cadila	Atorvastatin Calcium 40mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	320.00	256.00	205.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.434	2026-09-24 00:42:41.434	B4
cmuet59r700fnmivsznhu6ckk	Montair LC	Montelukast + Levocetirizine	MLC-15	8901234567913	\N	Cipla Ltd	Montelukast 10mg + Levocetirizine 5mg	H	t	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	180.00	144.00	115.00	40	\N	80	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.443	2026-09-24 00:42:41.443	A5
cmuet59re00frmivsqw2zwbum	Cetirizine 10mg	Cetirizine Hydrochloride	CTZ-10	8901234567914	\N	Dr. Reddy Labs	Cetirizine Hydrochloride 10mg	NONE	f	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	22.00	17.60	13.50	50	\N	100	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.45	2026-09-24 00:42:41.45	A5
cmuet59rk00fvmivs73fioxtt	Ciplox 500mg	Ciprofloxacin	CPX-500	8901234567915	\N	Cipla Ltd	Ciprofloxacin Hydrochloride 500mg	H	t	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	48.00	38.40	30.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.456	2026-09-24 00:42:41.456	A4
cmuet59rt00fzmivstjruq3fy	Brufen 400mg	Ibuprofen	BRF-400	8901234567916	\N	Abbott Healthcare	Ibuprofen 400mg	NONE	f	Strip	15	\N	3004	12.00	6.00	6.00	12.00	f	35.00	28.00	21.00	40	\N	80	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.465	2026-09-24 00:42:41.465	A1
cmuet59ry00g3mivsfxx6wlni	Combiflam	Ibuprofen + Paracetamol	CBF-725	8901234567917	\N	Sanofi India	Ibuprofen 400mg + Paracetamol 325mg	NONE	f	Strip	20	\N	3004	12.00	6.00	6.00	12.00	f	44.00	35.20	27.50	50	\N	100	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.47	2026-09-24 00:42:41.47	A1
cmuet59s500g7mivsx1zjwlh6	Becozym C Forte	B-Complex + Vitamin C + Biotin	BCZ-CAP	8901234567918	\N	Bayer Pharmaceuticals	Thiamine 10mg + Riboflavin 10mg + Niacinamide 50mg + Vit C 150mg + Biotin 100mcg	NONE	f	Strip	20	\N	2106	18.00	9.00	9.00	18.00	f	60.00	48.00	38.00	40	\N	80	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.476	2026-09-24 00:42:41.476	C1
cmuet59sc00gbmivsm2z36f12	Omez 20mg Capsule	Omeprazole	OMZ-20	8901234567919	\N	Dr. Reddy Labs	Omeprazole Gastro-resistant 20mg	H	t	Strip	20	\N	3004	12.00	6.00	6.00	12.00	f	72.00	57.60	45.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.485	2026-09-24 00:42:41.485	A2
cmuet59si00gfmivs3ma7i4ia	Rabeprazole + Domperidone (Rablet-D)	Rabeprazole + Domperidone SR	RBL-D	8901234567920	\N	Lupin Ltd	Rabeprazole Sodium 20mg + Domperidone Sustained Release 30mg	H	t	Strip	10	\N	3004	12.00	6.00	6.00	12.00	f	185.00	148.00	118.00	25	\N	50	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.49	2026-09-24 00:42:41.49	A2
cmuet59so00gjmivsa7ahiqdj	Monocef 1g Injection	Ceftriaxone Sodium	MCF-1G	8901234567921	\N	Aristo Pharmaceuticals	Ceftriaxone Sodium Sterile 1000mg (1g)	H1	t	Vial	\N	\N	3004	12.00	6.00	6.00	12.00	f	75.00	60.00	48.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.496	2026-09-24 00:42:41.496	INJ-1
cmuet59sz00gnmivskjqt8gu3	Dynapar AQ 75mg/ml Injection	Diclofenac Sodium	DYN-75	8901234567922	\N	Troikaa Pharmaceuticals	Diclofenac Sodium 75mg per ml	H	t	Ampoule	\N	\N	3004	12.00	6.00	6.00	12.00	f	35.00	28.00	22.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.507	2026-09-24 00:42:41.507	INJ-1
cmuet59t400grmivspvehfgiq	Pantocid 40mg IV Injection	Pantoprazole Sodium	PAN-40-INJ	8901234567923	\N	Sun Pharma	Pantoprazole Sodium Lyophilized 40mg	H	t	Vial	\N	\N	3004	12.00	6.00	6.00	12.00	f	54.00	43.20	34.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.512	2026-09-24 00:42:41.512	INJ-2
cmuet59ta00gvmivs5b0637jw	Ciplox Eye/Ear Drops 10ml	Ciprofloxacin Ophthalmic	CPX-DRP	8901234567924	\N	Cipla Ltd	Ciprofloxacin 0.3% w/v	H	t	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	20.00	16.00	12.00	25	\N	50	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.518	2026-09-24 00:42:41.518	DRP-1
cmuet59ti00gzmivsrsv2zxo5	Refresh Tears Eye Drops 10ml	Carboxymethylcellulose	RFT-10	8901234567925	\N	Allergan India	Carboxymethylcellulose Sodium 0.5% w/v	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	140.00	112.00	88.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.526	2026-09-24 00:42:41.526	DRP-1
cmuet59to00h3mivs20hcu5m4	Volini Pain Relief Gel 30g	Diclofenac Diethylamine + Linseed Oil	VOL-GEL-30	8901234567926	\N	Sun Pharma	Diclofenac Diethylamine 1.16% + Linseed Oil 3% + Methyl Salicylate 10% + Menthol 5%	NONE	f	Tube	\N	\N	3004	12.00	6.00	6.00	12.00	f	90.00	72.00	56.00	20	\N	40	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.532	2026-09-24 00:42:41.532	D4
cmuet59tu00h7mivsgifstvkt	Ascoril D Plus Syrup 100ml	Dextromethorphan + Phenylephrine + CPM	ASC-100	8901234567927	\N	Glenmark Pharmaceuticals	Dextromethorphan 10mg + Phenylephrine 5mg + Chlorpheniramine 2mg per 5ml	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	115.00	92.00	72.00	30	\N	60	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.538	2026-09-24 00:42:41.538	B2
cmuet59u200hbmivs1gvp7kal	Aristozyme Liquid 200ml	Fungal Diastase + Pepsin	ARZ-200	8901234567928	\N	Aristo Pharmaceuticals	Diastase 50mg + Pepsin 10mg per 5ml	NONE	f	Bottle	\N	\N	3004	12.00	6.00	6.00	12.00	f	135.00	108.00	85.00	25	\N	50	\N	t	t	cmuet589u00b1mivst65bse94	2026-09-24 00:42:41.546	2026-09-24 00:42:41.546	B2
cmvgg2vu00006nm4kxx0bev39	Metacol	dolo650	100	\N	fever	meta		H	t	Strip	2	10	\N	12.00	6.00	6.00	12.00	f	32.20	24.00	\N	10	100	20	\N	t	t	cmuet58n500b5mivs1fu4l3px	2026-10-20 08:52:09.767	2026-10-20 08:52:09.767	\N
cmvgi1vey0058nm4kfsjlonoo	mrta		33	\N				NONE	f	Strip	3		\N	12.00	6.00	6.00	12.00	f	0.00	\N	\N	10	22	20	\N	t	t	cmuet58n500b5mivs1fu4l3px	2026-10-20 09:47:21.802	2026-10-20 09:47:21.802	\N
\.


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_items (id, "purchaseId", "productId", "batchId", "orderedQuantity", "receivedQuantity", "freeQuantity", "unitCost", mrp, ptr, "discountPercent", "taxPercent", "taxAmount", "totalAmount", "batchNumber", "expiryDate", "manufacturingDate", "createdAt") FROM stdin;
cmuewclw7000mh6cjpmho9dka	cmuewclw7000kh6cjeblvgws9	cmuet59lk00d7mivswr05kn2g	\N	200	200	0	21.00	33.60	\N	0.00	12.00	504.00	4704.00	D-101	2028-05-16 02:12:22.397	2026-05-27 02:12:22.397	2026-09-24 02:12:22.615
cmuewclw8000nh6cjutqhszun	cmuewclw7000kh6cjeblvgws9	cmuet59lr00dbmivsgl8xm6hk	\N	100	100	0	10.00	16.20	\N	0.00	12.00	120.00	1120.00	D-044	2028-03-17 02:12:22.397	2026-05-27 02:12:22.397	2026-09-24 02:12:22.615
cmuewclw8000oh6cjg8s4uhwl	cmuewclw7000kh6cjeblvgws9	cmuet59kn00crmivsww1c894v	\N	100	100	0	55.00	85.00	\N	0.00	12.00	660.00	6160.00	BAT-AMX-500-01	2028-03-17 02:12:22.397	2026-06-26 02:12:22.397	2026-09-24 02:12:22.615
cmuewclx1000yh6cj2e1z9zfx	cmuewclx1000wh6cjxrwcrcyr	cmuet59mn00dnmivszkwegfss	\N	100	100	0	20.50	32.80	\N	0.00	12.00	246.00	2296.00	CP-650	2028-07-15 02:12:22.397	2026-06-26 02:12:22.397	2026-09-24 02:12:22.645
cmuewclx1000zh6cjk8tiad4p	cmuewclx1000wh6cjxrwcrcyr	cmuet59mu00drmivsq6cwi68r	\N	200	200	0	19.00	30.50	\N	0.00	12.00	456.00	4256.00	P-650-B	2028-09-13 02:12:22.397	2026-07-26 02:12:22.397	2026-09-24 02:12:22.645
cmuewclx10010h6cj4znpyzht	cmuewclx1000wh6cjxrwcrcyr	cmuet59ku00cvmivs5d2e7mxz	\N	80	80	0	40.00	65.00	\N	0.00	12.00	384.00	3584.00	BAT-CFS-100-01	2028-03-17 02:12:22.397	2026-06-26 02:12:22.397	2026-09-24 02:12:22.645
cmuewclxc001ah6cjb7x0wex6	cmuewclxc0018h6cjjl23eqx5	cmuet59l400czmivsz6egqnzt	\N	100	100	0	75.00	120.00	\N	0.00	12.00	900.00	8400.00	BAT-VTC-500-01	2028-03-17 02:12:22.397	2026-07-26 02:12:22.397	2026-09-24 02:12:22.656
cmuewclxc001bh6cj46rjdtv9	cmuewclxc0018h6cjjl23eqx5	cmuet59lc00d3mivsuszpp7ir	\N	100	100	0	35.00	55.00	\N	0.00	12.00	420.00	3920.00	BAT-BET-OIN-20-01	2028-03-17 02:12:22.397	2026-07-26 02:12:22.397	2026-09-24 02:12:22.656
cmuewclxo001jh6cj9k6ltx7y	cmuewclxn001hh6cj8yxloai5	cmuet59na00e3mivs0ey1tcj0	\N	50	0	0	25.50	41.50	\N	0.00	12.00	153.00	1428.00	\N	\N	\N	2026-09-24 02:12:22.668
cmuewclxo001kh6cjoxjam96v	cmuewclxn001hh6cj8yxloai5	cmuet59ng00e7mivsw974nlst	\N	50	0	0	24.50	40.00	\N	0.00	12.00	147.00	1372.00	\N	\N	\N	2026-09-24 02:12:22.668
\.


--
-- Data for Name: purchase_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_return_items (id, "purchaseReturnId", "productId", "batchId", quantity, "unitCost", "totalAmount", reason) FROM stdin;
\.


--
-- Data for Name: purchase_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_returns (id, "returnNumber", "purchaseId", "supplierId", "returnDate", reason, "totalAmount", status, notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchases (id, "purchaseNumber", "branchId", "supplierId", "invoiceNumber", "invoiceDate", "purchaseDate", "expectedDate", status, subtotal, "discountAmount", "taxAmount", "totalAmount", "amountPaid", "balanceDue", notes, "receivedAt", "createdById", "createdAt", "updatedAt") FROM stdin;
cmuewclw7000kh6cjeblvgws9	PO-2026-001	default-branch	cmuet5a4400l1mivsvbaaec14	SP-INV-84920	2026-09-14 02:12:22.397	2026-09-14 02:12:22.397	2026-09-14 02:12:22.397	RECEIVED	10700.00	0.00	1284.00	11984.00	11984.00	0.00	Monthly bulk replenishment order for analgesic and antibiotic fast-movers.	2026-09-14 02:12:22.397	cmuet589u00b1mivst65bse94	2026-09-24 02:12:22.615	2026-09-24 02:12:22.615
cmuewclx1000wh6cjxrwcrcyr	PO-2026-002	default-branch	cmuet5a3z00l0mivsxt2uk08d	ML-INV-39482	2026-09-18 02:12:22.397	2026-09-18 02:12:22.397	2026-09-18 02:12:22.397	RECEIVED	9050.00	0.00	1086.00	10136.00	10136.00	0.00	Restock of Calpol and pediatric syrups.	2026-09-18 02:12:22.397	cmuet589u00b1mivst65bse94	2026-09-24 02:12:22.645	2026-09-24 02:12:22.645
cmuewclxc0018h6cjjl23eqx5	PO-2026-003	default-branch	cmuewclql0000h6cj5md12c1s	CIP-BLR-1029	2026-09-21 02:12:22.397	2026-09-21 02:12:22.397	2026-09-21 02:12:22.397	RECEIVED	11000.00	0.00	1320.00	12320.00	12320.00	0.00	Top-up of first aid ointments and vitamin supplements.	2026-09-21 02:12:22.397	cmuet589u00b1mivst65bse94	2026-09-24 02:12:22.656	2026-09-24 02:12:22.656
cmuewclxn001hh6cj8yxloai5	PO-2026-004	default-branch	cmuewclqw0001h6cjkpme8ifk	\N	\N	2026-09-23 02:12:22.397	2026-09-26 02:12:22.397	ORDERED	2500.00	0.00	300.00	2800.00	0.00	2800.00	Pediatric suspension indent pending dispatch from warehouse.	\N	cmuet589u00b1mivst65bse94	2026-09-24 02:12:22.668	2026-09-24 02:12:22.668
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, "roleId", "permissionId", "createdAt") FROM stdin;
cmuet57o1001omivsmyczkh6o	cmu89lvx8001rad8whyvfp1p0	cmu89lvss0000ad8wmp950bl5	2026-09-24 00:42:38.737
cmuet57o5001qmivsjpdtunf5	cmu89lvx8001rad8whyvfp1p0	cmu89lvt40001ad8w02mt55ql	2026-09-24 00:42:38.741
cmuet57o7001smivsd3rnojbu	cmu89lvx8001rad8whyvfp1p0	cmu89lvt60002ad8w017jtdw3	2026-09-24 00:42:38.743
cmuet57o8001umivs5yr1kna9	cmu89lvx8001rad8whyvfp1p0	cmu89lvt90003ad8wj25r77e0	2026-09-24 00:42:38.744
cmuet57o9001wmivsnoinllqc	cmu89lvx8001rad8whyvfp1p0	cmu89lvtb0004ad8wy2g5obcc	2026-09-24 00:42:38.746
cmuet57ob001ymivs5vmodl3v	cmu89lvx8001rad8whyvfp1p0	cmu89lvte0005ad8woij9giqr	2026-09-24 00:42:38.747
cmuet57oc0020mivshycs4v8e	cmu89lvx8001rad8whyvfp1p0	cmu89lvtg0006ad8wwg824mco	2026-09-24 00:42:38.749
cmuet57od0022mivsdc72z80m	cmu89lvx8001rad8whyvfp1p0	cmu89lvtj0007ad8wajn3l38s	2026-09-24 00:42:38.75
cmuet57oh0024mivsr67pm2p7	cmu89lvx8001rad8whyvfp1p0	cmu89lvtl0008ad8w860076y4	2026-09-24 00:42:38.754
cmuet57oj0026mivsa98kkp4c	cmu89lvx8001rad8whyvfp1p0	cmu89lvto0009ad8wn7dyh0j6	2026-09-24 00:42:38.755
cmuet57ok0028mivsi07fv63a	cmu89lvx8001rad8whyvfp1p0	cmu89lvtq000aad8wlgn7fpui	2026-09-24 00:42:38.757
cmuet57om002amivsa6il6aea	cmu89lvx8001rad8whyvfp1p0	cmu89lvtt000bad8wztng8tsf	2026-09-24 00:42:38.758
cmuet57on002cmivsy7mdsrmd	cmu89lvx8001rad8whyvfp1p0	cmu89lvtv000cad8wr7jveiry	2026-09-24 00:42:38.759
cmuet57op002emivssnzoun9c	cmu89lvx8001rad8whyvfp1p0	cmu89lvtx000dad8wmxsc3io4	2026-09-24 00:42:38.761
cmuet57oq002gmivs127wjjcm	cmu89lvx8001rad8whyvfp1p0	cmu89lvu0000ead8wpa6rwaez	2026-09-24 00:42:38.762
cmuet57os002imivsdy0g88bi	cmu89lvx8001rad8whyvfp1p0	cmu89lvu2000fad8wx3mipjwy	2026-09-24 00:42:38.764
cmuet57ot002kmivs8vb1soi2	cmu89lvx8001rad8whyvfp1p0	cmu89lvu4000gad8wu20nimkx	2026-09-24 00:42:38.765
cmuet57ov002mmivsxsf7zlmi	cmu89lvx8001rad8whyvfp1p0	cmu89lvu7000had8wxb6ctg7v	2026-09-24 00:42:38.767
cmuet57ow002omivsr69igcj9	cmu89lvx8001rad8whyvfp1p0	cmu89lvu9000iad8wjjpwp369	2026-09-24 00:42:38.768
cmuet57ox002qmivsdldfof7i	cmu89lvx8001rad8whyvfp1p0	cmu89lvub000jad8wqbgnrpyt	2026-09-24 00:42:38.77
cmuet57p1002smivsjbj14lu8	cmu89lvx8001rad8whyvfp1p0	cmu89lvud000kad8wyhqtiuhe	2026-09-24 00:42:38.773
cmuet57p2002umivsz4tmak7j	cmu89lvx8001rad8whyvfp1p0	cmu89lvuf000lad8wfmlmd6yd	2026-09-24 00:42:38.775
cmuet57p4002wmivsw1f1k132	cmu89lvx8001rad8whyvfp1p0	cmu89lvui000mad8w48cyrkkf	2026-09-24 00:42:38.776
cmuet57p5002ymivsequf1zb0	cmu89lvx8001rad8whyvfp1p0	cmu89lvuk000nad8wra8dnxcm	2026-09-24 00:42:38.777
cmuet57p70030mivskh5vxwh6	cmu89lvx8001rad8whyvfp1p0	cmu89lvum000oad8wmstnd5n1	2026-09-24 00:42:38.779
cmuet57p80032mivs7agabpyq	cmu89lvx8001rad8whyvfp1p0	cmu89lvuo000pad8wvb8de32w	2026-09-24 00:42:38.78
cmuet57pa0034mivstcdlcccx	cmu89lvx8001rad8whyvfp1p0	cmu89lvur000qad8wp21pbao5	2026-09-24 00:42:38.782
cmuet57pb0036mivsr1zsk7z2	cmu89lvx8001rad8whyvfp1p0	cmu89lvuu000rad8w00li4whx	2026-09-24 00:42:38.783
cmuet57pc0038mivsiqtviuqz	cmu89lvx8001rad8whyvfp1p0	cmu89lvuw000sad8wjwa3szat	2026-09-24 00:42:38.785
cmuet57pe003amivskiokur1g	cmu89lvx8001rad8whyvfp1p0	cmu89lvuz000tad8wo9zv9r9y	2026-09-24 00:42:38.786
cmuet57pf003cmivsoh4x71ae	cmu89lvx8001rad8whyvfp1p0	cmu89lvv2000uad8wt2dbns1e	2026-09-24 00:42:38.787
cmuet57pg003emivslinnngwp	cmu89lvx8001rad8whyvfp1p0	cmu89lvv4000vad8wfuosyapg	2026-09-24 00:42:38.788
cmuet57ph003gmivsyy7111lo	cmu89lvx8001rad8whyvfp1p0	cmu89lvv6000wad8wo5esq2g9	2026-09-24 00:42:38.79
cmuet57pk003imivspy35li0c	cmu89lvx8001rad8whyvfp1p0	cmu89lvv9000xad8w2efvsdq4	2026-09-24 00:42:38.793
cmuet57pm003kmivsegsinbvi	cmu89lvx8001rad8whyvfp1p0	cmu89lvvb000yad8wauxz8cms	2026-09-24 00:42:38.794
cmuet57pn003mmivs39dv3cxm	cmu89lvx8001rad8whyvfp1p0	cmu89lvvd000zad8wgqdnhgs5	2026-09-24 00:42:38.795
cmuet57po003omivscbsyfwwm	cmu89lvx8001rad8whyvfp1p0	cmu89lvvf0010ad8wj5tj3fp1	2026-09-24 00:42:38.797
cmuet57pp003qmivscpyhkp74	cmu89lvx8001rad8whyvfp1p0	cmu89lvvi0011ad8w3cebrv6z	2026-09-24 00:42:38.798
cmuet57pr003smivsa4j50ekv	cmu89lvx8001rad8whyvfp1p0	cmu89lvvk0012ad8w7mbj08sh	2026-09-24 00:42:38.799
cmuet57ps003umivsk5fyjgz8	cmu89lvx8001rad8whyvfp1p0	cmu89lvvm0013ad8wpouostwf	2026-09-24 00:42:38.8
cmuet57pt003wmivsbj6weead	cmu89lvx8001rad8whyvfp1p0	cmu89lvvo0014ad8whx7p72a2	2026-09-24 00:42:38.801
cmuet57pu003ymivs99xu042j	cmu89lvx8001rad8whyvfp1p0	cmu89lvvq0015ad8wpazmuoku	2026-09-24 00:42:38.803
cmuet57pv0040mivs72fw76a5	cmu89lvx8001rad8whyvfp1p0	cmu89lvvs0016ad8wexhe6h91	2026-09-24 00:42:38.804
cmuet57px0042mivsztjsuk25	cmu89lvx8001rad8whyvfp1p0	cmu89lvvv0017ad8wzhijw5qt	2026-09-24 00:42:38.805
cmuet57py0044mivs2xz94fs5	cmu89lvx8001rad8whyvfp1p0	cmu89lvvx0018ad8w79kr2g0m	2026-09-24 00:42:38.806
cmuet57pz0046mivsanad10s4	cmu89lvx8001rad8whyvfp1p0	cmu89lvvz0019ad8wasf0jl8x	2026-09-24 00:42:38.808
cmuet57q00048mivs4z1xq8n8	cmu89lvx8001rad8whyvfp1p0	cmu89lvw1001aad8wm3qevhsz	2026-09-24 00:42:38.809
cmuet57q2004amivsa7ffpv5f	cmu89lvx8001rad8whyvfp1p0	cmu89lvw4001bad8wn02kfpkv	2026-09-24 00:42:38.81
cmuet57q5004cmivs5lvrk8u8	cmu89lvx8001rad8whyvfp1p0	cmu89lvw6001cad8wtqpgs4cv	2026-09-24 00:42:38.813
cmuet57q6004emivsw4wqp22s	cmu89lvx8001rad8whyvfp1p0	cmu89lvw8001dad8wiy4xquj3	2026-09-24 00:42:38.815
cmuet57q8004gmivs0ut9i5kj	cmu89lvx8001rad8whyvfp1p0	cmu89lvwa001ead8wv2km7xz8	2026-09-24 00:42:38.816
cmuet57q9004imivs6p5ru7dd	cmu89lvx8001rad8whyvfp1p0	cmu89lvwc001fad8w4pg3tp1t	2026-09-24 00:42:38.817
cmuet57qa004kmivsbrrv6fnu	cmu89lvx8001rad8whyvfp1p0	cmu89lvwe001gad8w35e1wci6	2026-09-24 00:42:38.818
cmuet57qb004mmivs5c5fxecf	cmu89lvx8001rad8whyvfp1p0	cmu89lvwh001had8wsdburfc1	2026-09-24 00:42:38.82
cmuet57qc004omivsdnay34rr	cmu89lvx8001rad8whyvfp1p0	cmu89lvwj001iad8wnn7frqjj	2026-09-24 00:42:38.821
cmuet57qe004qmivsei86rj1z	cmu89lvx8001rad8whyvfp1p0	cmu89lvwm001jad8wttbbss74	2026-09-24 00:42:38.822
cmuet57qf004smivsiqxkq1kn	cmu89lvx8001rad8whyvfp1p0	cmu89lvwo001kad8w2lcfnyso	2026-09-24 00:42:38.823
cmuet57qg004umivs0aj7hhqw	cmu89lvx8001rad8whyvfp1p0	cmu89lvwr001lad8wxq8bsmyi	2026-09-24 00:42:38.824
cmuet57qh004wmivsmqnve0jm	cmu89lvx8001rad8whyvfp1p0	cmu89lvwt001mad8wjlij0c4u	2026-09-24 00:42:38.826
cmuet57qi004ymivs8raejeup	cmu89lvx8001rad8whyvfp1p0	cmu89lvwv001nad8wnx25kt34	2026-09-24 00:42:38.827
cmuet57qk0050mivsg51q29zs	cmu89lvx8001rad8whyvfp1p0	cmu89lvwx001oad8w1png2jv1	2026-09-24 00:42:38.828
cmuet57ql0052mivsjf0a2rmf	cmu89lvx8001rad8whyvfp1p0	cmu89lvx0001pad8wbl64om2o	2026-09-24 00:42:38.829
cmuet57qp0054mivsgob06y2d	cmu89lvx8001rad8whyvfp1p0	cmu89lvx2001qad8wg3plmkdz	2026-09-24 00:42:38.83
cmuet57qv0057mivsqm4nsq7t	cmu89lvzw005aad8wmv4s8dnc	cmu89lvt40001ad8w02mt55ql	2026-09-24 00:42:38.84
cmuet57qx0059mivsdrnsj96w	cmu89lvzw005aad8wmv4s8dnc	cmu89lvss0000ad8wmp950bl5	2026-09-24 00:42:38.841
cmuet57qy005bmivsnc6mw8bg	cmu89lvzw005aad8wmv4s8dnc	cmu89lvt60002ad8w017jtdw3	2026-09-24 00:42:38.842
cmuet57qz005dmivs15tqqbnm	cmu89lvzw005aad8wmv4s8dnc	cmu89lvte0005ad8woij9giqr	2026-09-24 00:42:38.844
cmuet57r0005fmivsubq52xu6	cmu89lvzw005aad8wmv4s8dnc	cmu89lvtj0007ad8wajn3l38s	2026-09-24 00:42:38.845
cmuet57r2005hmivsmi978yao	cmu89lvzw005aad8wmv4s8dnc	cmu89lvtl0008ad8w860076y4	2026-09-24 00:42:38.846
cmuet57r3005jmivsnjyk05ag	cmu89lvzw005aad8wmv4s8dnc	cmu89lvto0009ad8wn7dyh0j6	2026-09-24 00:42:38.847
cmuet57r4005lmivsolnqfstd	cmu89lvzw005aad8wmv4s8dnc	cmu89lvtq000aad8wlgn7fpui	2026-09-24 00:42:38.848
cmuet57r9005nmivs3jouki2f	cmu89lvzw005aad8wmv4s8dnc	cmu89lvtt000bad8wztng8tsf	2026-09-24 00:42:38.853
cmuet57ra005pmivs5obtg4mx	cmu89lvzw005aad8wmv4s8dnc	cmu89lvtv000cad8wr7jveiry	2026-09-24 00:42:38.855
cmuet57rc005rmivscozdapsg	cmu89lvzw005aad8wmv4s8dnc	cmu89lvtx000dad8wmxsc3io4	2026-09-24 00:42:38.856
cmuet57rd005tmivsfv09djqg	cmu89lvzw005aad8wmv4s8dnc	cmu89lvu0000ead8wpa6rwaez	2026-09-24 00:42:38.858
cmuet57rf005vmivseh9la0o0	cmu89lvzw005aad8wmv4s8dnc	cmu89lvu2000fad8wx3mipjwy	2026-09-24 00:42:38.859
cmuet57rh005xmivs24nssnq9	cmu89lvzw005aad8wmv4s8dnc	cmu89lvu4000gad8wu20nimkx	2026-09-24 00:42:38.861
cmuet57ri005zmivsp31zd5ks	cmu89lvzw005aad8wmv4s8dnc	cmu89lvu9000iad8wjjpwp369	2026-09-24 00:42:38.862
cmuet57rj0061mivs6njaf86f	cmu89lvzw005aad8wmv4s8dnc	cmu89lvub000jad8wqbgnrpyt	2026-09-24 00:42:38.864
cmuet57rl0063mivsiv5jsfuj	cmu89lvzw005aad8wmv4s8dnc	cmu89lvud000kad8wyhqtiuhe	2026-09-24 00:42:38.865
cmuet57rm0065mivsnjnhr5v9	cmu89lvzw005aad8wmv4s8dnc	cmu89lvuf000lad8wfmlmd6yd	2026-09-24 00:42:38.866
cmuet57rn0067mivsfsers5la	cmu89lvzw005aad8wmv4s8dnc	cmu89lvui000mad8w48cyrkkf	2026-09-24 00:42:38.867
cmuet57ro0069mivsyibj5uvc	cmu89lvzw005aad8wmv4s8dnc	cmu89lvuk000nad8wra8dnxcm	2026-09-24 00:42:38.869
cmuet57rp006bmivs1m40nuqy	cmu89lvzw005aad8wmv4s8dnc	cmu89lvum000oad8wmstnd5n1	2026-09-24 00:42:38.87
cmuet57rt006dmivsqq1x3u3h	cmu89lvzw005aad8wmv4s8dnc	cmu89lvuo000pad8wvb8de32w	2026-09-24 00:42:38.874
cmuet57rv006fmivsadotzpza	cmu89lvzw005aad8wmv4s8dnc	cmu89lvur000qad8wp21pbao5	2026-09-24 00:42:38.875
cmuet57rw006hmivslfow88n8	cmu89lvzw005aad8wmv4s8dnc	cmu89lvuu000rad8w00li4whx	2026-09-24 00:42:38.876
cmuet57rx006jmivs3w88suub	cmu89lvzw005aad8wmv4s8dnc	cmu89lvuw000sad8wjwa3szat	2026-09-24 00:42:38.878
cmuet57ry006lmivs7sew11ef	cmu89lvzw005aad8wmv4s8dnc	cmu89lvv9000xad8w2efvsdq4	2026-09-24 00:42:38.879
cmuet57rz006nmivs6ruruu7i	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvb000yad8wauxz8cms	2026-09-24 00:42:38.88
cmuet57s1006pmivs0q1q1vsd	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvd000zad8wgqdnhgs5	2026-09-24 00:42:38.881
cmuet57s2006rmivsgvoot5fi	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvf0010ad8wj5tj3fp1	2026-09-24 00:42:38.882
cmuet57s3006tmivsr08bqpce	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvi0011ad8w3cebrv6z	2026-09-24 00:42:38.883
cmuet57s4006vmivsbwk9cd8u	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvk0012ad8w7mbj08sh	2026-09-24 00:42:38.885
cmuet57s5006xmivs58i1fuyg	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvm0013ad8wpouostwf	2026-09-24 00:42:38.886
cmuet57s7006zmivsfnnak7sw	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvo0014ad8whx7p72a2	2026-09-24 00:42:38.887
cmuet57s80071mivs8u8j2237	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvq0015ad8wpazmuoku	2026-09-24 00:42:38.888
cmuet57s90073mivs4o1e8jak	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvs0016ad8wexhe6h91	2026-09-24 00:42:38.89
cmuet57sd0075mivss4p5oi57	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvv0017ad8wzhijw5qt	2026-09-24 00:42:38.893
cmuet57se0077mivs78yrnr5q	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvx0018ad8w79kr2g0m	2026-09-24 00:42:38.894
cmuet57sf0079mivsy5t0w61w	cmu89lvzw005aad8wmv4s8dnc	cmu89lvvz0019ad8wasf0jl8x	2026-09-24 00:42:38.896
cmuet57sh007bmivs3qkh4rxy	cmu89lvzw005aad8wmv4s8dnc	cmu89lvw1001aad8wm3qevhsz	2026-09-24 00:42:38.897
cmuet57si007dmivs5xl1woiu	cmu89lvzw005aad8wmv4s8dnc	cmu89lvw4001bad8wn02kfpkv	2026-09-24 00:42:38.898
cmuet57sj007fmivsku91nfm1	cmu89lvzw005aad8wmv4s8dnc	cmu89lvw6001cad8wtqpgs4cv	2026-09-24 00:42:38.899
cmuet57sk007hmivsg58mw041	cmu89lvzw005aad8wmv4s8dnc	cmu89lvw8001dad8wiy4xquj3	2026-09-24 00:42:38.901
cmuet57sl007jmivst8hp2r1f	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwa001ead8wv2km7xz8	2026-09-24 00:42:38.902
cmuet57sm007lmivsa2l4agkd	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwc001fad8w4pg3tp1t	2026-09-24 00:42:38.903
cmuet57so007nmivsxcgzwwdg	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwe001gad8w35e1wci6	2026-09-24 00:42:38.904
cmuet57sp007pmivs80e9dsld	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwh001had8wsdburfc1	2026-09-24 00:42:38.905
cmuet57sq007rmivsuvbawskk	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwj001iad8wnn7frqjj	2026-09-24 00:42:38.906
cmuet57sr007tmivszwzam6de	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwm001jad8wttbbss74	2026-09-24 00:42:38.908
cmuet57st007vmivs7jtxohac	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwo001kad8w2lcfnyso	2026-09-24 00:42:38.909
cmuet57su007xmivstkq6parz	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwr001lad8wxq8bsmyi	2026-09-24 00:42:38.91
cmuet57sx007zmivs6rct3l6r	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwt001mad8wjlij0c4u	2026-09-24 00:42:38.914
cmuet57sz0081mivscqa81xgt	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwv001nad8wnx25kt34	2026-09-24 00:42:38.915
cmuet57t00083mivshlutu49a	cmu89lvzw005aad8wmv4s8dnc	cmu89lvwx001oad8w1png2jv1	2026-09-24 00:42:38.916
cmuet57t10085mivsew7faz6c	cmu89lvzw005aad8wmv4s8dnc	cmu89lvx0001pad8wbl64om2o	2026-09-24 00:42:38.918
cmuet57t50088mivs0fnp2e76	cmu89lw20008jad8w89btlbg3	cmu89lvto0009ad8wn7dyh0j6	2026-09-24 00:42:38.921
cmuet57t6008amivscgackhsn	cmu89lw20008jad8w89btlbg3	cmu89lvu0000ead8wpa6rwaez	2026-09-24 00:42:38.922
cmuet57t7008cmivsf7ic1y3s	cmu89lw20008jad8w89btlbg3	cmu89lvu9000iad8wjjpwp369	2026-09-24 00:42:38.923
cmuet57t9008emivsfjt3o2ou	cmu89lw20008jad8w89btlbg3	cmu89lvui000mad8w48cyrkkf	2026-09-24 00:42:38.925
cmuet57ta008gmivsdpbqwor9	cmu89lw20008jad8w89btlbg3	cmu89lvuk000nad8wra8dnxcm	2026-09-24 00:42:38.926
cmuet57tb008imivsihejajg4	cmu89lw20008jad8w89btlbg3	cmu89lvuo000pad8wvb8de32w	2026-09-24 00:42:38.928
cmuet57tc008kmivsblng36so	cmu89lw20008jad8w89btlbg3	cmu89lvuw000sad8wjwa3szat	2026-09-24 00:42:38.929
cmuet57te008mmivs39lj8rfq	cmu89lw20008jad8w89btlbg3	cmu89lvv9000xad8w2efvsdq4	2026-09-24 00:42:38.93
cmuet57th008omivst3sdobta	cmu89lw20008jad8w89btlbg3	cmu89lvvb000yad8wauxz8cms	2026-09-24 00:42:38.934
cmuet57tj008qmivs1gd519kl	cmu89lw20008jad8w89btlbg3	cmu89lvvd000zad8wgqdnhgs5	2026-09-24 00:42:38.935
cmuet57tk008smivsfg0xaubo	cmu89lw20008jad8w89btlbg3	cmu89lvvv0017ad8wzhijw5qt	2026-09-24 00:42:38.937
cmuet57tm008umivsvvtrtfg9	cmu89lw20008jad8w89btlbg3	cmu89lvvx0018ad8w79kr2g0m	2026-09-24 00:42:38.938
cmuet57to008wmivsujl4w1lz	cmu89lw20008jad8w89btlbg3	cmu89lvwm001jad8wttbbss74	2026-09-24 00:42:38.94
cmuet57ts008zmivs62devkoy	cmu89lw3p00adad8wsff4x25f	cmu89lvto0009ad8wn7dyh0j6	2026-09-24 00:42:38.945
cmuet57tv0091mivs1av697kw	cmu89lw3p00adad8wsff4x25f	cmu89lvu0000ead8wpa6rwaez	2026-09-24 00:42:38.947
cmuet57tw0093mivs3a2ytiyq	cmu89lw3p00adad8wsff4x25f	cmu89lvu9000iad8wjjpwp369	2026-09-24 00:42:38.949
cmuet57tx0095mivs7d7qd0sg	cmu89lw3p00adad8wsff4x25f	cmu89lvui000mad8w48cyrkkf	2026-09-24 00:42:38.95
cmuet57u10097mivsv9zjtmsp	cmu89lw3p00adad8wsff4x25f	cmu89lvuk000nad8wra8dnxcm	2026-09-24 00:42:38.953
cmuet57u20099mivsy57h6szr	cmu89lw3p00adad8wsff4x25f	cmu89lvuw000sad8wjwa3szat	2026-09-24 00:42:38.955
cmuet57u4009bmivsn1qmpvtl	cmu89lw3p00adad8wsff4x25f	cmu89lvvv0017ad8wzhijw5qt	2026-09-24 00:42:38.956
cmuet57u5009dmivsagypk7hu	cmu89lw3p00adad8wsff4x25f	cmu89lvvx0018ad8w79kr2g0m	2026-09-24 00:42:38.957
cmuet57u8009gmivszed8hj7o	cmu89lw4e00auad8w056any3y	cmu89lvto0009ad8wn7dyh0j6	2026-09-24 00:42:38.961
cmuet57u9009imivstof9ifwu	cmu89lw4e00auad8w056any3y	cmu89lvu0000ead8wpa6rwaez	2026-09-24 00:42:38.962
cmuet57ub009kmivsm12ohxal	cmu89lw4e00auad8w056any3y	cmu89lvu9000iad8wjjpwp369	2026-09-24 00:42:38.963
cmuet57uc009mmivsy6qpcz65	cmu89lw4e00auad8w056any3y	cmu89lvvf0010ad8wj5tj3fp1	2026-09-24 00:42:38.964
cmuet57ud009omivssaemvau9	cmu89lw4e00auad8w056any3y	cmu89lvvi0011ad8w3cebrv6z	2026-09-24 00:42:38.966
cmuet57ue009qmivsn5jvy1kd	cmu89lw4e00auad8w056any3y	cmu89lvvk0012ad8w7mbj08sh	2026-09-24 00:42:38.967
cmuet57ug009smivsw1xoja1k	cmu89lw4e00auad8w056any3y	cmu89lvvm0013ad8wpouostwf	2026-09-24 00:42:38.968
cmuet57ui009umivs1v492lzm	cmu89lw4e00auad8w056any3y	cmu89lvvo0014ad8whx7p72a2	2026-09-24 00:42:38.97
cmuet57ul009wmivsy49bv7es	cmu89lw4e00auad8w056any3y	cmu89lvvq0015ad8wpazmuoku	2026-09-24 00:42:38.974
cmuet57un009ymivsni17za6p	cmu89lw4e00auad8w056any3y	cmu89lvw4001bad8wn02kfpkv	2026-09-24 00:42:38.976
cmuet57up00a0mivs0tffynkf	cmu89lw4e00auad8w056any3y	cmu89lvw6001cad8wtqpgs4cv	2026-09-24 00:42:38.977
cmuet57uq00a2mivsbefknihd	cmu89lw4e00auad8w056any3y	cmu89lvw8001dad8wiy4xquj3	2026-09-24 00:42:38.978
cmuet57ur00a4mivs6j3mkkvt	cmu89lw4e00auad8w056any3y	cmu89lvwa001ead8wv2km7xz8	2026-09-24 00:42:38.98
cmuet57us00a6mivs3bylufvc	cmu89lw4e00auad8w056any3y	cmu89lvwo001kad8w2lcfnyso	2026-09-24 00:42:38.981
cmuet57uu00a8mivsy9fuzibx	cmu89lw4e00auad8w056any3y	cmu89lvwr001lad8wxq8bsmyi	2026-09-24 00:42:38.982
cmuet57ux00abmivsc37x90rc	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvvx0018ad8w79kr2g0m	2026-09-24 00:42:38.985
cmuet57uy00admivs9m5ok8lv	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvw1001aad8wm3qevhsz	2026-09-24 00:42:38.987
cmuet57uz00afmivstin62qpn	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvw6001cad8wtqpgs4cv	2026-09-24 00:42:38.988
cmuet57v100ahmivsxxc8uooq	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwa001ead8wv2km7xz8	2026-09-24 00:42:38.989
cmuet57v200ajmivsb2f1id8t	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwc001fad8w4pg3tp1t	2026-09-24 00:42:38.99
cmuet57v500almivsw0j06grh	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwe001gad8w35e1wci6	2026-09-24 00:42:38.994
cmuet57v700anmivsnlxoa3va	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwh001had8wsdburfc1	2026-09-24 00:42:38.995
cmuet57v800apmivsggybfu14	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwj001iad8wnn7frqjj	2026-09-24 00:42:38.996
cmuet57v900armivs6emxv9jq	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwm001jad8wttbbss74	2026-09-24 00:42:38.997
cmuet57va00atmivsprlt5ov1	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwo001kad8w2lcfnyso	2026-09-24 00:42:38.999
cmuet57vb00avmivsbho58j5z	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwt001mad8wjlij0c4u	2026-09-24 00:42:39
cmuet57vd00axmivsx0engz2g	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwv001nad8wnx25kt34	2026-09-24 00:42:39.001
cmuet57ve00azmivs58cbifrh	cmu89lw5f00bpad8w4yk0c2zo	cmu89lvwx001oad8w1png2jv1	2026-09-24 00:42:39.002
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, "displayName", description, "isSystem", "createdAt", "updatedAt") FROM stdin;
cmu89lw2o009ead8w97rx7h9o	chief_pharmacist	Chief Pharmacist	Senior pharmacist with authority for large stock adjustments	t	2026-09-19 10:49:07.489	2026-09-19 10:49:07.489
cmu89lvx8001rad8whyvfp1p0	owner	Owner / Admin	Full access to all features	t	2026-09-19 10:49:07.292	2026-09-24 00:42:38.727
cmu89lvzw005aad8wmv4s8dnc	manager	Store Manager	Can manage most features except system settings	t	2026-09-19 10:49:07.389	2026-09-24 00:42:38.837
cmu89lw20008jad8w89btlbg3	pharmacist	Pharmacist	Can dispense medicines and manage prescriptions	t	2026-09-19 10:49:07.465	2026-09-24 00:42:38.919
cmu89lw3p00adad8wsff4x25f	cashier	Cashier	Can create sales and basic customer management	t	2026-09-19 10:49:07.526	2026-09-24 00:42:38.942
cmu89lw4e00auad8w056any3y	purchase_manager	Purchase Manager	Manages procurement and supplier relations	f	2026-09-19 10:49:07.55	2026-09-24 00:42:38.958
cmu89lw5f00bpad8w4yk0c2zo	accountant	Accountant	Financial tracking, GST, and reporting	f	2026-09-19 10:49:07.587	2026-09-24 00:42:38.983
\.


--
-- Data for Name: sale_item_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_item_batches (id, "saleItemId", "batchId", quantity, "unitPrice") FROM stdin;
cmuewnfu60005pzpd8ircbwee	cmuewnfu60003pzpd0z3yls13	cmuet59wt00humivso0n9auwq	2	33.60
cmuewnfu60008pzpdgl0fd3kw	cmuewnfu60006pzpdgd2dmzxv	cmuet59wa00homivsuulcnr6k	1	120.00
cmuewnfzh000mpzpd5ob9uw8j	cmuewnfzh000kpzpd86zvyvtx	cmuet59wt00humivso0n9auwq	1	33.60
cmuewnfzh000ppzpdc0erueuo	cmuewnfzh000npzpdc80wzv1b	cmuet59vy00hlmivszn3yap6e	1	65.00
cmuewng720011pzpdzoehxsfe	cmuewng71000zpzpdi3s0jpbo	cmuet59vo00himivsuc5s8n0g	2	85.00
cmuewng720014pzpdcv05jnqv	cmuewng720012pzpdzk1qgcuw	cmuet59wj00hrmivs1b1vfdh9	1	55.00
cmuewng720017pzpdh5qdtaz4	cmuewng720015pzpdl108xy0t	cmuet59wt00humivso0n9auwq	1	33.60
cmuewng7w001npzpd7v9o9dmi	cmuewng7w001lpzpd4116xoei	cmuet59xj00i6mivss0dnvl18	2	32.80
cmuewng7w001qpzpd5ffauc9h	cmuewng7w001opzpde8ktynjp	cmuet59wa00homivsuulcnr6k	1	120.00
cmuewng8k0022pzpdrjivxs7w	cmuewng8k0020pzpdh5hawi2w	cmuet59xp00i9mivscwvcu55p	3	30.50
cmuewng8y002epzpdkgu9qmdn	cmuewng8x002cpzpdd65sj9sp	cmuet59wz00hxmivs5wkqhfkr	1	16.20
cmuewng8y002hpzpd417t0my3	cmuewng8y002fpzpdv7zfouvk	cmuet59vy00hlmivszn3yap6e	1	65.00
cmuewng9h002tpzpdjahjrdsw	cmuewng9h002rpzpd374zfbzi	cmuet59xj00i6mivss0dnvl18	2	32.80
cmuewng9h002wpzpdpeorzx5m	cmuewng9h002upzpd4xu54xzi	cmuet59vo00himivsuc5s8n0g	1	85.00
cmuewnga50038pzpdfbbiycdy	cmuewnga50036pzpdixjowd95	cmuet59vo00himivsuc5s8n0g	3	85.00
cmuewnga5003bpzpd9yprugyy	cmuewnga50039pzpde6im53kq	cmuet59wa00homivsuulcnr6k	2	120.00
cmuewnga5003epzpd3np58jxp	cmuewnga5003cpzpd0fw1f076	cmuet59wt00humivso0n9auwq	2	33.60
cmuewngaw003upzpdlxx0lr5p	cmuewngaw003spzpdbi8x8ghf	cmuet59xp00i9mivscwvcu55p	4	30.50
cmuewngaw003xpzpd26giv319	cmuewngaw003vpzpdaqxvtfie	cmuet59xj00i6mivss0dnvl18	2	32.80
cmuewngbe0049pzpd6id5jk7x	cmuewngbe0047pzpdi8nyvu6l	cmuet59wt00humivso0n9auwq	2	33.60
cmuewngbe004cpzpdqyzwekaj	cmuewngbe004apzpdlmpbyqcy	cmuet59wa00homivsuulcnr6k	1	120.00
cmuewngbz004opzpdzz92celg	cmuewngby004mpzpdge4o6z8b	cmuet59wa00homivsuulcnr6k	2	120.00
cmuewngbz004rpzpdb7l4h2y6	cmuewngbz004ppzpdivt4tv63	cmuet59wt00humivso0n9auwq	2	33.60
cmuewngcq0053pzpdnnpfvvxq	cmuewngcq0051pzpdn63p4xlf	cmuet59vo00himivsuc5s8n0g	2	85.00
cmuewngcq0056pzpdibix14lu	cmuewngcq0054pzpd6kuh15p6	cmuet59vy00hlmivszn3yap6e	2	65.00
cmuewngcq0059pzpdxow90r8j	cmuewngcq0057pzpd110s95y6	cmuet59wj00hrmivs1b1vfdh9	1	55.00
cmuewngdh005npzpd2q9exr1q	cmuewngdh005lpzpd1heh4fwn	cmuet59wz00hxmivs5wkqhfkr	2	16.20
cmuewngdi005qpzpdt6zlkks5	cmuewngdi005opzpdw7oyo0a2	cmuet59vy00hlmivszn3yap6e	1	65.00
\.


--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_items (id, "saleId", "productId", "productName", "productSku", quantity, "unitPrice", "discountPercent", "discountAmount", "taxPercent", "cgstPercent", "sgstPercent", "igstPercent", "taxAmount", "totalAmount", mrp, "hsnCode", "returnedQuantity", "createdAt") FROM stdin;
cmuewnfu60003pzpd0z3yls13	cmuewnfu50001pzpdg7yjnv2r	cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	DLO-650	2	33.60	0.00	0.00	12.00	6.00	6.00	0.00	8.06	75.26	33.60	3004	0	2026-09-24 02:20:47.981
cmuewnfu60006pzpdgd2dmzxv	cmuewnfu50001pzpdg7yjnv2r	cmuet59l400czmivsz6egqnzt	Vitamin C 500mg	VTC-500	1	120.00	0.00	0.00	12.00	6.00	6.00	0.00	14.40	134.40	120.00	2106	0	2026-09-24 02:20:47.981
cmuewnfzh000kpzpd86zvyvtx	cmuewnfzh000ipzpdabrnxac6	cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	DLO-650	1	33.60	0.00	0.00	12.00	6.00	6.00	0.00	4.03	37.63	33.60	3004	0	2026-09-24 02:20:48.173
cmuewnfzh000npzpdc80wzv1b	cmuewnfzh000ipzpdabrnxac6	cmuet59ku00cvmivs5d2e7mxz	Cough Syrup 100ml	CFS-100	1	65.00	0.00	0.00	12.00	6.00	6.00	0.00	7.80	72.80	65.00	3004	0	2026-09-24 02:20:48.173
cmuewng71000zpzpdi3s0jpbo	cmuewng71000xpzpdjht7aqhb	cmuet59kn00crmivsww1c894v	Amoxicillin 500mg	AMX-500	2	85.00	0.00	0.00	12.00	6.00	6.00	0.00	20.40	190.40	85.00	3004	0	2026-09-24 02:20:48.445
cmuewng720012pzpdzk1qgcuw	cmuewng71000xpzpdjht7aqhb	cmuet59lc00d3mivsuszpp7ir	Betadine Ointment 20g	BET-OIN-20	1	55.00	0.00	0.00	12.00	6.00	6.00	0.00	6.60	61.60	55.00	3004	0	2026-09-24 02:20:48.445
cmuewng720015pzpdl108xy0t	cmuewng71000xpzpdjht7aqhb	cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	DLO-650	1	33.60	0.00	0.00	12.00	6.00	6.00	0.00	4.03	37.63	33.60	3004	0	2026-09-24 02:20:48.445
cmuewng7w001lpzpd4116xoei	cmuewng7v001jpzpd1pzt175n	cmuet59mn00dnmivszkwegfss	Calpol 650 Tab	CAL-650	2	32.80	0.00	0.00	12.00	6.00	6.00	0.00	7.87	73.47	32.80	3004	0	2026-09-24 02:20:48.475
cmuewng7w001opzpde8ktynjp	cmuewng7v001jpzpd1pzt175n	cmuet59l400czmivsz6egqnzt	Vitamin C 500mg	VTC-500	1	120.00	0.00	0.00	12.00	6.00	6.00	0.00	14.40	134.40	120.00	2106	0	2026-09-24 02:20:48.475
cmuewng8k0020pzpdh5hawi2w	cmuewng8k001ypzpdzxcgciu8	cmuet59mu00drmivsq6cwi68r	P-650 Tablet	P650-TAB	3	30.50	0.00	0.00	12.00	6.00	6.00	0.00	10.98	102.48	30.50	3004	0	2026-09-24 02:20:48.5
cmuewng8x002cpzpdd65sj9sp	cmuewng8x002apzpdeiq53ua0	cmuet59lr00dbmivsgl8xm6hk	Dolo 500 Tablet	DLO-500	1	16.20	0.00	0.00	12.00	6.00	6.00	0.00	1.94	18.14	16.20	3004	0	2026-09-24 02:20:48.513
cmuewng8y002fpzpdv7zfouvk	cmuewng8x002apzpdeiq53ua0	cmuet59ku00cvmivs5d2e7mxz	Cough Syrup 100ml	CFS-100	1	65.00	0.00	0.00	12.00	6.00	6.00	0.00	7.80	72.80	65.00	3004	0	2026-09-24 02:20:48.513
cmuewng9h002rpzpd374zfbzi	cmuewng9h002ppzpdjmtq86tm	cmuet59mn00dnmivszkwegfss	Calpol 650 Tab	CAL-650	2	32.80	0.00	0.00	12.00	6.00	6.00	0.00	7.87	73.47	32.80	3004	0	2026-09-24 02:20:48.533
cmuewng9h002upzpd4xu54xzi	cmuewng9h002ppzpdjmtq86tm	cmuet59kn00crmivsww1c894v	Amoxicillin 500mg	AMX-500	1	85.00	0.00	0.00	12.00	6.00	6.00	0.00	10.20	95.20	85.00	3004	0	2026-09-24 02:20:48.533
cmuewnga50036pzpdixjowd95	cmuewnga50034pzpdhppjq03u	cmuet59kn00crmivsww1c894v	Amoxicillin 500mg	AMX-500	3	85.00	0.00	0.00	12.00	6.00	6.00	0.00	30.60	285.60	85.00	3004	0	2026-09-24 02:20:48.556
cmuewnga50039pzpde6im53kq	cmuewnga50034pzpdhppjq03u	cmuet59l400czmivsz6egqnzt	Vitamin C 500mg	VTC-500	2	120.00	0.00	0.00	12.00	6.00	6.00	0.00	28.80	268.80	120.00	2106	0	2026-09-24 02:20:48.556
cmuewnga5003cpzpd0fw1f076	cmuewnga50034pzpdhppjq03u	cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	DLO-650	2	33.60	0.00	0.00	12.00	6.00	6.00	0.00	8.06	75.26	33.60	3004	0	2026-09-24 02:20:48.556
cmuewngaw003spzpdbi8x8ghf	cmuewngaw003qpzpd1ib4c1xy	cmuet59mu00drmivsq6cwi68r	P-650 Tablet	P650-TAB	4	30.50	0.00	0.00	12.00	6.00	6.00	0.00	14.64	136.64	30.50	3004	0	2026-09-24 02:20:48.584
cmuewngaw003vpzpdaqxvtfie	cmuewngaw003qpzpd1ib4c1xy	cmuet59mn00dnmivszkwegfss	Calpol 650 Tab	CAL-650	2	32.80	0.00	0.00	12.00	6.00	6.00	0.00	7.87	73.47	32.80	3004	0	2026-09-24 02:20:48.584
cmuewngbe0047pzpdi8nyvu6l	cmuewngbe0045pzpdtrzel1k6	cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	DLO-650	2	33.60	0.00	0.00	12.00	6.00	6.00	0.00	8.06	75.26	33.60	3004	0	2026-09-24 02:20:48.602
cmuewngbe004apzpdlmpbyqcy	cmuewngbe0045pzpdtrzel1k6	cmuet59l400czmivsz6egqnzt	Vitamin C 500mg	VTC-500	1	120.00	0.00	0.00	12.00	6.00	6.00	0.00	14.40	134.40	120.00	2106	0	2026-09-24 02:20:48.602
cmuewngby004mpzpdge4o6z8b	cmuewngby004kpzpdskeg9jys	cmuet59l400czmivsz6egqnzt	Vitamin C 500mg	VTC-500	2	120.00	0.00	0.00	12.00	6.00	6.00	0.00	28.80	268.80	120.00	2106	0	2026-09-24 02:20:48.622
cmuewngbz004ppzpdivt4tv63	cmuewngby004kpzpdskeg9jys	cmuet59lk00d7mivswr05kn2g	Dolo 650 Tablet	DLO-650	2	33.60	0.00	0.00	12.00	6.00	6.00	0.00	8.06	75.26	33.60	3004	0	2026-09-24 02:20:48.622
cmuewngcq0051pzpdn63p4xlf	cmuewngcp004zpzpdmksrzmt6	cmuet59kn00crmivsww1c894v	Amoxicillin 500mg	AMX-500	2	85.00	0.00	0.00	12.00	6.00	6.00	0.00	20.40	190.40	85.00	3004	0	2026-09-24 02:20:48.649
cmuewngcq0054pzpd6kuh15p6	cmuewngcp004zpzpdmksrzmt6	cmuet59ku00cvmivs5d2e7mxz	Cough Syrup 100ml	CFS-100	2	65.00	0.00	0.00	12.00	6.00	6.00	0.00	15.60	145.60	65.00	3004	0	2026-09-24 02:20:48.649
cmuewngcq0057pzpd110s95y6	cmuewngcp004zpzpdmksrzmt6	cmuet59lc00d3mivsuszpp7ir	Betadine Ointment 20g	BET-OIN-20	1	55.00	0.00	0.00	12.00	6.00	6.00	0.00	6.60	61.60	55.00	3004	0	2026-09-24 02:20:48.649
cmuewngdh005lpzpd1heh4fwn	cmuewngdg005jpzpdzv6xva5i	cmuet59lr00dbmivsgl8xm6hk	Dolo 500 Tablet	DLO-500	2	16.20	0.00	0.00	12.00	6.00	6.00	0.00	3.89	36.29	16.20	3004	0	2026-09-24 02:20:48.676
cmuewngdi005opzpdw7oyo0a2	cmuewngdg005jpzpdzv6xva5i	cmuet59ku00cvmivs5d2e7mxz	Cough Syrup 100ml	CFS-100	1	65.00	0.00	0.00	12.00	6.00	6.00	0.00	7.80	72.80	65.00	3004	0	2026-09-24 02:20:48.676
\.


--
-- Data for Name: sale_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_return_items (id, "saleReturnId", "saleItemId", quantity, "unitPrice", "totalAmount", "restockDecision", "batchId") FROM stdin;
\.


--
-- Data for Name: sale_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_returns (id, "returnNumber", "saleId", "customerId", "returnDate", reason, "totalAmount", status, "refundMethod", "refundRef", notes, "processedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales (id, "invoiceNumber", "branchId", "customerId", "prescriptionId", "saleDate", subtotal, "discountAmount", "discountPercent", "taxAmount", "cgstAmount", "sgstAmount", "igstAmount", "totalAmount", "amountPaid", "balanceDue", status, "paymentStatus", notes, "createdById", "cancelledAt", "cancelledReason", "createdAt", "updatedAt", "billDiscountPercent", "doctorCommissionAmount", "doctorCommissionPercent", "doctorId", "doctorName", "roundOff") FROM stdin;
cmuewnfu50001pzpdg7yjnv2r	INV-2026-0101	default-branch	cmuet5a4g00l3mivsjxhqdmpl	cmuewclvm000eh6cjkw45zs11	2026-09-24 03:45:00	187.20	0.00	0.00	22.46	11.23	11.23	0.00	210.00	210.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 03:45:00	2026-09-24 02:20:47.981	0.00	9.36	5.00	cmuewcltl0007h6cjqd5jp3eo	Dr. Sneha Kulkarni	0.34
cmuewnfzh000ipzpdabrnxac6	INV-2026-0102	default-branch	cmuet5a4b00l2mivsfemad6o1	\N	2026-09-24 05:00:00	98.60	0.00	0.00	11.83	5.92	5.91	0.00	110.00	110.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 05:00:00	2026-09-24 02:20:48.173	0.00	\N	\N	\N	\N	-0.43
cmuewng71000xpzpdjht7aqhb	INV-2026-0103	default-branch	cmuewclsu0003h6cja9t0c468	cmuewclvd000ah6cjibyebv0k	2026-09-24 06:15:00	258.60	0.00	0.00	31.03	15.52	15.51	0.00	290.00	290.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 06:15:00	2026-09-24 02:20:48.445	0.00	12.93	5.00	cmua62xxk0000k7za1tcylae6	Dr. Rajesh Sharma	0.37
cmuewng7v001jpzpd1pzt175n	INV-2026-0104	default-branch	cmuet5a4l00l4mivsdl67p0pt	\N	2026-09-24 07:40:00	185.60	0.00	0.00	22.27	11.14	11.13	0.00	208.00	208.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 07:40:00	2026-09-24 02:20:48.475	0.00	\N	\N	\N	\N	0.13
cmuewng8k001ypzpdzxcgciu8	INV-2026-0105	default-branch	cmuewclsp0002h6cj7irmbjga	cmuewclvi000ch6cj4tro6oza	2026-09-24 09:10:00	91.50	0.00	0.00	10.98	5.49	5.49	0.00	102.00	102.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 09:10:00	2026-09-24 02:20:48.5	0.00	4.58	5.00	cmuewclta0005h6cj3ntaf9oa	Dr. Arvind Kumar	-0.48
cmuewng8x002apzpdeiq53ua0	INV-2026-0106	default-branch	cmuet5a4b00l2mivsfemad6o1	\N	2026-09-24 10:45:00	81.20	0.00	0.00	9.74	4.87	4.87	0.00	91.00	91.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 10:45:00	2026-09-24 02:20:48.513	0.00	\N	\N	\N	\N	0.06
cmuewng9h002ppzpdjmtq86tm	INV-2026-0107	default-branch	cmuewclsz0004h6cjpwna61lp	\N	2026-09-24 12:00:00	150.60	0.00	0.00	18.07	9.04	9.03	0.00	169.00	169.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-24 12:00:00	2026-09-24 02:20:48.533	0.00	\N	\N	\N	\N	0.33
cmuewnga50034pzpdhppjq03u	INV-2026-0098	default-branch	cmuewclsu0003h6cja9t0c468	\N	2026-09-23 05:30:00	562.20	0.00	0.00	67.46	33.73	33.73	0.00	630.00	300.00	330.00	COMPLETED	PARTIAL	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-23 05:30:00	2026-09-24 02:20:48.556	0.00	28.11	5.00	cmua62xxk0000k7za1tcylae6	Dr. Rajesh Sharma	0.34
cmuewngaw003qpzpd1ib4c1xy	INV-2026-0099	default-branch	cmuewclsp0002h6cj7irmbjga	\N	2026-09-23 09:00:00	187.60	0.00	0.00	22.51	11.26	11.25	0.00	210.00	210.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-23 09:00:00	2026-09-24 02:20:48.584	0.00	\N	\N	\N	\N	-0.11
cmuewngbe0045pzpdtrzel1k6	INV-2026-0100	default-branch	cmuet5a4b00l2mivsfemad6o1	\N	2026-09-23 11:15:00	187.20	0.00	0.00	22.46	11.23	11.23	0.00	210.00	210.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-23 11:15:00	2026-09-24 02:20:48.602	0.00	\N	\N	\N	\N	0.34
cmuewngby004kpzpdskeg9jys	INV-2026-0095	default-branch	cmuet5a4g00l3mivsjxhqdmpl	\N	2026-09-22 04:45:00	307.20	0.00	0.00	36.86	18.43	18.43	0.00	344.00	344.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-22 04:45:00	2026-09-24 02:20:48.622	0.00	\N	\N	\N	\N	-0.06
cmuewngcp004zpzpdmksrzmt6	INV-2026-0096	default-branch	cmuet5a4l00l4mivsdl67p0pt	\N	2026-09-22 08:15:00	355.00	0.00	0.00	42.60	21.30	21.30	0.00	398.00	398.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-22 08:15:00	2026-09-24 02:20:48.649	0.00	\N	\N	\N	\N	0.40
cmuewngdg005jpzpdzv6xva5i	INV-2026-0097	default-branch	cmuet5a4b00l2mivsfemad6o1	\N	2026-09-22 11:50:00	97.40	0.00	0.00	11.69	5.85	5.84	0.00	109.00	109.00	0.00	COMPLETED	PAID	\N	cmuet589u00b1mivst65bse94	\N	\N	2026-09-22 11:50:00	2026-09-24 02:20:48.676	0.00	\N	\N	\N	\N	-0.09
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: stock_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_adjustments (id, "branchId", "productId", "batchId", "adjustmentType", quantity, reason, notes, status, "approvedById", "approvedAt", "createdById", "createdAt") FROM stdin;
cmuewcly0001mh6cjixcphjfw	default-branch	cmuet59lk00d7mivswr05kn2g	cmuet59wt00humivso0n9auwq	PHYSICAL_COUNT	2	Monthly physical inventory audit count reconciliation: +2 sealed strips discovered in counter display drawer.	\N	APPROVED	cmuet589u00b1mivst65bse94	2026-09-20 02:12:22.397	cmuet589u00b1mivst65bse94	2026-09-20 02:12:22.397
cmuewcly5001qh6cjp4aetkv1	default-branch	cmuet59ku00cvmivs5d2e7mxz	cmuet59vy00hlmivszn3yap6e	DAMAGE	-1	Accidental drop damage during shelf rearrangement; bottle glass shattered, liquid lost.	\N	APPROVED	cmuet589u00b1mivst65bse94	2026-09-22 02:12:22.397	cmuet589u00b1mivst65bse94	2026-09-22 02:12:22.397
cmuewclyl001uh6cjr3k5a663	default-branch	cmuet59mn00dnmivszkwegfss	cmuet59xj00i6mivss0dnvl18	DAMAGE	-1	Damaged outer blister foil packaging during carton unpacking; deemed unsaleable per GMP guidelines.	\N	APPROVED	cmuet589u00b1mivst65bse94	2026-09-23 02:12:22.397	cmuet589u00b1mivst65bse94	2026-09-23 02:12:22.397
cmuewclyr001yh6cj0s0v4bf0	default-branch	cmuet59lc00d3mivsuszpp7ir	cmuet59wj00hrmivs1b1vfdh9	CORRECTION	1	Counter count variance under investigation by evening shift supervisor.	\N	PENDING	\N	\N	cmuet589u00b1mivst65bse94	2026-09-23 23:12:22.397
\.


--
-- Data for Name: supplier_ledgers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_ledgers (id, "supplierId", type, amount, balance, "referenceType", "referenceId", description, "entryDate", "createdAt") FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, name, "contactPerson", phone, email, gstin, pan, "dlNumber", address, city, state, pincode, "bankName", "bankAccount", "bankIfsc", "creditDays", "outstandingBalance", "isActive", notes, "createdAt", "updatedAt") FROM stdin;
cmuet5a3z00l0mivsxt2uk08d	MedLife Healthcare Distributors	Vikram Patel	9876500001	orders@medlife-dist.com	29ABCDE1234F1Z1	\N	DL-KA-SUP-01	Plot 42, Pharma Industrial Estate	Bangalore	Karnataka	560099	\N	\N	\N	30	0.00	t	\N	2026-09-24 00:42:41.904	2026-09-24 00:42:41.904
cmuet5a4400l1mivsvbaaec14	Sun Pharma Regional Wholesalers	Anand Roy	9876500002	wholesale@sunpharma-rep.com	29BCDEF2345G2Z2	\N	DL-KA-SUP-02	14/B, Wholesale Medicine Market	Bangalore	Karnataka	560002	\N	\N	\N	45	0.00	t	\N	2026-09-24 00:42:41.908	2026-09-24 00:42:41.908
cmuewclql0000h6cj5md12c1s	Cipla Healthcare Distribution Ltd	Rajeev Menon	9876500003	supply@cipla-dist.com	29CDEFG3456H3Z3	\N	DL-KA-SUP-03	22, Peenya Industrial Area, Phase 1	Bangalore	Karnataka	560058	\N	\N	\N	30	0.00	t	\N	2026-09-24 02:12:22.413	2026-09-24 02:12:22.413
cmuewclqw0001h6cjkpme8ifk	Abbott Healthcare Agency	Kavita Nair	9876500004	orders@abbott-rep.com	29DEFGH4567I4Z4	\N	DL-KA-SUP-04	7th Cross, Gandhinagar Medical Hub	Bangalore	Karnataka	560009	\N	\N	\N	45	0.00	t	\N	2026-09-24 02:12:22.424	2026-09-24 02:12:22.424
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (id, category, key, value, "dataType", label, "updatedAt") FROM stdin;
cmuet59dp00bgmivsnrgbq8pv	general	app_name	PharmaCare	string	Application Name	2026-09-24 00:42:40.957
cmuet59dx00bhmivscml8e3qk	general	date_format	dd/MM/yyyy	string	Date Format	2026-09-24 00:42:40.966
cmuet59e100bimivs9k1kwq33	general	currency_symbol	₹	string	Currency Symbol	2026-09-24 00:42:40.969
cmuet59e400bjmivsrj5o1xxq	general	decimal_places	2	number	Decimal Places	2026-09-24 00:42:40.972
cmuet59e700bkmivsj63plhlx	pos	auto_print_invoice	false	boolean	Auto Print Invoice	2026-09-24 00:42:40.975
cmuet59ed00blmivsxirlh4wm	pos	invoice_type	thermal	string	Invoice Type (thermal/a4)	2026-09-24 00:42:40.981
cmuet59eg00bmmivsy6aunpcf	pos	max_discount_percent	20	number	Max Discount %	2026-09-24 00:42:40.985
cmuet59ej00bnmivswlehkr8v	pos	allow_credit_sales	true	boolean	Allow Credit Sales	2026-09-24 00:42:40.987
cmuet59el00bomivs7ec20vdw	pos	require_customer_for_credit	true	boolean	Require Customer for Credit	2026-09-24 00:42:40.99
cmuet59eo00bpmivslvgujsrn	pos	round_off_total	true	boolean	Round Off Invoice Total	2026-09-24 00:42:40.992
cmuet59er00bqmivspav4888e	inventory	fefo_enabled	true	boolean	FEFO Batch Selection	2026-09-24 00:42:40.995
cmuet59et00brmivs6zi0lb65	inventory	negative_stock	false	boolean	Allow Negative Stock	2026-09-24 00:42:40.997
cmuet59ex00bsmivs7oueuvxe	inventory	low_stock_threshold	10	number	Low Stock Threshold	2026-09-24 00:42:41.001
cmuet59ez00btmivsbgiwe5js	inventory	expiry_alert_days	90	number	Expiry Alert Days	2026-09-24 00:42:41.003
cmuet59f100bumivsv8k1jg8q	notifications	low_stock_enabled	true	boolean	Low Stock Alerts	2026-09-24 00:42:41.005
cmuet59f200bvmivsjxdj2qjp	notifications	expiry_alert_enabled	true	boolean	Expiry Alerts	2026-09-24 00:42:41.007
cmuet59f500bwmivs9cr512iq	notifications	payment_due_enabled	true	boolean	Payment Due Alerts	2026-09-24 00:42:41.009
cmuet59f700bxmivs21nhgzwc	gst	tax_inclusive	false	boolean	Prices are Tax Inclusive	2026-09-24 00:42:41.011
cmuet59f900bymivsntw9eohy	gst	default_gst_rate	12	number	Default GST Rate %	2026-09-24 00:42:41.013
cmuet59fb00bzmivs5plxa1qb	gst	state_code	29	string	State Code (for GST)	2026-09-24 00:42:41.015
\.


--
-- Data for Name: tax_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tax_rates (id, name, rate, cgst, sgst, igst, "isDefault", "isActive", "createdAt") FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, "userId", "roleId", "createdAt") FROM stdin;
cmuet58a100b3mivsyadl2ul3	cmuet589u00b1mivst65bse94	cmu89lvx8001rad8whyvfp1p0	2026-09-24 00:42:39.53
cmuet58n900b7mivs693zubhf	cmuet58n500b5mivs1fu4l3px	cmu89lvzw005aad8wmv4s8dnc	2026-09-24 00:42:40.005
cmuet590100bbmivsx7dd246x	cmuet58zy00b9mivstkq6bi2w	cmu89lw20008jad8w89btlbg3	2026-09-24 00:42:40.466
cmuet59dl00bfmivsseg1kgta	cmuet59dh00bdmivsc67z5dd6	cmu89lw3p00adad8wsff4x25f	2026-09-24 00:42:40.953
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, "emailVerified", password, image, phone, "isActive", "mustChangePassword", "lastLoginAt", "failedLoginCount", "lockedUntil", "createdAt", "updatedAt", "branchId") FROM stdin;
cmuet59dh00bdmivsc67z5dd6	Cashier User	cashier@pharmacare.local	\N	$2a$12$2jW/egK5Q.x8Fk15rwx1HefjmYMyTsxO9795gcAwcW7hcpoMlt8U6	\N	\N	t	f	\N	0	\N	2026-09-24 00:42:40.95	2026-09-24 00:42:40.95	default-branch
cmuet58zy00b9mivstkq6bi2w	Dr. Pharmacist	pharmacist@pharmacare.local	\N	$2a$12$gm60G370104uZPzMQ/of0uZyolc/4Oo.HIH0214NAm8zByhbtEqES	\N	\N	t	f	2026-10-20 08:42:10.741	0	\N	2026-09-24 00:42:40.463	2026-10-20 08:42:10.743	default-branch
cmuet58n500b5mivs1fu4l3px	Store Manager	manager@pharmacare.local	\N	$2a$12$gEC0eJiidQjwLqpR.p8Cx.Za8FyONZrEb2qX/W6.RerXgz5nhyI0K	\N	\N	t	f	2026-10-20 08:42:52.228	0	\N	2026-09-24 00:42:40.002	2026-10-20 08:42:52.233	default-branch
cmuet589u00b1mivst65bse94	Admin User	admin@pharmacare.local	\N	$2a$12$3unOZBuADaYTgPNoEjRx8uZ95AzMuSnILhvrAKB.VkTi8yCyexBg2	\N	\N	t	f	2026-10-24 19:23:41.646	0	\N	2026-09-24 00:42:39.522	2026-10-24 19:23:41.649	default-branch
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification_tokens (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: voucher_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.voucher_entries (id, voucher_id, ledger_id, customer_id, entry_type, amount, created_at) FROM stdin;
\.


--
-- Data for Name: vouchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vouchers (id, voucher_no, voucher_type, date, narration, branch_id, created_by_id, created_at, updated_at) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: batch_disposals batch_disposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_disposals
    ADD CONSTRAINT batch_disposals_pkey PRIMARY KEY (id);


--
-- Name: batch_status_log batch_status_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_status_log
    ADD CONSTRAINT batch_status_log_pkey PRIMARY KEY (id);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: bill_allocations bill_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_allocations
    ADD CONSTRAINT bill_allocations_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_ledgers customer_ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_ledgers
    ADD CONSTRAINT customer_ledgers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: doctor_commissions doctor_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_commissions
    ADD CONSTRAINT doctor_commissions_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: gst_transactions gst_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_transactions
    ADD CONSTRAINT gst_transactions_pkey PRIMARY KEY (id);


--
-- Name: held_bills held_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.held_bills
    ADD CONSTRAINT held_bills_pkey PRIMARY KEY (id);


--
-- Name: hsn_codes hsn_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hsn_codes
    ADD CONSTRAINT hsn_codes_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: ledgers ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledgers
    ADD CONSTRAINT ledgers_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: prescription_images prescription_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescription_images
    ADD CONSTRAINT prescription_images_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: product_barcodes product_barcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_barcodes
    ADD CONSTRAINT product_barcodes_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_return_items purchase_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sale_item_batches sale_item_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_item_batches
    ADD CONSTRAINT sale_item_batches_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_return_items sale_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_pkey PRIMARY KEY (id);


--
-- Name: sale_returns sale_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: supplier_ledgers supplier_ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_ledgers
    ADD CONSTRAINT supplier_ledgers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tax_rates tax_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: voucher_entries voucher_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voucher_entries
    ADD CONSTRAINT voucher_entries_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: accounts_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON public.accounts USING btree (provider, "providerAccountId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_entity_entityId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_entity_entityId_idx" ON public.audit_logs USING btree (entity, "entityId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: batches_expiryDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "batches_expiryDate_idx" ON public.batches USING btree ("expiryDate");


--
-- Name: batches_productId_batchNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "batches_productId_batchNumber_key" ON public.batches USING btree ("productId", "batchNumber");


--
-- Name: batches_productId_expiryDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "batches_productId_expiryDate_idx" ON public.batches USING btree ("productId", "expiryDate");


--
-- Name: bill_allocations_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bill_allocations_invoice_id_idx ON public.bill_allocations USING btree (invoice_id);


--
-- Name: bill_allocations_voucher_entry_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bill_allocations_voucher_entry_id_idx ON public.bill_allocations USING btree (voucher_entry_id);


--
-- Name: branches_organizationId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "branches_organizationId_code_key" ON public.branches USING btree ("organizationId", code);


--
-- Name: categories_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);


--
-- Name: credit_notes_noteNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "credit_notes_noteNumber_key" ON public.credit_notes USING btree ("noteNumber");


--
-- Name: credit_notes_saleReturnId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "credit_notes_saleReturnId_key" ON public.credit_notes USING btree ("saleReturnId");


--
-- Name: customer_ledgers_customerId_entryDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "customer_ledgers_customerId_entryDate_idx" ON public.customer_ledgers USING btree ("customerId", "entryDate");


--
-- Name: customers_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customers_name_idx ON public.customers USING btree (name);


--
-- Name: customers_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customers_phone_idx ON public.customers USING btree (phone);


--
-- Name: doctor_commissions_doctorId_isPaid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "doctor_commissions_doctorId_isPaid_idx" ON public.doctor_commissions USING btree ("doctorId", "isPaid");


--
-- Name: doctor_commissions_saleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "doctor_commissions_saleId_idx" ON public.doctor_commissions USING btree ("saleId");


--
-- Name: doctors_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX doctors_name_idx ON public.doctors USING btree (name);


--
-- Name: doctors_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX doctors_phone_idx ON public.doctors USING btree (phone);


--
-- Name: files_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "files_entityType_entityId_idx" ON public.files USING btree ("entityType", "entityId");


--
-- Name: gst_transactions_branchId_invoiceDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "gst_transactions_branchId_invoiceDate_idx" ON public.gst_transactions USING btree ("branchId", "invoiceDate");


--
-- Name: gst_transactions_returnPeriod_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "gst_transactions_returnPeriod_idx" ON public.gst_transactions USING btree ("returnPeriod");


--
-- Name: held_bills_branchId_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "held_bills_branchId_userId_idx" ON public.held_bills USING btree ("branchId", "userId");


--
-- Name: hsn_codes_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX hsn_codes_code_key ON public.hsn_codes USING btree (code);


--
-- Name: inventory_movements_inventoryId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "inventory_movements_inventoryId_idx" ON public.inventory_movements USING btree ("inventoryId");


--
-- Name: inventory_movements_referenceType_referenceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "inventory_movements_referenceType_referenceId_idx" ON public.inventory_movements USING btree ("referenceType", "referenceId");


--
-- Name: inventory_productId_branchId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "inventory_productId_branchId_key" ON public.inventory USING btree ("productId", "branchId");


--
-- Name: ledger_entries_ledgerId_entryDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ledger_entries_ledgerId_entryDate_idx" ON public.ledger_entries USING btree ("ledgerId", "entryDate");


--
-- Name: ledgers_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ledgers_code_key ON public.ledgers USING btree (code);


--
-- Name: notification_preferences_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "notification_preferences_userId_key" ON public.notification_preferences USING btree ("userId");


--
-- Name: notifications_userId_isRead_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "notifications_userId_isRead_idx" ON public.notifications USING btree ("userId", "isRead");


--
-- Name: organization_settings_organizationId_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "organization_settings_organizationId_key_key" ON public.organization_settings USING btree ("organizationId", key);


--
-- Name: organizations_gstin_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX organizations_gstin_key ON public.organizations USING btree (gstin);


--
-- Name: password_reset_tokens_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX password_reset_tokens_token_key ON public.password_reset_tokens USING btree (token);


--
-- Name: permissions_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);


--
-- Name: product_barcodes_barcode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX product_barcodes_barcode_key ON public.product_barcodes USING btree (barcode);


--
-- Name: product_categories_productId_categoryId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "product_categories_productId_categoryId_key" ON public.product_categories USING btree ("productId", "categoryId");


--
-- Name: products_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_barcode_idx ON public.products USING btree (barcode);


--
-- Name: products_barcode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_barcode_key ON public.products USING btree (barcode);


--
-- Name: products_genericName_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "products_genericName_idx" ON public.products USING btree ("genericName");


--
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


--
-- Name: products_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_sku_idx ON public.products USING btree (sku);


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: purchase_returns_returnNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "purchase_returns_returnNumber_key" ON public.purchase_returns USING btree ("returnNumber");


--
-- Name: purchases_purchaseNumber_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "purchases_purchaseNumber_idx" ON public.purchases USING btree ("purchaseNumber");


--
-- Name: purchases_purchaseNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "purchases_purchaseNumber_key" ON public.purchases USING btree ("purchaseNumber");


--
-- Name: purchases_supplierId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "purchases_supplierId_idx" ON public.purchases USING btree ("supplierId");


--
-- Name: role_permissions_roleId_permissionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON public.role_permissions USING btree ("roleId", "permissionId");


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: sale_returns_returnNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sale_returns_returnNumber_key" ON public.sale_returns USING btree ("returnNumber");


--
-- Name: sales_branchId_saleDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_branchId_saleDate_idx" ON public.sales USING btree ("branchId", "saleDate");


--
-- Name: sales_customerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_customerId_idx" ON public.sales USING btree ("customerId");


--
-- Name: sales_doctorId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_doctorId_idx" ON public.sales USING btree ("doctorId");


--
-- Name: sales_invoiceNumber_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_invoiceNumber_idx" ON public.sales USING btree ("invoiceNumber");


--
-- Name: sales_invoiceNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sales_invoiceNumber_key" ON public.sales USING btree ("invoiceNumber");


--
-- Name: sessions_sessionToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON public.sessions USING btree ("sessionToken");


--
-- Name: stock_adjustments_branchId_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stock_adjustments_branchId_productId_idx" ON public.stock_adjustments USING btree ("branchId", "productId");


--
-- Name: supplier_ledgers_supplierId_entryDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "supplier_ledgers_supplierId_entryDate_idx" ON public.supplier_ledgers USING btree ("supplierId", "entryDate");


--
-- Name: suppliers_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_name_idx ON public.suppliers USING btree (name);


--
-- Name: system_settings_category_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX system_settings_category_key_key ON public.system_settings USING btree (category, key);


--
-- Name: user_roles_userId_roleId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON public.user_roles USING btree ("userId", "roleId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: verification_tokens_identifier_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX verification_tokens_identifier_token_key ON public.verification_tokens USING btree (identifier, token);


--
-- Name: verification_tokens_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX verification_tokens_token_key ON public.verification_tokens USING btree (token);


--
-- Name: voucher_entries_customer_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX voucher_entries_customer_id_idx ON public.voucher_entries USING btree (customer_id);


--
-- Name: voucher_entries_ledger_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX voucher_entries_ledger_id_idx ON public.voucher_entries USING btree (ledger_id);


--
-- Name: voucher_entries_voucher_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX voucher_entries_voucher_id_idx ON public.voucher_entries USING btree (voucher_id);


--
-- Name: vouchers_voucher_no_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vouchers_voucher_no_idx ON public.vouchers USING btree (voucher_no);


--
-- Name: vouchers_voucher_no_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX vouchers_voucher_no_key ON public.vouchers USING btree (voucher_no);


--
-- Name: vouchers_voucher_type_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vouchers_voucher_type_date_idx ON public.vouchers USING btree (voucher_type, date);


--
-- Name: accounts accounts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: batch_disposals batch_disposals_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_disposals
    ADD CONSTRAINT "batch_disposals_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: batch_status_log batch_status_log_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_status_log
    ADD CONSTRAINT "batch_status_log_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: batches batches_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT "batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: batches batches_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT "batches_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bill_allocations bill_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_allocations
    ADD CONSTRAINT bill_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bill_allocations bill_allocations_voucher_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_allocations
    ADD CONSTRAINT bill_allocations_voucher_entry_id_fkey FOREIGN KEY (voucher_entry_id) REFERENCES public.voucher_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: branches branches_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT "branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: categories categories_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: credit_notes credit_notes_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: credit_notes credit_notes_saleReturnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT "credit_notes_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES public.sale_returns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_ledgers customer_ledgers_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_ledgers
    ADD CONSTRAINT "customer_ledgers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: doctor_commissions doctor_commissions_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_commissions
    ADD CONSTRAINT "doctor_commissions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: doctor_commissions doctor_commissions_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_commissions
    ADD CONSTRAINT "doctor_commissions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory inventory_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT "inventory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movements inventory_movements_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "inventory_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_inventoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "inventory_movements_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES public.inventory(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory inventory_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ledger_entries ledger_entries_ledgerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT "ledger_entries_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES public.ledgers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ledgers ledgers_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledgers
    ADD CONSTRAINT "ledgers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.ledgers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT "organization_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: password_reset_tokens password_reset_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: prescription_images prescription_images_prescriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescription_images
    ADD CONSTRAINT "prescription_images_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES public.prescriptions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "prescriptions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "prescriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_barcodes product_barcodes_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_barcodes
    ADD CONSTRAINT "product_barcodes_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_categories product_categories_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT "product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_categories product_categories_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_hsnCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_hsnCode_fkey" FOREIGN KEY ("hsnCode") REFERENCES public.hsn_codes(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT "purchase_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_items purchase_items_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_return_items purchase_return_items_purchaseReturnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT "purchase_return_items_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES public.purchase_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_returns purchase_returns_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT "purchase_returns_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_returns purchase_returns_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT "purchase_returns_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchases purchases_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT "purchases_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchases purchases_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchases purchases_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_item_batches sale_item_batches_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_item_batches
    ADD CONSTRAINT "sale_item_batches_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.batches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_item_batches sale_item_batches_saleItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_item_batches
    ADD CONSTRAINT "sale_item_batches_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES public.sale_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_items sale_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_return_items sale_return_items_saleItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT "sale_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES public.sale_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_return_items sale_return_items_saleReturnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT "sale_return_items_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES public.sale_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_returns sale_returns_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT "sale_returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sale_returns sale_returns_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT "sale_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales sales_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales sales_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales sales_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_prescriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES public.prescriptions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "stock_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_ledgers supplier_ledgers_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_ledgers
    ADD CONSTRAINT "supplier_ledgers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: voucher_entries voucher_entries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voucher_entries
    ADD CONSTRAINT voucher_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: voucher_entries voucher_entries_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voucher_entries
    ADD CONSTRAINT voucher_entries_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: voucher_entries voucher_entries_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voucher_entries
    ADD CONSTRAINT voucher_entries_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: vouchers vouchers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: vouchers vouchers_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict SR6bFAosxKpEOKjbs0N0oJ2cVJo9AwagelBttiQ7sz3QGMG3TYAyBBx5K8I2fTA

