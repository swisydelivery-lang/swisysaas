CREATE TYPE user_role AS ENUM ('super_admin','admin','driver','customer');
CREATE TYPE order_status AS ENUM ('pending','assigned','picked_up','delivered','cancelled');

CREATE TABLE offices (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  max_drivers INT NOT NULL DEFAULT 5 CHECK (max_drivers >= 0),
  subscription_ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  office_id INT REFERENCES offices(id),
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'super_admin' AND office_id IS NULL)
      OR (role <> 'super_admin' AND office_id IS NOT NULL))
);
CREATE INDEX users_office_role_idx ON users (office_id, role);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  office_id INT NOT NULL REFERENCES offices(id),
  customer_id INT REFERENCES users(id),
  driver_id INT REFERENCES users(id),
  created_by INT NOT NULL REFERENCES users(id),
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  contact_phone TEXT,
  notes TEXT,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  commission_percent NUMERIC(5,2) NOT NULL CHECK (commission_percent BETWEEN 0 AND 100),
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX orders_office_status_idx ON orders (office_id, status);
